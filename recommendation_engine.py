"""
추천 엔진 - HARD 제약 필터링, 5요소 스코어링(기획서 10장 표), 4가지 모드 결정.

v1과 차이: 텍스트 유사도 계산에서 SBERT opt-in 경로를 뺐다. 검증되지 않은
무거운 모델이라 v2에서는 문자 n-gram TF-IDF 하나로 통일했다 (외부 의존성
없음, 즉시 검증 가능).
"""

from __future__ import annotations

from typing import List

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
    UserSatisfaction,
)


def _normalize(values: List[float]) -> List[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [0.5 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def _violates_hard_constraints(movie: MovieCandidate, users: List[UserPreferenceState]) -> bool:
    for user in users:
        c = user.constraints
        if c.max_runtime and movie.runtime and movie.runtime > c.max_runtime:
            return True
        if c.exclude_adult and movie.adult:
            return True
        if c.min_rating and movie.vote_average < c.min_rating:
            return True
        if any(g in movie.genres for g in c.excluded_genres):
            return True
        # 명시적으로 강한 비선호(-0.9 이하)를 보인 장르도 HARD 취급
        for genre in movie.genres:
            if user.genres.get(genre, 0.0) <= -0.9:
                return True
    return False


def _user_satisfaction(movie: MovieCandidate, user: UserPreferenceState) -> float:
    scores = []
    for genre in movie.genres:
        if genre in user.genres:
            scores.append(user.genres[genre])
    for mood in movie.mood_tags:
        if mood in user.moods:
            scores.append(user.moods[mood])
    if movie.movie_id in user.movies:
        scores.append(user.movies[movie.movie_id])

    if not scores:
        return 0.5  # 취향 정보 없는 사용자는 중립으로 취급해 그룹 점수를 왜곡하지 않는다
    avg = sum(scores) / len(scores)
    return (avg + 1) / 2  # -1~1 -> 0~1


def _text_similarity_scores(movie_texts: List[str], user_texts: List[str]) -> List[float]:
    """영화 줄거리 vs 사용자 취향 설명(장르/무드 텍스트) 사이 유사도.
    문자 n-gram TF-IDF(analyzer="char_wb")만 쓴다 - 외부 모델 없이도 "가벼운"과
    "가볍게"처럼 어근이 같은 표현 사이에 약하게나마 유사도를 잡을 수 있다."""
    if not any(user_texts) or not movie_texts:
        return [0.0] * len(movie_texts)

    corpus = movie_texts + user_texts
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3))
    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        return [0.0] * len(movie_texts)

    movie_matrix = matrix[: len(movie_texts)]
    user_matrix = matrix[len(movie_texts):]
    sims = cosine_similarity(movie_matrix, user_matrix)
    return sims.mean(axis=1).tolist()


def score_candidates(
    candidates: List[MovieCandidate],
    users: List[UserPreferenceState],
) -> List[ScoredMovie]:
    survivors = [m for m in candidates if not _violates_hard_constraints(m, users)]
    if not survivors:
        return []

    popularity_raw = _normalize([m.popularity for m in survivors])
    rating_raw = _normalize([m.vote_average for m in survivors])

    movie_texts = [m.overview for m in survivors]
    user_texts = [
        " ".join(list(u.genres.keys()) + list(u.moods.keys())) for u in users
    ]
    similarity_raw = _text_similarity_scores(movie_texts, user_texts)

    weights = config.RECOMMENDATION_WEIGHTS
    results = []
    for idx, movie in enumerate(survivors):
        satisfactions = [
            UserSatisfaction(user_id=u.user_id, satisfaction=_user_satisfaction(movie, u))
            for u in users
        ]
        sat_values = [s.satisfaction for s in satisfactions] or [0.5]
        group_satisfaction = sum(sat_values) / len(sat_values)
        fairness = min(sat_values)

        breakdown = {
            "group_satisfaction": group_satisfaction,
            "fairness": fairness,
            "text_similarity": similarity_raw[idx],
            "popularity": popularity_raw[idx],
            "rating": rating_raw[idx],
        }
        final_score = sum(breakdown[k] * weights[k] for k in weights)

        matched = [g for g in movie.genres if any(g in u.genres and u.genres[g] > 0 for u in users)]
        evidence_level = "HIGH" if len(matched) >= 2 else ("MEDIUM" if matched else "LOW")

        results.append(ScoredMovie(
            movie=movie,
            final_score=final_score,
            breakdown=breakdown,
            explanation=RecommendationExplanation(
                matched_preferences=matched,
                evidence_level=evidence_level,
                user_satisfaction=satisfactions,
            ),
        ))

    results.sort(key=lambda r: r.final_score, reverse=True)
    return results


def decide_mode(users: List[UserPreferenceState], had_chat_candidates: bool) -> RecommendationMode:
    has_any_signal = any(u.genres or u.moods or u.movies for u in users)
    if not has_any_signal:
        return RecommendationMode.LOW_EVIDENCE_DISCOVERY

    all_genre_sets = [set(g for g, v in u.genres.items() if v > 0) for u in users if u.genres]
    if len(all_genre_sets) >= 2:
        intersection = set.intersection(*all_genre_sets)
        if intersection:
            return RecommendationMode.CONSENSUS
        return RecommendationMode.CONFLICT_DISCOVERY

    return RecommendationMode.PREFERENCE_DISCOVERY


def recommend(
    room_id: str,
    round_id: str,
    candidates: List[MovieCandidate],
    users: List[UserPreferenceState],
    had_chat_candidates: bool = False,
) -> RecommendationResult:
    scored = score_candidates(candidates, users)
    mode = decide_mode(users, had_chat_candidates)
    return RecommendationResult(
        room_id=room_id,
        round_id=round_id,
        mode=mode,
        top_k=scored[: config.TOP_K],
    )
