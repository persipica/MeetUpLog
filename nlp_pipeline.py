"""
MeetupLog AI Service - NLP 파이프라인 (v2, 백지 재설계)
==================================
v1과 차이: 외부 ML 모델(맞춤법 교정, 임베딩, 파인튜닝 분류기)을 전부 빼고
규칙 기반으로만 동작한다. 이유는 그 모델들이 전부 이 환경에서 실측
검증이 안 된 상태였기 때문 - 검증된 게 생기면 그때 다시 붙인다.

처리 순서 (기획서 8~9장 대응):
  원문 메시지
    → 관련성 판별 (키워드 규칙, FR-AI-01~02)                is_relevant()
    → 절 단위 극성/강도/HARD제외 추출                        extract_entities()
    → Focus 문맥 해석("그거", "나도", FR-AI-05)               resolve_with_focus()
    → 발화 의도 분류                                          classify_intent()
    → 무상태 진입점 (analyze_message) - Main Backend가 이전
      Focus/선호를 실어 보내면 갱신된 조각만 돌려준다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from time_utils import to_aware_utc

# ---------------------------------------------------------------------------
# 키워드 사전 (최소 커버리지 - 실 채팅 로그가 쌓이면 이 표를 확장할 것)
# ---------------------------------------------------------------------------

GENRE_KEYWORDS = {
    "액션": ["액션"],
    "로맨스": ["로맨스", "멜로", "연애물"],
    "코미디": ["코미디", "웃긴", "개그"],
    "공포": ["공포", "호러", "무서운 영화"],
    "SF": ["SF", "에스에프", "공상과학"],
    "스릴러": ["스릴러"],
    "애니메이션": ["애니메이션", "애니"],
    "드라마": ["드라마"],
    "다큐멘터리": ["다큐멘터리", "다큐"],
    "판타지": ["판타지"],
    "범죄": ["범죄물", "범죄 영화"],
    "음악": ["뮤지컬", "음악 영화"],
}

MOOD_KEYWORDS = {
    "잔잔함": ["잔잔한", "잔잔하게", "차분한"],
    "신남": ["신나는", "신나게", "텐션 있는"],
    "무서움": ["무서운", "오싹한", "소름"],
    "슬픔": ["슬픈", "눈물", "먹먹한"],
    "웃김": ["웃긴", "빵터지는", "유쾌한"],
    "감동": ["감동적인", "감동", "훈훈한"],
    "가벼움": ["가벼운", "가볍게", "부담 없는"],
    "진지함": ["진지한", "묵직한"],
}

# 신조어 -> 극성/강도 (간단 사전. corpus 기반 대형 사전은 v2에서 의도적으로 제외)
SLANG_POSITIVE = ["꿀잼", "핵잼", "완전 재밌", "존잼"]
SLANG_NEGATIVE = ["노잼", "핵노잼", "노노"]

POSITIVE_WORDS = ["좋아", "좋음", "좋겠", "최고", "재밌", "재미있", "웃긴다"] + SLANG_POSITIVE
NEGATIVE_WORDS = ["싫어", "별로", "재미없", "구려", "지루"] + SLANG_NEGATIVE

INTENSIFIERS = {"완전": 1.3, "진짜": 1.3, "너무": 1.3, "개": 1.3, "존": 1.3}
DIMINISHERS = {"그냥": 0.6, "조금": 0.6, "약간": 0.5, "살짝": 0.5}

EXCLUSION_MARKERS = ["말고", "빼고", "제외"]
CONTRAST_CONNECTIVES = ["는데", "지만", "근데"]

AGREEMENT_WORDS = ["나도", "콜", "좋아 그거", "오케이", "ㅇㅋ", "찬성"]
REJECTION_WORDS = ["싫은데", "패스", "다른 거", "별로인데"]
QUESTION_MARKERS = ["?", "뭐 볼까", "어때"]

MOVIE_RELATED_HINTS = ["영화", "감독", "배우", "극장", "상영", "OTT", "넷플릭스", "왓챠", "티빙"]
REFERENCE_WORDS = ["그거", "그건", "그 영화", "이거"]

RUNTIME_PATTERN = re.compile(r"(\d+)\s*시간\s*(이내|안|미만)?|(\d+)\s*분\s*(이내|안|미만)?")


# ---------------------------------------------------------------------------
# Focus (그룹 채팅 문맥 - 방/라운드당 하나)
# ---------------------------------------------------------------------------

@dataclass
class ConversationFocus:
    last_genre: Optional[str] = None
    last_mood: Optional[str] = None
    last_movie: Optional[str] = None
    last_genre_at: Optional[datetime] = None
    last_mood_at: Optional[datetime] = None
    last_movie_at: Optional[datetime] = None


def focus_to_dict(focus: ConversationFocus) -> dict:
    def _iso(dt):
        return to_aware_utc(dt).isoformat() if dt else None
    return {
        "last_genre": focus.last_genre,
        "last_mood": focus.last_mood,
        "last_movie": focus.last_movie,
        "last_genre_at": _iso(focus.last_genre_at),
        "last_mood_at": _iso(focus.last_mood_at),
        "last_movie_at": _iso(focus.last_movie_at),
    }


def focus_from_dict(d: Optional[dict]) -> ConversationFocus:
    if not d:
        return ConversationFocus()

    def _dt(s):
        return to_aware_utc(datetime.fromisoformat(s)) if s else None
    return ConversationFocus(
        last_genre=d.get("last_genre"),
        last_mood=d.get("last_mood"),
        last_movie=d.get("last_movie"),
        last_genre_at=_dt(d.get("last_genre_at")),
        last_mood_at=_dt(d.get("last_mood_at")),
        last_movie_at=_dt(d.get("last_movie_at")),
    )


def _update_focus(focus: ConversationFocus, entities: "ExtractedEntities", timestamp: datetime) -> None:
    if entities.genres:
        focus.last_genre = entities.genres[-1][0]
        focus.last_genre_at = timestamp
    if entities.moods:
        focus.last_mood = entities.moods[-1][0]
        focus.last_mood_at = timestamp


def _resolve_reference(focus: ConversationFocus) -> Tuple[Optional[str], Optional[str]]:
    """'그거'/'나도' 같은 지시어가 나왔을 때, 장르/무드 슬롯 중 더 최근에
    갱신된 쪽을 채택한다 (고정 우선순위가 아니라 실제 최신 순)."""
    candidates = []
    if focus.last_genre and focus.last_genre_at:
        candidates.append(("genre", focus.last_genre, focus.last_genre_at))
    if focus.last_mood and focus.last_mood_at:
        candidates.append(("mood", focus.last_mood, focus.last_mood_at))
    if not candidates:
        return None, None
    kind, value, _ = max(candidates, key=lambda c: c[2])
    return kind, value


# ---------------------------------------------------------------------------
# 관련성 판별 (FR-AI-01~02)
# ---------------------------------------------------------------------------

def relevance_score(text: str) -> float:
    """규칙 기반 관련성 점수 (0~1). 영화 관련 신호 단어 개수를 기반으로 한다."""
    score = 0.0
    if any(h in text for h in MOVIE_RELATED_HINTS):
        score += 0.5
    if any(kw in text for kws in GENRE_KEYWORDS.values() for kw in kws):
        score += 0.3
    if any(kw in text for kws in MOOD_KEYWORDS.values() for kw in kws):
        score += 0.2
    if any(w in text for w in REFERENCE_WORDS + AGREEMENT_WORDS + REJECTION_WORDS):
        score += 0.4  # "그거"/"나도"류는 그 자체로 짧아서 다른 신호가 거의 없으므로 배점을 높게 준다
    if any(w in text for w in POSITIVE_WORDS + NEGATIVE_WORDS):
        score += 0.1
    return min(score, 1.0)


def is_relevant(text: str) -> Tuple[bool, float]:
    score = relevance_score(text)
    return score >= _threshold(), score


def _threshold() -> float:
    import config
    return config.RELEVANCE_SCORE_THRESHOLD


# ---------------------------------------------------------------------------
# 절 단위 추출
# ---------------------------------------------------------------------------

@dataclass
class ExtractedEntities:
    genres: List[Tuple[str, float]] = field(default_factory=list)   # (이름, 극성*강도)
    moods: List[Tuple[str, float]] = field(default_factory=list)
    max_runtime: Optional[int] = None
    exclude_adult: bool = False
    excluded_genres: List[str] = field(default_factory=list)


def _split_clauses(text: str) -> List[str]:
    pattern = "|".join(CONTRAST_CONNECTIVES)
    parts = re.split(f"({pattern})|[,.!?]", text)
    return [p.strip() for p in parts if p and p.strip() and p not in CONTRAST_CONNECTIVES]


def _clause_polarity(clause: str) -> float:
    """절 하나의 극성*강도를 -1.4~1.4 범위로 계산."""
    base = 0.0
    if any(w in clause for w in POSITIVE_WORDS):
        base = 1.0
    elif any(w in clause for w in NEGATIVE_WORDS):
        base = -1.0
    else:
        return 0.0

    multiplier = 1.0
    for word, factor in INTENSIFIERS.items():
        if word in clause:
            multiplier = max(multiplier, factor)
    for word, factor in DIMINISHERS.items():
        if word in clause:
            multiplier = min(multiplier, factor)
    return base * multiplier


def extract_entities(text: str) -> ExtractedEntities:
    entities = ExtractedEntities()
    clauses = _split_clauses(text) or [text]

    for clause in clauses:
        polarity = _clause_polarity(clause)
        is_exclusion = any(m in clause for m in EXCLUSION_MARKERS)

        for genre, keywords in GENRE_KEYWORDS.items():
            if any(kw in clause for kw in keywords):
                if is_exclusion:
                    entities.excluded_genres.append(genre)
                else:
                    entities.genres.append((genre, polarity if polarity != 0 else 0.5))

        for mood, keywords in MOOD_KEYWORDS.items():
            if any(kw in clause for kw in keywords):
                entities.moods.append((mood, polarity if polarity != 0 else 0.5))

    m = RUNTIME_PATTERN.search(text)
    if m:
        if m.group(1):
            entities.max_runtime = int(m.group(1)) * 60
        elif m.group(3):
            entities.max_runtime = int(m.group(3))

    if "청불" in text and ("빼" in text or "말고" in text or "제외" in text):
        entities.exclude_adult = True

    return entities


def resolve_with_focus(text: str, entities: ExtractedEntities, focus: ConversationFocus) -> ExtractedEntities:
    """지시어("그거"/"나도")가 쓰였고 이번 메시지 자체엔 신호가 없을 때
    Focus에서 값을 채워 넣는다."""
    if entities.genres or entities.moods:
        return entities
    if not any(w in text for w in REFERENCE_WORDS + AGREEMENT_WORDS):
        return entities

    kind, value = _resolve_reference(focus)
    polarity = _clause_polarity(text) or 0.8  # "나도" 류는 긍정으로 취급
    if kind == "genre" and value:
        entities.genres.append((value, polarity))
    elif kind == "mood" and value:
        entities.moods.append((value, polarity))
    return entities


# ---------------------------------------------------------------------------
# 발화 의도 분류
# ---------------------------------------------------------------------------

def classify_intent(text: str, entities: ExtractedEntities) -> Optional[str]:
    if any(w in text for w in QUESTION_MARKERS):
        return "QUESTION"
    if any(w in text for w in AGREEMENT_WORDS):
        return "AGREEMENT"
    if any(w in text for w in REJECTION_WORDS):
        return "REJECTION"
    if entities.genres or entities.moods or entities.excluded_genres:
        return "PREFERENCE_EXPRESS"
    return None


# ---------------------------------------------------------------------------
# 무상태 진입점 (api.py가 쓰는 유일한 함수)
# ---------------------------------------------------------------------------

@dataclass
class AnalysisResult:
    relevant_flag: bool
    relevance_score: float
    intent_code: Optional[str]
    entities_json: Dict
    constraints_json: Dict
    focus_json: Dict
    confidence: float
    normalized_text: Dict
    preference_deltas: List[Dict]


def analyze_message(
    text: str,
    timestamp: datetime,
    prior_focus: Optional[Dict] = None,
    prior_preferences: Optional[List] = None,  # List[preference_eav.PreferenceRow], 순환 import 방지로 타입힌트 생략
) -> AnalysisResult:
    from preference_eav import build_preference_deltas  # 지연 import (순환 방지)

    timestamp = to_aware_utc(timestamp)
    relevant, score = is_relevant(text)
    focus = focus_from_dict(prior_focus)

    if not relevant:
        return AnalysisResult(
            relevant_flag=False,
            relevance_score=score,
            intent_code=None,
            entities_json={},
            constraints_json={},
            focus_json=focus_to_dict(focus),
            confidence=score,
            normalized_text={"text": text},
            preference_deltas=[],
        )

    entities = extract_entities(text)
    entities = resolve_with_focus(text, entities, focus)
    _update_focus(focus, entities, timestamp)
    intent = classify_intent(text, entities)

    deltas = build_preference_deltas(entities, prior_preferences or [], timestamp)

    return AnalysisResult(
        relevant_flag=True,
        relevance_score=score,
        intent_code=intent,
        entities_json={
            "genres": entities.genres,
            "moods": entities.moods,
        },
        constraints_json={
            "max_runtime": entities.max_runtime,
            "exclude_adult": entities.exclude_adult,
            "excluded_genres": entities.excluded_genres,
        },
        focus_json=focus_to_dict(focus),
        confidence=score,
        normalized_text={"text": text},
        preference_deltas=deltas,
    )
