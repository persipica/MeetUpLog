"""
MeetupLog AI Service - FastAPI 엔트리포인트
==================================
기획서 13장 아키텍처의 "AI Service (FastAPI, Python, SBERT/TF-IDF)" 계층.

⚠️ 이번에 Main Backend(Spring Boot) DB 스키마(meetuplog_schema.sql)를 실제로
설계하면서 아키텍처가 한 번 바뀌었다: 이전 버전은 FastAPI가 라운드 전체
메시지 이력을 받아 자체적으로(또는 state_store.py의 Redis로) 상태를 누적
관리했는데, DB 설계를 보니 `message_analyses`/`user_preference_states`
테이블이 이미 메시지 단위·선호 단위 영속화를 MySQL에서 전담하도록 돼 있었다.
그래서 지금은 FastAPI를 완전히 무상태(stateless)로 바꿨다:

  - Main Backend가 메시지 하나가 들어올 때마다 `/analyze-message`를 호출한다.
    그 방의 최신 `message_analyses.focus_json`(prior_focus)과 그 사용자의
    기존 `user_preference_states` 행들(prior_preferences)을 함께 실어 보내면,
    FastAPI는 갱신된 focus_json + 그대로 upsert할 수 있는 preference_deltas를
    돌려준다. Main Backend는 응답을 그대로 DB에 저장하기만 하면 된다.
  - 방장이 "추천받기"를 누르면 Main Backend가 그 방의 `user_preference_states`
    행 전체를 읽어 `/recommend`에 실어 보낸다. FastAPI는 그걸 UserPreferenceState
    로 변환해 TOP-K를 계산해 돌려준다.

FastAPI 프로세스는 재시작되거나 여러 인스턴스로 떠도 문제없다 - 상태는 전부
호출부(Main Backend)가 넘겨주고 돌려받아 DB에 쌓기 때문이다.

실행:
  uvicorn api:app --reload --port 8000
"""

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from models import MODE_EXPLANATION, MovieCandidate
from movie_catalog import MovieCatalog
from nlp_pipeline import analyze_message
from preference_eav import PreferenceRow, eav_rows_to_user_states
from recommendation_engine import recommend

app = FastAPI(title="MeetupLog AI Service")

# 이 분석/추천 로직의 버전 문자열. message_analyses.model_version /
# recommendation_runs.model_version에 그대로 저장된다 - 나중에 로직이 바뀌면
# 이 값을 올려서, 예전 분석 결과와 새 분석 결과를 구분할 수 있게 한다.
MODEL_VERSION = "ml_service-2025.1-rule+tfidf"

# 서버 기동 시 1회 카탈로그 로드 (9장: "서버 시작 또는 데이터 갱신 시 미리 계산")
# 실 배포에서는 pages를 늘리고 enrich_kofic=True로 등급 정보를 보강한다.
_catalog: Optional[MovieCatalog] = None


@app.on_event("startup")
def startup():
    global _catalog
    _catalog = MovieCatalog.bootstrap(pages=5, enrich_kofic=False)


# ---------------------------------------------------------------------------
# 요청/응답 스키마 - 최대한 DB 테이블 컬럼명과 그대로 맞췄다
# (Main Backend 쪽 변환/매핑 코드를 최소화하기 위함)
# ---------------------------------------------------------------------------

class PreferenceRowIn(BaseModel):
    """user_preference_states 한 행. /analyze-message에서는 "그 사용자의
    기존 선호"로, /recommend에서는 "그 방의 선호 전체"로 쓰인다."""
    target_type: str  # MOVIE | GENRE | MOOD | CONSTRAINT
    target_value: str
    polarity: str      # LIKE | DISLIKE | UNCERTAIN
    preference_type: str = "SOFT"  # SOFT | HARD
    strength: float = 1.0
    confidence: float = 1.0
    updated_at: Optional[datetime] = None


class PreferenceDeltaOut(BaseModel):
    """upsert할 user_preference_states 행 하나 (INSERT ... ON DUPLICATE KEY
    UPDATE, unique 키는 preference_unique)."""
    target_type: str
    target_value: str
    polarity: str
    preference_type: str
    strength: float
    confidence: float


class AnalyzeMessageRequest(BaseModel):
    message_id: str
    room_id: str
    user_id: str
    text: str
    sent_at: datetime
    # 그 방의 최신 message_analyses.focus_json (아직 메시지가 없던 방이면 null)
    prior_focus: Optional[Dict] = None
    # 이 발화자의 기존 user_preference_states 행들 (시간가중 블렌딩에 사용)
    prior_preferences: List[PreferenceRowIn] = Field(default_factory=list)


class AnalyzeMessageResponse(BaseModel):
    """message_analyses 테이블 한 행과 거의 1:1 - Main Backend가 그대로
    INSERT하면 된다."""
    relevant_flag: bool
    relevance_score: float
    intent_code: Optional[str]
    entities_json: Dict
    constraints_json: Dict
    focus_json: Dict
    confidence: float
    normalized_text: Dict
    model_version: str
    processing_status: str  # SUCCESS | FAILED
    preference_deltas: List[PreferenceDeltaOut]


class RecommendPreferenceStateIn(PreferenceRowIn):
    user_id: str


class RecommendRequest(BaseModel):
    room_id: str
    round_id: str
    # 그 방 전체의 user_preference_states 행 (여러 사용자 뒤섞여 있음).
    # Main Backend가 DB에서 그대로 SELECT한 결과를 실어 보내면 된다.
    preference_states: List[RecommendPreferenceStateIn] = Field(default_factory=list)
    had_chat_candidates: bool = False


class RecommendResponseItem(BaseModel):
    movie_id: str
    title: str
    poster_path: Optional[str]
    final_score: float
    breakdown: Dict[str, float]
    matched_preferences: List[str]
    evidence_level: str
    user_satisfaction: Dict[str, float]


class RecommendResponse(BaseModel):
    room_id: str
    round_id: str
    mode: str
    mode_explanation: str
    results: List[RecommendResponseItem]


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@app.post("/analyze-message", response_model=AnalyzeMessageResponse)
def analyze_message_endpoint(req: AnalyzeMessageRequest):
    """메시지 1건을 분석한다. Main Backend는 채팅 메시지가 저장될 때마다
    (또는 배치로) 이 엔드포인트를 호출해서 message_analyses에 결과를 쌓고,
    preference_deltas를 user_preference_states에 upsert한다."""
    prior_rows = [
        PreferenceRow(
            user_id=req.user_id,
            target_type=p.target_type,
            target_value=p.target_value,
            polarity=p.polarity,
            preference_type=p.preference_type,
            strength=p.strength,
            confidence=p.confidence,
            updated_at=p.updated_at,
        )
        for p in req.prior_preferences
    ]

    try:
        result = analyze_message(
            req.text,
            timestamp=req.sent_at,
            prior_focus=req.prior_focus,
            prior_preferences=prior_rows,
        )
        return AnalyzeMessageResponse(
            relevant_flag=result.relevant_flag,
            relevance_score=result.relevance_score,
            intent_code=result.intent_code,
            entities_json=result.entities_json,
            constraints_json=result.constraints_json,
            focus_json=result.focus_json,
            confidence=result.confidence,
            normalized_text=result.normalized_text,
            model_version=MODEL_VERSION,
            processing_status="SUCCESS",
            preference_deltas=[PreferenceDeltaOut(**d) for d in result.preference_deltas],
        )
    except Exception:
        # message_analyses.processing_status가 바로 이 실패 케이스를 위해
        # 있는 컬럼이다 - 예외를 500으로 죽이는 대신 "실패했다"는 사실 자체를
        # 구조화된 응답으로 돌려줘서, Main Backend가 이 메시지를 재분석
        # 큐에 넣거나 최소한 기록을 남길 수 있게 한다. Focus는 실패 이전
        # 값을 그대로 돌려줘 다음 메시지 분석이 끊기지 않게 한다.
        return AnalyzeMessageResponse(
            relevant_flag=False,
            relevance_score=0.0,
            intent_code=None,
            entities_json={},
            constraints_json={},
            focus_json=req.prior_focus or {},
            confidence=0.0,
            normalized_text={"text": req.text},
            model_version=MODEL_VERSION,
            processing_status="FAILED",
            preference_deltas=[],
        )


@app.post("/recommend", response_model=RecommendResponse)
def recommend_movies(req: RecommendRequest):
    # 1) EAV 행(user_preference_states 형태) -> UserPreferenceState.
    #    room_id는 이미 요청 컨텍스트로 정해져 있으므로 PreferenceRow에는
    #    담지 않는다(같은 방의 행만 보내는 게 호출부의 책임).
    rows = [
        PreferenceRow(
            user_id=p.user_id,
            target_type=p.target_type,
            target_value=p.target_value,
            polarity=p.polarity,
            preference_type=p.preference_type,
            strength=p.strength,
            confidence=p.confidence,
            updated_at=p.updated_at,
        )
        for p in req.preference_states
    ]
    users = list(eav_rows_to_user_states(rows).values())

    # 2) 카탈로그 대상 추천 계산
    catalog_movies: List[MovieCandidate] = _catalog.all() if _catalog else []
    result = recommend(
        room_id=req.room_id,
        round_id=req.round_id,
        candidates=catalog_movies,
        users=users,
        had_chat_candidates=req.had_chat_candidates,
    )

    items = [
        RecommendResponseItem(
            movie_id=sm.movie.movie_id,
            title=sm.movie.title,
            poster_path=sm.movie.poster_path,
            final_score=sm.final_score,
            breakdown=sm.breakdown,
            matched_preferences=sm.explanation.matched_preferences,
            evidence_level=sm.explanation.evidence_level,
            user_satisfaction={u.user_id: u.satisfaction for u in sm.explanation.user_satisfaction},
        )
        for sm in result.top_k
    ]

    return RecommendResponse(
        room_id=result.room_id,
        round_id=result.round_id,
        mode=result.mode.value,
        mode_explanation=MODE_EXPLANATION[result.mode],
        results=items,
    )


@app.get("/health")
def health():
    return {"status": "ok", "catalog_size": len(_catalog.all()) if _catalog else 0}
