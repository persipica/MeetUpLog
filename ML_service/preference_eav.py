"""
user_preference_states(EAV 행) <-> UserPreferenceState(dict) 변환, 그리고
메시지에서 새로 뽑힌 신호를 DB의 기존 값과 시간가중 블렌딩하는 로직.

EAV 행 하나 = (target_type, target_value, polarity, preference_type, strength,
confidence, updated_at). Main Backend가 DB에서 그대로 읽어 보내고, 여기서
UserPreferenceState(dict 기반 모델)로 접었다 펼쳤다 한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import ML_service.config as config
from ML_service.models import Constraints, UserPreferenceState
from ML_service.nlp_pipeline import ExtractedEntities
from ML_service.time_utils import to_aware_utc


@dataclass
class PreferenceRow:
    target_type: str        # MOVIE | GENRE | MOOD | CONSTRAINT
    target_value: str
    polarity: str            # LIKE | DISLIKE | UNCERTAIN
    preference_type: str = "SOFT"   # SOFT | HARD
    strength: float = 1.0
    confidence: float = 1.0
    updated_at: Optional[datetime] = None
    user_id: Optional[str] = None   # /recommend에서 여러 사용자 뒤섞여 올 때만 사용


def _polarity_to_score(polarity: str, strength: float) -> float:
    if polarity == "LIKE":
        return strength
    if polarity == "DISLIKE":
        return -strength
    return 0.0


def _score_to_polarity(score: float) -> str:
    if score > 0.15:
        return "LIKE"
    if score < -0.15:
        return "DISLIKE"
    return "UNCERTAIN"


def eav_rows_to_user_states(rows: List[PreferenceRow]) -> Dict[str, UserPreferenceState]:
    """/recommend용: 여러 사용자의 EAV 행을 UserPreferenceState 맵으로 변환."""
    states: Dict[str, UserPreferenceState] = {}
    for row in rows:
        uid = row.user_id or "unknown"
        state = states.setdefault(uid, UserPreferenceState(user_id=uid))
        score = _polarity_to_score(row.polarity, row.strength)

        if row.target_type == "GENRE":
            state.genres[row.target_value] = score
        elif row.target_type == "MOOD":
            state.moods[row.target_value] = score
        elif row.target_type == "MOVIE":
            state.movies[row.target_value] = score
        elif row.target_type == "CONSTRAINT":
            _apply_constraint(state.constraints, row)
    return states


def _apply_constraint(constraints: Constraints, row: PreferenceRow) -> None:
    """CONSTRAINT 행은 target_value를 'key:value' 문자열로 인코딩한다
    (DB에 제약 전용 컬럼이 없어 나온 임시 규약 - 팀과 스키마 확정 필요)."""
    if ":" not in row.target_value:
        return
    key, value = row.target_value.split(":", 1)
    if key == "max_runtime":
        constraints.max_runtime = int(value)
    elif key == "exclude_adult":
        constraints.exclude_adult = value.lower() == "true"
    elif key == "min_rating":
        constraints.min_rating = float(value)
    elif key == "excluded_genre":
        constraints.excluded_genres.append(value)


def _time_weight(updated_at: Optional[datetime], now: datetime) -> float:
    if updated_at is None:
        return 1.0
    days = (now - to_aware_utc(updated_at)).total_seconds() / 86400
    half_life = config.TIME_DECAY_HALF_LIFE_DAYS
    return 0.5 ** (days / half_life) if half_life > 0 else 1.0


def build_preference_deltas(
    entities: ExtractedEntities,
    prior_preferences: List[PreferenceRow],
    timestamp: datetime,
) -> List[Dict]:
    """새 메시지의 신호를 기존 행과 시간가중 블렌딩해 upsert용 델타 목록을 만든다.

    온라인 근사: 기존 값에 시간감쇠를 곱한 뒤 새 신호와 가중평균한다. 원본
    히스토리를 전부 재계산하는 것과 100% 동일하진 않지만, 매 메시지마다
    DB 히스토리 전체를 다시 읽지 않아도 되는 실용적 근사치다.
    """
    now = to_aware_utc(timestamp)
    prior_by_key = {(p.target_type, p.target_value): p for p in prior_preferences}
    deltas: List[Dict] = []

    def _blend(target_type: str, target_value: str, new_score: float):
        prior = prior_by_key.get((target_type, target_value))
        if prior is None:
            blended = new_score
        else:
            w = _time_weight(prior.updated_at, now)
            prior_score = _polarity_to_score(prior.polarity, prior.strength)
            blended = (prior_score * w + new_score) / (w + 1)
        blended = max(-1.0, min(1.0, blended))
        deltas.append({
            "target_type": target_type,
            "target_value": target_value,
            "polarity": _score_to_polarity(blended),
            "preference_type": "SOFT",
            "strength": abs(blended),
            "confidence": min(1.0, 0.6 + 0.4 * abs(blended)),
        })

    for genre, score in entities.genres:
        _blend("GENRE", genre, score)
    for mood, score in entities.moods:
        _blend("MOOD", mood, score)
    for genre in entities.excluded_genres:
        deltas.append({
            "target_type": "CONSTRAINT",
            "target_value": f"excluded_genre:{genre}",
            "polarity": "DISLIKE",
            "preference_type": "HARD",
            "strength": 1.0,
            "confidence": 1.0,
        })
    if entities.max_runtime is not None:
        deltas.append({
            "target_type": "CONSTRAINT",
            "target_value": f"max_runtime:{entities.max_runtime}",
            "polarity": "UNCERTAIN",
            "preference_type": "HARD",
            "strength": 1.0,
            "confidence": 1.0,
        })
    if entities.exclude_adult:
        deltas.append({
            "target_type": "CONSTRAINT",
            "target_value": "exclude_adult:true",
            "polarity": "UNCERTAIN",
            "preference_type": "HARD",
            "strength": 1.0,
            "confidence": 1.0,
        })

    return deltas
