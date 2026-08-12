"""
MeetupLog AI Service - FastAPI 엔트리포인트 (v2, 백지 재설계)
==================================
기획서 13장 "AI Service" 계층. 상태는 전부 Main Backend의 DB
(`message_analyses`/`user_preference_states`)가 들고 있고, 이 서비스는
완전히 무상태(stateless)다:

  - Main Backend가 메시지 하나가 들어올 때마다 `/analyze-message`를 호출한다.
    그 방의 최신 focus_json(prior_focus)과 그 사용자의 기존 선호
    (prior_preferences)를 함께 실어 보내면, 갱신된 focus_json +
    upsert할 preference_deltas를 돌려준다.
  - 방장이 "추천받기"를 누르면 Main Backend가 그 방의 선호 전체를
    `/recommend`에 실어 보낸다.

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

MODEL_VERSION = "ml_service-2026.1-rule+tfidf"

_catalog: Optional[MovieCatalog] = None


@app.on_event("startup")
def startup():
    global _catalog
    _catalog = MovieCatalog.bootstrap(pages=5)


# ---------------------------------------------------------------------------
# 요청/응답 스키마 - DB 테이블 컬럼명과 최대한 맞춤
# ---------------------------------------------------------------------------

class PreferenceRowIn(BaseModel):
    target_type: str
    target_value: str
    polarity: str
    preference_type: str = "SOFT"
    strength: float = 1.0
    confidence: float = 1.0
    updated_at: Optional[datetime] = None


class PreferenceDeltaOut(BaseModel):
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
    prior_focus: Optional[Dict] = None
    prior_preferences: List[PreferenceRowIn] = Field(default_factory=list)


class AnalyzeMessageResponse(BaseModel):
    relevant_flag: bool
    relevance_score: float
    intent_code: Optional[str]
    entities_json: Dict
    constraints_json: Dict
    focus_json: Dict
    confidence: float
    normalized_text: Dict
    model_version: str
    processing_status: str
    preference_deltas: List[PreferenceDeltaOut]


class RecommendPreferenceStateIn(PreferenceRowIn):
    user_id: str


class RecommendRequest(BaseModel):
    room_id: str
    round_id: str
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
