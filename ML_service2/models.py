"""
MeetupLog AI Service - 데이터 모델
==================================
기획서 10장의 Preference State 예시, 12장 UX 노출 정보,
8장 FR-AI 요구사항에 대응하는 내부 데이터 구조.
"""

from dataclasses import dataclass, field
from datetime import datetime

from time_utils import utc_now
from enum import Enum
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# 사용자별 선호 상태 (Preference State)
# ---------------------------------------------------------------------------

@dataclass
class Constraints:
    """FR-AI-03 제약조건. HARD 조건은 추천에서 강제 제외된다."""
    max_runtime: Optional[int] = None       # 분 단위, 상한
    exclude_adult: bool = False             # 성인/청불 제외 여부
    min_rating: Optional[float] = None      # 평점 하한
    excluded_genres: List[str] = field(default_factory=list)  # HARD 비선호 장르


@dataclass
class ScoredSignal:
    """장르/무드/영화에 대한 사용자 발화 1건의 흔적.
    시간 가중치 계산을 위해 발화 시각을 함께 보관한다."""
    score: float                 # -1.0(강한 비선호) ~ +1.0(강한 선호)
    timestamp: datetime
    source_message_id: Optional[str] = None


@dataclass
class UserPreferenceState:
    """기획서 10장 Preference State JSON 예시에 대응.

    genres / moods / movies 는 "속성명 -> 시간가중 평균 점수" 로
    이미 합산된 값을 노출용으로 들고 있고,
    _signals 에는 원본 발화 히스토리를 모두 보관해 재계산에 사용한다.
    """
    user_id: str
    genres: Dict[str, float] = field(default_factory=dict)
    moods: Dict[str, float] = field(default_factory=dict)
    movies: Dict[str, float] = field(default_factory=dict)
    constraints: Constraints = field(default_factory=Constraints)

    # 원본 히스토리 (시간 가중치 재계산용, FR-AI-06)
    _genre_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict)
    _mood_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict)
    _movie_signals: Dict[str, List[ScoredSignal]] = field(default_factory=dict)

    def to_summary_dict(self) -> dict:
        """FR-AI-08 추천 설명 및 마이페이지 '본인 선호 요약'(NFR-10)에 노출."""
        return {
            "userId": self.user_id,
            "genres": self.genres,
            "moods": self.moods,
            "movies": self.movies,
            "constraints": {
                "maxRuntime": self.constraints.max_runtime,
                "excludeAdult": self.constraints.exclude_adult,
                "minRating": self.constraints.min_rating,
                "excludedGenres": self.constraints.excluded_genres,
            },
        }

    def has_evidence(self) -> bool:
        """PREFERENCE_DISCOVERY / LOW_EVIDENCE_DISCOVERY 모드 판단에 사용."""
        return bool(self.genres or self.moods)


# ---------------------------------------------------------------------------
# 영화 카탈로그 (TMDB + KOFIC 결합)
# ---------------------------------------------------------------------------

@dataclass
class MovieCandidate:
    movie_id: str                      # TMDB id (문자열로 통일)
    title: str
    overview: str = ""
    genres: List[str] = field(default_factory=list)
    moods: List[str] = field(default_factory=list)   # 파생 무드 태그
    runtime: Optional[int] = None      # 분
    popularity: float = 0.0            # TMDB popularity (정규화 전)
    vote_average: float = 0.0          # 0~10
    is_adult: bool = False
    age_rating: Optional[str] = None   # KOFIC watchGradeNm 등
    poster_path: Optional[str] = None
    release_year: Optional[int] = None       # TMDB release_date 앞 4자리
    production_companies: List[str] = field(default_factory=list)  # TMDB 상세조회 시에만 채워짐
    source: str = "catalog"            # "catalog" | "chat_candidate"


# ---------------------------------------------------------------------------
# 추천 결과
# ---------------------------------------------------------------------------

class RecommendationMode(str, Enum):
    CONSENSUS = "CONSENSUS"
    PREFERENCE_DISCOVERY = "PREFERENCE_DISCOVERY"
    CONFLICT_DISCOVERY = "CONFLICT_DISCOVERY"
    LOW_EVIDENCE_DISCOVERY = "LOW_EVIDENCE_DISCOVERY"


MODE_EXPLANATION = {
    RecommendationMode.CONSENSUS: "직접 제안된 영화 중 합의가 높은 영화를 우선했습니다.",
    RecommendationMode.PREFERENCE_DISCOVERY: "직접 후보는 없었지만 충분히 수집된 취향으로 새 후보를 탐색했습니다.",
    RecommendationMode.CONFLICT_DISCOVERY: "기존 후보들 사이에 찬반/제약 충돌이 있어 조건에 맞는 대체 후보를 찾았습니다.",
    RecommendationMode.LOW_EVIDENCE_DISCOVERY: "직접 후보와 취향 데이터가 모두 부족해 평점·대중성을 보조 기준으로 사용했습니다.",
}


@dataclass
class UserSatisfactionBreakdown:
    user_id: str
    satisfaction: float                 # 0~1, 이 영화에 대한 개인 만족도 추정치
    matched_preferences: List[str]       # 반영된 선호 태그
    violated_constraints: List[str]      # 제외/감점 사유 (HARD 위반 시 이 영화는 후보에서 제외)


@dataclass
class RecommendationExplanation:
    mode: RecommendationMode
    evidence_level: str                  # "HIGH" | "MEDIUM" | "LOW"
    matched_preferences: List[str]
    excluded_reasons: List[str]
    user_satisfaction: List[UserSatisfactionBreakdown]


@dataclass
class ScoredMovie:
    movie: MovieCandidate
    final_score: float
    breakdown: Dict[str, float]          # 요소별 점수 (가중치 반영 전/후)
    explanation: RecommendationExplanation


@dataclass
class RecommendationResult:
    room_id: str
    round_id: str
    mode: RecommendationMode
    top_k: List[ScoredMovie]
    generated_at: datetime = field(default_factory=utc_now)
