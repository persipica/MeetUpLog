"""
MeetupLog AI Service - State 영속화 (Round Store) - ⚠️ 옵션/레거시 경로

이 모듈은 원래 "FastAPI 프로세스가 라운드 상태를 직접 들고 있어야 한다"는
가정 아래 만들었다(알려진 한계 #2 대응). 그런데 이후 Main Backend(Spring
Boot) DB 스키마를 실제로 설계해보니, `message_analyses`/`user_preference_states`
테이블이 이미 메시지 단위·선호 단위 영속화를 MySQL에서 전담하도록 만들어져
있었다 - 즉 "상태를 어디서 들고 있을 것인가"의 정답은 이 Redis/인메모리
저장소가 아니라 Main Backend의 DB였다.

그래서 지금 시점의 정식 경로는 nlp_pipeline.analyze_message()를 쓰는
무상태(stateless) `/analyze-message` + `/recommend` 조합이다(api.py 참고):
Main Backend가 이전 Focus/선호 상태를 DB에서 읽어 요청에 실어 보내고,
ml_service는 계산만 해서 갱신된 조각을 돌려준다.

이 모듈(RoundState/StateStore/Redis)은 api.py의 기본 경로에서는 더 이상
쓰이지 않는다. 다만 다음 경우엔 여전히 쓸모가 있어 남겨뒀다:
  - Main Backend 없이 ml_service 단독으로 데모/로드테스트할 때
  - 나중에 "매 메시지마다 DB 왕복하기엔 느리니 방 단위로 잠깐 캐시하고
    싶다"는 성능 최적화가 필요해질 때(그때도 DB가 최종 정답이고 이건
    캐시일 뿐이어야 한다 - 캐시가 유실돼도 DB에서 다시 채울 수 있어야 함)

(room_id, round_id) 단위로 "라운드 상태"(RoundState)를 저장/조회하는 아주
얇은 저장소 인터페이스(StateStore)를 제공한다.

  - InMemoryStateStore : 기본값. 프로세스 dict.
  - RedisStateStore    : config.ENABLE_REDIS_STATE_STORE=true 일 때 사용.
    redis-py에만 의존하고(요청 시점에 지연 import), JSON으로 직렬화해
    round_id 단위 TTL(config.STATE_TTL_SECONDS)로 저장한다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set

import config
from models import Constraints, ScoredSignal, UserPreferenceState
from nlp_pipeline import ConversationFocus, focus_from_dict, focus_to_dict
from time_utils import to_aware_utc


@dataclass
class RoundState:
    """한 (room_id, round_id)에 대해 저장/복원해야 하는 전체 상태."""
    users: Dict[str, UserPreferenceState] = field(default_factory=dict)
    focus: ConversationFocus = field(default_factory=ConversationFocus)
    # 이미 State에 반영한 message_id 집합. Main Backend가 누적 이력을 매번
    # 통째로 다시 보내는 방식이든, 증분만 보내는 방식이든 둘 다 안전하게
    # 처리하기 위한 dedup 키.
    processed_message_ids: Set[str] = field(default_factory=set)


# ---------------------------------------------------------------------------
# 직렬화 (dataclass <-> JSON-호환 dict)
# ---------------------------------------------------------------------------

def _dt_to_iso(dt: Optional[datetime]) -> Optional[str]:
    return to_aware_utc(dt).isoformat() if dt else None


def _dt_from_iso(s: Optional[str]) -> Optional[datetime]:
    return to_aware_utc(datetime.fromisoformat(s)) if s else None


def _signals_to_list(signals: List[ScoredSignal]) -> list:
    return [
        {"score": s.score, "timestamp": _dt_to_iso(s.timestamp), "source_message_id": s.source_message_id}
        for s in signals
    ]


def _signals_from_list(items: list) -> List[ScoredSignal]:
    return [
        ScoredSignal(score=i["score"], timestamp=_dt_from_iso(i["timestamp"]), source_message_id=i.get("source_message_id"))
        for i in items
    ]


def user_state_to_dict(state: UserPreferenceState) -> dict:
    return {
        "user_id": state.user_id,
        "genres": state.genres,
        "moods": state.moods,
        "movies": state.movies,
        "constraints": {
            "max_runtime": state.constraints.max_runtime,
            "exclude_adult": state.constraints.exclude_adult,
            "min_rating": state.constraints.min_rating,
            "excluded_genres": state.constraints.excluded_genres,
        },
        "genre_signals": {k: _signals_to_list(v) for k, v in state._genre_signals.items()},
        "mood_signals": {k: _signals_to_list(v) for k, v in state._mood_signals.items()},
        "movie_signals": {k: _signals_to_list(v) for k, v in state._movie_signals.items()},
    }


def user_state_from_dict(d: dict) -> UserPreferenceState:
    state = UserPreferenceState(
        user_id=d["user_id"],
        genres=dict(d.get("genres", {})),
        moods=dict(d.get("moods", {})),
        movies=dict(d.get("movies", {})),
        constraints=Constraints(
            max_runtime=d.get("constraints", {}).get("max_runtime"),
            exclude_adult=d.get("constraints", {}).get("exclude_adult", False),
            min_rating=d.get("constraints", {}).get("min_rating"),
            excluded_genres=list(d.get("constraints", {}).get("excluded_genres", [])),
        ),
    )
    state._genre_signals = {k: _signals_from_list(v) for k, v in d.get("genre_signals", {}).items()}
    state._mood_signals = {k: _signals_from_list(v) for k, v in d.get("mood_signals", {}).items()}
    state._movie_signals = {k: _signals_from_list(v) for k, v in d.get("movie_signals", {}).items()}
    return state


# (Focus 직렬화는 nlp_pipeline.py가 정본이다 - 무상태 /analyze-message
# 경로와 공유하기 위해 그쪽으로 옮겼고, 여기서는 위에서 import해 재사용만 한다.)


def round_state_to_json(rs: RoundState) -> str:
    return json.dumps({
        "users": {uid: user_state_to_dict(s) for uid, s in rs.users.items()},
        "focus": focus_to_dict(rs.focus),
        "processed_message_ids": sorted(rs.processed_message_ids),
    }, ensure_ascii=False)


def round_state_from_json(raw: str) -> RoundState:
    d = json.loads(raw)
    return RoundState(
        users={uid: user_state_from_dict(s) for uid, s in d.get("users", {}).items()},
        focus=focus_from_dict(d.get("focus", {})),
        processed_message_ids=set(d.get("processed_message_ids", [])),
    )


# ---------------------------------------------------------------------------
# 저장소 구현체
# ---------------------------------------------------------------------------

def _round_key(room_id: str, round_id: str) -> str:
    return f"meetuplog:round:{room_id}:{round_id}"


class StateStore:
    """저장소 인터페이스. get()은 없으면 None, save()는 성공 여부와 무관하게
    저장을 시도한다(RedisStateStore는 실패 시 예외를 던진다 - 상태 유실을
    조용히 감추지 않기 위함)."""

    def get(self, room_id: str, round_id: str) -> Optional[RoundState]:
        raise NotImplementedError

    def save(self, room_id: str, round_id: str, state: RoundState) -> None:
        raise NotImplementedError


class InMemoryStateStore(StateStore):
    """기본 저장소. 프로세스 재시작/다중 인스턴스에서는 유실되지만, 단일
    프로세스 안에서는 라운드 상태를 정상적으로 이어간다(로컬 개발/데모/테스트용).
    """

    def __init__(self):
        self._store: Dict[str, RoundState] = {}

    def get(self, room_id: str, round_id: str) -> Optional[RoundState]:
        return self._store.get(_round_key(room_id, round_id))

    def save(self, room_id: str, round_id: str, state: RoundState) -> None:
        self._store[_round_key(room_id, round_id)] = state


class RedisStateStore(StateStore):
    """Redis 기반 저장소. 서버 재시작·다중 인스턴스 환경에서도 라운드
    상태가 유지된다. redis-py는 opt-in 의존성이라 여기서만 import한다."""

    def __init__(self, url: Optional[str] = None, ttl_seconds: Optional[int] = None):
        import redis  # 지연 import: ENABLE_REDIS_STATE_STORE=false면 설치 불필요

        self._client = redis.Redis.from_url(url or config.REDIS_URL, decode_responses=True)
        self._ttl = ttl_seconds if ttl_seconds is not None else config.STATE_TTL_SECONDS

    def get(self, room_id: str, round_id: str) -> Optional[RoundState]:
        raw = self._client.get(_round_key(room_id, round_id))
        if raw is None:
            return None
        return round_state_from_json(raw)

    def save(self, room_id: str, round_id: str, state: RoundState) -> None:
        raw = round_state_to_json(state)
        key = _round_key(room_id, round_id)
        if self._ttl and self._ttl > 0:
            self._client.set(key, raw, ex=self._ttl)
        else:
            self._client.set(key, raw)


_default_store: Optional[StateStore] = None


def get_default_store() -> StateStore:
    """config.ENABLE_REDIS_STATE_STORE에 따라 Redis 또는 인메모리 저장소를
    돌려주는 앱 전역 싱글턴. Redis 연결 자체에 실패하면(호스트 다운 등)
    예외를 그대로 올린다 - "상태 저장이 되는 줄 알았는데 사실 인메모리였다"
    같은 조용한 오류보다, 배포 설정 문제를 기동 시점에 바로 드러내는 편이
    안전하다고 판단했다."""
    global _default_store
    if _default_store is None:
        if config.ENABLE_REDIS_STATE_STORE:
            _default_store = RedisStateStore()
        else:
            _default_store = InMemoryStateStore()
    return _default_store
