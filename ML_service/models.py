"""데이터 모델 - Preference State, Movie, 추천 결과 등."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


@dataclass
class ScoredSignal:
    """시간가중 블렌딩에 쓰이는 개별 신호 (점수 -1~1, 발생 시각)."""
    score: float
    timestamp: datetime
    source_message_id: Optional[str] = None


@dataclass
class Constraints:
    max_runtime: Optional[int] = None       # 분 단위, 이 값 이하만 허용
    exclude_adult: bool = False
    min_rating: Optional[float] = None
    excluded_genres: List[str] = field(default_factory=list)  # HARD 제외


@dataclass
class UserPreferenceState:
    """한 사용자의 선호 상태 (장르/무드/영화별 -1~1 점수 + 제약)."""
    user_id: str
    genres: Dict[str, float] = field(default_factory=dict)
    moods: Dict[str, float] = field(default_factory=dict)
    movies: Dict[str, float] = field(default_factory=dict)
    constraints: Constraints = field(default_factory=Constraints)

    # 시간가중 블렌딩용 원시 신호 이력 (외부에 노출하지 않고 내부적으로만 사용)
    _genre_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict, repr=False)
    _mood_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict, repr=False)
    _movie_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict, repr=False)


@dataclass
class MovieCandidate:
    movie_id: str
    title: str
    original_title: str
    genres: List[str]
    overview: str
    popularity: float
    vote_average: float
    runtime: Optional[int]
    adult: bool
    poster_path: Optional[str]
    release_date: Optional[str]
    mood_tags: List[str] = field(default_factory=list)


class RecommendationMode(str, Enum):
    CONSENSUS = "CONSENSUS"
    PREFERENCE_DISCOVERY = "PREFERENCE_DISCOVERY"
    CONFLICT_DISCOVERY = "CONFLICT_DISCOVERY"
    LOW_EVIDENCE_DISCOVERY = "LOW_EVIDENCE_DISCOVERY"


MODE_EXPLANATION = {
    RecommendationMode.CONSENSUS: "그룹 취향이 뚜렷하게 일치해요.",
    RecommendationMode.PREFERENCE_DISCOVERY: "몇몇 취향은 뚜렷하지만 아직 안 겹치는 부분이 있어요.",
    RecommendationMode.CONFLICT_DISCOVERY: "취향이 갈려서 절충안을 찾았어요.",
    RecommendationMode.LOW_EVIDENCE_DISCOVERY: "아직 취향 정보가 부족해서 인기작 위주로 추천해요.",
}


@dataclass
class RecommendationExplanation:
    matched_preferences: List[str]
    evidence_level: str  # HIGH | MEDIUM | LOW
    user_satisfaction: List["UserSatisfaction"]


@dataclass
class UserSatisfaction:
    user_id: str
    satisfaction: float  # 0~1


@dataclass
class ScoredMovie:
    movie: MovieCandidate
    final_score: float
    breakdown: Dict[str, float]
    explanation: RecommendationExplanation


@dataclass
class RecommendationResult:
    room_id: str
    round_id: str
    mode: RecommendationMode
    top_k: List[ScoredMovie]
