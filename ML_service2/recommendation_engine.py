"""
MeetupLog AI Service - 추천 엔진
==================================
기획서 10장 "영화 추천 로직과 결과 모드" 대응.

점수 = 42% 그룹평균만족도 + 28% 하위사용자공정성
      + 18% 텍스트유사도 + 7% 대중성 + 5% 평점

HARD 제약(상영시간 초과, 성인 제외, 사용자가 -1.0으로 명시 비선호한 영화)을
위반하는 영화는 점수 계산 전에 후보에서 제거한다.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import config
from models import (
    MovieCandidate,
    RecommendationExplanation,
    RecommendationMode,
    RecommendationResult,
    ScoredMovie,
    UserPreferenceState,
    UserSatisfactionBreakdown,
)
from text_normalization import get_sentence_embedder


# ---------------------------------------------------------------------------
# HARD 제약 필터링
# ---------------------------------------------------------------------------

def _violates_hard_constraints(movie: MovieCandidate, users: List[UserPreferenceState]) -> List[str]:
    """이 영화가 어떤 사용자의 HARD 조건을 위반하는지 사유 목록으로 반환.
    비어있으면 위반 없음(후보 유지)."""
    reasons = []
    for user in users:
        c = user.constraints
        if c.max_runtime and movie.runtime and movie.runtime > c.max_runtime:
            reasons.append(f"{user.user_id}: 상영시간 {movie.runtime}분 > 제한 {c.max_runtime}분")
        if c.exclude_adult and movie.is_adult:
            reasons.append(f"{user.user_id}: 성인 등급 제외 조건 위반")
        if c.min_rating and movie.vote_average < c.min_rating:
            reasons.append(f"{user.user_id}: 평점 {movie.vote_average} < 최소 {c.min_rating}")
        if user.movies.get(movie.movie_id, 0) <= -0.9:
            reasons.append(f"{user.user_id}: 해당 영화를 명시적으로 강하게 비선호")
        if any(g in c.excluded_genres for g in movie.genres):
            reasons.append(f"{user.user_id}: 비선호(HARD) 장르 포함")
    return reasons


# ---------------------------------------------------------------------------
# 요소별 점수 계산
# ---------------------------------------------------------------------------

def _user_satisfaction(movie: MovieCandidate, user: UserPreferenceState) -> Tuple[float, List[str]]:
    """개인 만족도 추정치(0~1)와 반영된 선호 태그 목록.
    장르/무드 일치 점수를 평균 낸 뒤 0~1로 정규화(-1~1 -> 0~1)한다.
    """
    matched = []
    scores = []

    for genre in movie.genres:
        if genre in user.genres:
            scores.append(user.genres[genre])
            if user.genres[genre] > 0:
                matched.append(f"장르:{genre}")

    for mood in movie.moods:
        if mood in user.moods:
            scores.append(user.moods[mood])
            if user.moods[mood] > 0:
                matched.append(f"분위기:{mood}")

    if movie.movie_id in user.movies:
        scores.append(user.movies[movie.movie_id])
        if user.movies[movie.movie_id] > 0:
            matched.append("직접 언급한 후보")

    if not scores:
        # 취향 정보가 없는 사용자는 중립(0.5)으로 취급해 그룹 점수를 왜곡하지 않는다.
        return 0.5, matched

    avg = sum(scores) / len(scores)          # -1 ~ 1
    normalized = (avg + 1) / 2               # 0 ~ 1
    return normalized, matched


def _text_similarity_scores(movie_texts: List[str], user_texts: List[str]) -> List[float]:
    """영화 줄거리 vs 사용자 취향 설명(장르/무드 텍스트) 간 의미 유사도.

    3단계 우선순위로 계산한다:

    1) config.ENABLE_SBERT_SIMILARITY가 켜져 있으면 jhgan/ko-sroberta-multitask
       문장 임베딩(코사인 유사도)을 먼저 시도한다. 진짜 의미 기반 매칭이라
       "가벼운 거"처럼 사전 키워드에 전혀 없는 표현도 잡을 수 있다. 다만
       모델 다운로드가 필요해 무겁고, 이 프로젝트를 만든 환경에서는
       huggingface.co 접근이 막혀 있어 직접 검증하지 못했다(text_normalization.py
       참고) — 배포 전 반드시 한 번 더 확인할 것.

    2) SBERT가 꺼져 있거나 로드에 실패하면, 문자 n-gram TF-IDF
       (analyzer="char_wb", ngram_range=(2, 3))로 폴백한다. 외부 모델 없이도
       "가벼운"과 "가볍게"처럼 어근은 같지만 활용형이 다른 한국어 표현 사이에
       약하게나마 유사도를 잡아낼 수 있다 — 직접 비교해보면 기존 단어(어절)
       단위 TF-IDF는 이런 경우 유사도가 정확히 0.0이었는데, 문자 n-gram은
       0에 가깝지만 0은 아닌 값을 준다(완벽하지 않지만 진짜 개선이다).
       SBERT만큼 강력하진 않지만 외부 의존성이 전혀 없고 지금 당장 검증 가능하다.

    3) 그마저도 실패하면(입력이 비어있는 등) 전부 0.0을 반환한다.
    """
    if not any(user_texts) or not movie_texts:
        return [0.0] * len(movie_texts)

    if config.ENABLE_SBERT_SIMILARITY:
        embedder = get_sentence_embedder()
        if embedder is not None:
            try:
                # similarity_matrix(movie_texts, user_texts) -> (n_movies, n_users).
                # HF Inference API로 배포된 jhgan/ko-sroberta-multitask는
                # "문장을 벡터로 바꿔줘"가 아니라 "문장 A가 [문장들] 중 뭐랑
                # 비슷해?" 형태(SentenceSimilarityPipeline)만 받으므로,
                # embedder가 벡터 대신 유사도 행렬을 직접 돌려준다 - 이 값이
                # 바로 cosine_similarity(movie_vecs, user_vecs)와 같은 모양.
                sims = embedder.similarity_matrix(movie_texts, user_texts)
                return np.asarray(sims).mean(axis=1).tolist()
            except Exception:
                pass  # SBERT 실패 시 아래 문자 n-gram TF-IDF 경로로 폴백

    corpus = movie_texts + user_texts
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3))
    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # 어휘가 전혀 없을 때(빈 텍스트 등)
        return [0.0] * len(movie_texts)

    n_movies = len(movie_texts)
    movie_vecs = matrix[:n_movies]
    user_vecs = matrix[n_movies:]
    sims = cosine_similarity(movie_vecs, user_vecs)  # (n_movies, n_users)
    return sims.mean(axis=1).tolist()


def _user_preference_text(user: UserPreferenceState) -> str:
    parts = []
    for genre, score in user.genres.items():
        if score > 0:
            parts.extend([genre] * max(int(round(score * 3)), 1))
    for mood, score in user.moods.items():
        if score > 0:
            parts.extend([mood] * max(int(round(score * 3)), 1))
    return " ".join(parts)


def _normalize(values: List[float]) -> List[float]:
    if not values:
        return values
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [0.5 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


# ---------------------------------------------------------------------------
# 메인 스코어링
# ---------------------------------------------------------------------------

def score_candidates(
    candidates: List[MovieCandidate],
    users: List[UserPreferenceState],
    weights: Optional[Dict[str, float]] = None,
) -> List[ScoredMovie]:
    weights = weights or config.RECOMMENDATION_WEIGHTS

    survivors: List[MovieCandidate] = []
    excluded: Dict[str, List[str]] = {}
    for movie in candidates:
        reasons = _violates_hard_constraints(movie, users)
        if reasons:
            excluded[movie.movie_id] = reasons
        else:
            survivors.append(movie)

    if not survivors:
        return []

    # 요소별 원점수 계산
    popularity_raw = _normalize([m.popularity for m in survivors])
    rating_raw = _normalize([m.vote_average for m in survivors])
    movie_texts = [f"{m.title} {m.overview} {' '.join(m.genres)} {' '.join(m.moods)}" for m in survivors]
    user_texts = [_user_preference_text(u) for u in users]
    similarity_raw = _text_similarity_scores(movie_texts, user_texts)

    results: List[ScoredMovie] = []
    for idx, movie in enumerate(survivors):
        per_user = []
        satisfactions = []
        matched_all: List[str] = []
        for user in users:
            sat, matched = _user_satisfaction(movie, user)
            satisfactions.append(sat)
            matched_all.extend(matched)
            per_user.append(UserSatisfactionBreakdown(
                user_id=user.user_id,
                satisfaction=round(sat, 3),
                matched_preferences=matched,
                violated_constraints=[],
            ))

        group_avg = sum(satisfactions) / len(satisfactions)
        # 하위 사용자 공정성: 최저 만족도를 그대로 반영해 "소수 강한 비선호 보호"
        fairness = min(satisfactions)

        breakdown = {
            "group_satisfaction": group_avg,
            "fairness": fairness,
            "text_similarity": similarity_raw[idx],
            "popularity": popularity_raw[idx],
            "rating": rating_raw[idx],
        }
        final_score = sum(breakdown[k] * weights[k] for k in weights)

        evidence_level = "HIGH" if (movie.source == "chat_candidate" or matched_all) else "LOW"

        explanation = RecommendationExplanation(
            mode=RecommendationMode.LOW_EVIDENCE_DISCOVERY,  # 이후 결정, 임시값
            evidence_level=evidence_level,
            matched_preferences=sorted(set(matched_all)),
            excluded_reasons=[],
            user_satisfaction=per_user,
        )

        results.append(ScoredMovie(
            movie=movie,
            final_score=round(final_score, 4),
            breakdown={k: round(v, 4) for k, v in breakdown.items()},
            explanation=explanation,
        ))

    results.sort(key=lambda r: r.final_score, reverse=True)
    return results


# ---------------------------------------------------------------------------
# 추천 모드 결정 (기획서 10장 4가지 모드)
# ---------------------------------------------------------------------------

FAIRNESS_CONFLICT_THRESHOLD = 0.35   # 이 미만이면 "충돌"로 간주
EVIDENCE_MIN_SIGNALS = 2             # 이 이상 genre/mood 신호가 있어야 "충분한 취향 정보"


def decide_mode(
    scored: List[ScoredMovie],
    users: List[UserPreferenceState],
    had_chat_candidates: bool,
) -> RecommendationMode:
    if not scored:
        return RecommendationMode.LOW_EVIDENCE_DISCOVERY

    top = scored[0]
    has_conflict = top.breakdown["fairness"] < FAIRNESS_CONFLICT_THRESHOLD
    evidence_count = sum(len(u.genres) + len(u.moods) for u in users)
    has_enough_preference_data = evidence_count >= EVIDENCE_MIN_SIGNALS

    if had_chat_candidates and not has_conflict:
        return RecommendationMode.CONSENSUS
    if had_chat_candidates and has_conflict:
        return RecommendationMode.CONFLICT_DISCOVERY
    if not had_chat_candidates and has_enough_preference_data:
        return RecommendationMode.PREFERENCE_DISCOVERY
    return RecommendationMode.LOW_EVIDENCE_DISCOVERY


def recommend(
    room_id: str,
    round_id: str,
    candidates: List[MovieCandidate],
    users: List[UserPreferenceState],
    had_chat_candidates: bool,
    top_k: Optional[int] = None,
) -> RecommendationResult:
    """방장이 'AI 영화 추천' 버튼을 누를 때 호출되는 최상위 진입점 (FR-AI-07)."""
    top_k = top_k or config.TOP_K
    scored = score_candidates(candidates, users)
    mode = decide_mode(scored, users, had_chat_candidates)

    top = scored[:top_k]
    for sm in top:
        sm.explanation.mode = mode

    return RecommendationResult(
        room_id=room_id,
        round_id=round_id,
        mode=mode,
        top_k=top,
    )
