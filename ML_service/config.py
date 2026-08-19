"""
MeetupLog AI Service - 환경설정 (v2, 백지 재설계)
==================================
v1과 달리 검증되지 않은 무거운 옵션(ET5/ElectraSpacer/SBERT/KcELECTRA/
Redis state store/코퍼스 사전)을 전부 제거했다. 필요해지면 그때 다시
추가하되, "opt-in으로 만들어두고 안 켠다"가 아니라 "실측 검증 후에만
코드에 들어온다"는 원칙으로 간다.

키는 저장소에 커밋되지 않는 `.env` 파일 또는 서버 환경변수로만 주입한다.
    cp .env.example .env
    export TMDB_API_KEY="..."
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def require_key(name: str, value: str) -> str:
    """API 키가 실제로 필요한 호출 직전에만 불러 명확한 에러를 낸다."""
    if not value:
        raise RuntimeError(
            f"{name}가 설정되지 않았습니다. .env 또는 환경변수로 {name}를 주입하세요."
        )
    return value


# --- API Keys ----------------------------------------------------------------
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")

# --- TMDB ---------------------------------------------------------------------
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_LANGUAGE = "ko-KR"
TMDB_REGION = "KR"

# --- 추천 엔진 가중치 (기획서 10장 표 그대로 유지) ----------------------------
RECOMMENDATION_WEIGHTS = {
    "group_satisfaction": 0.42,
    "fairness": 0.28,
    "text_similarity": 0.18,
    "popularity": 0.07,
    "rating": 0.05,
}
assert abs(sum(RECOMMENDATION_WEIGHTS.values()) - 1.0) < 1e-9, "추천 가중치 합은 1.0이어야 합니다"

# --- 시간 가중치 (최신 의견 우선, FR-AI-06) -----------------------------------
TIME_DECAY_HALF_LIFE_DAYS = 7

# --- 추천 후보 개수 ------------------------------------------------------------
TOP_K = 3

# --- 관련성 판별 임계값 (FR-AI-01~02) ------------------------------------------
RELEVANCE_SCORE_THRESHOLD = 0.35

# --- 제목 매칭 확신도 임계값 (FR-AI-04, 오타/미등록 제목) -----------------------
TITLE_MATCH_CONFIDENCE_THRESHOLD = 0.72
