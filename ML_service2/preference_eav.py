"""
MeetupLog AI Service - user_preference_states EAV 변환
==================================
Main Backend(Spring Boot)의 `user_preference_states` 테이블은 EAV
(Entity-Attribute-Value) 형태다: 한 사용자의 선호 하나마다 행이 하나씩 있고
(room_id, user_id, target_type, target_value)로 유일하게 식별된다. 이 테이블은
"현재 값"만 들고 있고(각 조합당 최신 1행), nlp_pipeline.py의 UserPreferenceState
처럼 원본 발화 히스토리(_genre_signals 등)를 통째로 들고 있지 않다.

이 모듈은 그 간극을 메운다:

1) EAV 행 목록 -> UserPreferenceState (recommendation_engine이 바로 쓸 수 있는 형태)
   `/recommend` 요청 시, Main Backend가 해당 방의 user_preference_states 행을
   전부 읽어 보내면 이 함수로 변환한다.

2) 메시지 1건에서 추출된 신호 + (있다면) 그 대상의 기존 DB 값(prior) -> 갱신된
   (strength, confidence) 한 쌍
   DB가 원본 히스토리를 보관하지 않으므로, nlp_pipeline.py가 예전에 하던
   "모든 신호를 모아 시간가중 평균"을 매번 다시 계산할 수 없다. 대신 "기존
   집계값(더 오래될수록 가중치가 깎임) + 새 신호(항상 가중치 1)"를 한 번만
   섞는 온라인(increment) 갱신으로 근사한다 - 지수가중이동평균(EMA)과
   동일한 아이디어이며, 결과가 과거의 "전체 히스토리 시간가중 평균"과
   수학적으로 100% 동일하지는 않다는 점을 분명히 밝혀둔다(실제로는 아주
   비슷하게 수렴한다).

DB 컬럼 규약 (테이블 정의서에 없어 여기서 정한 것들, 검토 필요):
  - strength(DECIMAL(5,4))는 부호 없는 "강도"만 담는다(0~1). 부호(선호/비선호)
    는 polarity(LIKE/DISLIKE/UNCERTAIN) 컬럼이 따로 담당한다. ml_service
    내부에서는 signed score(-1.0~+1.0) 하나로 다루므로 이 모듈이 양방향
    변환을 전담한다.
  - target_type=CONSTRAINT일 때 target_value는 "키:값" 문자열이다
    (예: "max_runtime:120", "exclude_adult:true", "min_rating:7.0"). 정수/
    실수형 제약값을 strength(최대 9.9999)에 담기엔 범위가 안 맞고 별도
    "제약값" 컬럼도 없어서 이렇게 정했다 - 다른 규약이 이미 있다면 이 모듈의
    CONSTRAINT_* 헬퍼만 바꾸면 된다.
  - HARD 비선호 장르("액션 빼고")는 별도 CONSTRAINT 행이 아니라
    target_type=GENRE + preference_type=HARD + polarity=DISLIKE 조합으로
    표현한다 - recommendation_engine이 HARD 제약 필터링에 그대로 쓴다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models import UserPreferenceState
from nlp_pipeline import time_weight
from time_utils import utc_now

# ---------------------------------------------------------------------------
# target_type 상수
# ---------------------------------------------------------------------------

TARGET_TYPE_MOVIE = "MOVIE"
TARGET_TYPE_GENRE = "GENRE"
TARGET_TYPE_MOOD = "MOOD"
TARGET_TYPE_ACTOR = "ACTOR"
TARGET_TYPE_CONSTRAINT = "CONSTRAINT"

POLARITY_LIKE = "LIKE"
POLARITY_DISLIKE = "DISLIKE"
POLARITY_UNCERTAIN = "UNCERTAIN"

PREFERENCE_TYPE_SOFT = "SOFT"
PREFERENCE_TYPE_HARD = "HARD"

# CONSTRAINT target_value의 "키" 이름 (target_value = f"{key}:{value}")
CONSTRAINT_KEY_MAX_RUNTIME = "max_runtime"
CONSTRAINT_KEY_EXCLUDE_ADULT = "exclude_adult"
CONSTRAINT_KEY_MIN_RATING = "min_rating"


@dataclass
class PreferenceRow:
    """user_preference_states 한 행에 대응. room_id는 요청/응답 어느 쪽에서든
    이미 컨텍스트로 정해져 있어(한 방 안에서만 쓰이므로) 필드에 넣지 않았다."""
    user_id: str
    target_type: str
    target_value: str
    polarity: str
    preference_type: str = PREFERENCE_TYPE_SOFT
    strength: float = 1.0          # 0~1, 부호 없음
    confidence: float = 1.0        # 0~1
    updated_at: Optional[datetime] = None
    source_message_id: Optional[str] = None


def _signed_score(polarity: str, strength: float) -> float:
    """polarity + strength(부호 없음) -> signed score(-1~+1)."""
    magnitude = max(0.0, min(1.0, strength))
    if polarity == POLARITY_LIKE:
        return magnitude
    if polarity == POLARITY_DISLIKE:
        return -magnitude
    return 0.0  # UNCERTAIN


def _polarity_and_strength(signed_score: float) -> Tuple[str, float]:
    """signed score(-1~+1) -> (polarity, strength(부호 없음))."""
    magnitude = max(0.0, min(1.0, abs(signed_score)))
    if signed_score > 0:
        return POLARITY_LIKE, magnitude
    if signed_score < 0:
        return POLARITY_DISLIKE, magnitude
    return POLARITY_UNCERTAIN, 0.0


def format_constraint_value(key: str, value) -> str:
    return f"{key}:{value}"


def parse_constraint_value(target_value: str) -> Tuple[str, str]:
    key, _, value = target_value.partition(":")
    return key, value


# ---------------------------------------------------------------------------
# 1) EAV 행 목록 -> UserPreferenceState (여러 사용자 뒤섞여 있어도 user_id로 분리)
# ---------------------------------------------------------------------------

def eav_rows_to_user_states(rows: List[PreferenceRow]) -> Dict[str, UserPreferenceState]:
    """방 하나에 속한 EAV 행 전체(여러 사용자 뒤섞임)를 user_id별
    UserPreferenceState로 묶어 돌려준다. recommendation_engine.recommend()의
    users 인자로 바로 넘기면 된다."""
    states: Dict[str, UserPreferenceState] = {}

    for row in rows:
        state = states.setdefault(row.user_id, UserPreferenceState(user_id=row.user_id))
        score = _signed_score(row.polarity, row.strength)

        if row.target_type == TARGET_TYPE_GENRE:
            state.genres[row.target_value] = round(score, 4)
            if row.preference_type == PREFERENCE_TYPE_HARD and row.polarity == POLARITY_DISLIKE:
                if row.target_value not in state.constraints.excluded_genres:
                    state.constraints.excluded_genres.append(row.target_value)
        elif row.target_type == TARGET_TYPE_MOOD:
            state.moods[row.target_value] = round(score, 4)
        elif row.target_type == TARGET_TYPE_MOVIE:
            state.movies[row.target_value] = round(score, 4)
        elif row.target_type == TARGET_TYPE_ACTOR:
            state.actors[row.target_value] = round(score, 4)
        elif row.target_type == TARGET_TYPE_CONSTRAINT:
            key, value = parse_constraint_value(row.target_value)
            if key == CONSTRAINT_KEY_MAX_RUNTIME:
                try:
                    state.constraints.max_runtime = int(value)
                except ValueError:
                    pass
            elif key == CONSTRAINT_KEY_EXCLUDE_ADULT:
                state.constraints.exclude_adult = value.lower() == "true"
            elif key == CONSTRAINT_KEY_MIN_RATING:
                try:
                    state.constraints.min_rating = float(value)
                except ValueError:
                    pass

    return states


# ---------------------------------------------------------------------------
# 2) 메시지 1건의 신호 + 기존 DB 값(prior) -> 갱신된 (strength, confidence)
# ---------------------------------------------------------------------------

def blend_preference_update(
    new_signed_score: float,
    new_confidence: float,
    prior: Optional[PreferenceRow],
    now: Optional[datetime] = None,
) -> Tuple[float, float]:
    """기존 DB 값(prior, 없으면 None)에 새 신호를 섞어 갱신된
    (signed_score, confidence)를 반환한다.

    prior가 없으면(처음 언급) 새 신호를 그대로 채택한다.
    prior가 있으면, prior가 마지막으로 갱신된 시각으로부터 지난 시간만큼
    time_weight()로 감쇠시킨 뒤, "감쇠된 기존값"과 "가중치 1인 새 신호"를
    가중평균한다 - nlp_pipeline._weighted_average()가 원본 히스토리 전체로
    하던 계산을, 히스토리 없이 최신 집계값만으로 근사한 버전이다.
    """
    now = now or utc_now()
    if prior is None:
        return new_signed_score, new_confidence

    prior_score = _signed_score(prior.polarity, prior.strength)
    prior_weight = time_weight(prior.updated_at, now) if prior.updated_at else 0.0
    new_weight = 1.0

    total_weight = prior_weight + new_weight
    if total_weight <= 0:
        return new_signed_score, new_confidence

    blended_score = (prior_weight * prior_score + new_weight * new_signed_score) / total_weight
    blended_confidence = (prior_weight * prior.confidence + new_weight * new_confidence) / total_weight

    return round(blended_score, 4), round(min(1.0, blended_confidence), 4)


@dataclass
class PreferenceDelta:
    """메시지 1건을 분석해서 나온, upsert할 EAV 행 하나.
    Main Backend는 이걸 그대로 user_preference_states에 upsert하면 된다
    (INSERT ... ON DUPLICATE KEY UPDATE, unique 키는 preference_unique)."""
    target_type: str
    target_value: str
    polarity: str
    strength: float
    confidence: float
    preference_type: str = PREFERENCE_TYPE_SOFT


def build_preference_delta(
    target_type: str,
    target_value: str,
    new_signed_score: float,
    new_confidence: float,
    prior_by_target: Dict[Tuple[str, str], PreferenceRow],
    preference_type: str = PREFERENCE_TYPE_SOFT,
    now: Optional[datetime] = None,
) -> PreferenceDelta:
    prior = prior_by_target.get((target_type, target_value))
    blended_score, blended_confidence = blend_preference_update(new_signed_score, new_confidence, prior, now)
    polarity, strength = _polarity_and_strength(blended_score)
    return PreferenceDelta(
        target_type=target_type,
        target_value=target_value,
        polarity=polarity,
        strength=strength,
        confidence=blended_confidence,
        preference_type=preference_type,
    )
