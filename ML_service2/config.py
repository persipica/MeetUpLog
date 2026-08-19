"""
MeetupLog AI Service - 환경설정
==================================
TMDB / KOFIC(영화진흥위원회) / Hugging Face API 키와 공통 상수를 관리한다.

키는 저장소에 커밋되지 않는 `.env` 파일 또는 서버 환경변수로만 주입한다
(이 파일에는 어떤 키의 실제 값도 기본값으로 넣어두지 않는다). 개발 편의를
위해 python-dotenv로 `.env`를 자동 로드하되, `.env`가 없어도 조용히
넘어간다 — 배포 환경에서는 보통 시크릿 매니저/환경변수로 직접 주입하기 때문.

    cp .env.example .env   # 로컬 개발용, .env는 .gitignore에 반드시 추가
    export TMDB_API_KEY="..."   # 또는 서버 환경변수로 직접 주입

키가 실제로 필요한 시점(외부 API를 처음 호출하는 시점)에만 require_key()가
누락을 명확한 에러로 알려준다 — 그래야 데모(demo.py)처럼 외부 API를 쓰지
않는 코드 경로는 키 없이도 그대로 동작한다.
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()  # .env가 없으면 아무 일도 하지 않고 넘어감
except ImportError:
    pass  # python-dotenv 미설치 시에도 환경변수만으로 동작 가능해야 함


def require_key(name: str, value: str) -> str:
    """API 키가 실제로 필요한 호출 직전에만 불러 명확한 에러를 낸다.
    (모듈 import 시점에 강제하면 키가 없는 데모/테스트 코드까지 막히므로
    호출 지점에서 지연 검증한다.)"""
    if not value:
        raise RuntimeError(
            f"{name}가 설정되지 않았습니다. .env 또는 환경변수로 {name}를 주입하세요."
        )
    return value


# --- API Keys (기본값 없음 - 반드시 환경변수/.env로 주입) --------------------
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
KOFIC_API_KEY = os.getenv("KOFIC_API_KEY", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")

# --- TMDB -------------------------------------------------------------------
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_LANGUAGE = "ko-KR"
TMDB_REGION = "KR"

# --- KOFIC(KOBIS) -------------------------------------------------------------
KOFIC_BASE_URL = "http://www.kobis.or.kr/kobisopenapi/webservice/rest"

# --- 추천 엔진 가중치 (기획서 10장 기준) ------------------------------------
# 그룹 평균 만족도 42% / 하위 사용자 공정성 28% / 텍스트 의미 유사도 18%
# / 대중성 7% / 평점 5%
RECOMMENDATION_WEIGHTS = {
    "group_satisfaction": 0.42,
    "fairness": 0.28,
    "text_similarity": 0.18,
    "popularity": 0.07,
    "rating": 0.05,
}
assert abs(sum(RECOMMENDATION_WEIGHTS.values()) - 1.0) < 1e-9, "추천 가중치 합은 1.0이어야 합니다"

# --- 시간 가중치 (최신 의견 우선, 9장) ---------------------------------------
# 최근 발화일수록 가중치가 크고, TIME_DECAY_HALF_LIFE_DAYS 가 지날 때마다
# 절반으로 감쇠하는 지수 감쇠(half-life decay) 모델을 사용한다.
TIME_DECAY_HALF_LIFE_DAYS = 7

# --- 추천 후보 개수 --------------------------------------------------------
TOP_K = 3

# --- 관련성 판별 임계값 (8~9장 Relevance Filter) ----------------------------
RELEVANCE_SCORE_THRESHOLD = 0.35

# --- 신조어/오타 처리 관련 선택적(opt-in) 모델 플래그 -------------------------
# corpus_typo_corrector(국립국어원 코퍼스에서 마이닝하고 실측 검증한 경량
# 사전)는 외부 모델 다운로드가 필요 없고 위험이 낮다고 확인했으므로 기본 on.
# ET5(HF, 로컬 torch 전용 - Inference Provider 미배포)/ElectraSpacer(GitHub)는
# 무거운 모델 다운로드가 필요하고 이 환경에서 직접 검증하지 못했으므로 기본
# off. SBERT(jhgan/ko-sroberta-multitask)는 HF Inference API가 배포돼 있어
# 기본 경로 자체는 가볍지만(requests만 필요, HF_TOKEN 필요), 이 환경에서
# huggingface.co 접근이 막혀 있어 여전히 직접 검증은 못했으므로 기본 off로
# 뒀다. text_normalization.py 상단 참고.
ENABLE_CORPUS_TYPO_CORRECTION = os.getenv("ENABLE_CORPUS_TYPO_CORRECTION", "true").lower() == "true"
ENABLE_TYPO_CORRECTION = os.getenv("ENABLE_TYPO_CORRECTION", "false").lower() == "true"
ENABLE_SPACING_CORRECTION = os.getenv("ENABLE_SPACING_CORRECTION", "false").lower() == "true"
ENABLE_SBERT_SIMILARITY = os.getenv("ENABLE_SBERT_SIMILARITY", "false").lower() == "true"

# --- 관련성 분류기: KcELECTRA 파인튜닝 (선택, opt-in) -----------------------
# 기본은 TF-IDF+LogisticRegression(relevance_classifier.RelevanceClassifier).
# 이 플래그를 켜면 로컬에 파인튜닝된 KcELECTRA 체크포인트(train_relevance_classifier.py로
# 생성)를 우선 사용하고, 체크포인트가 없거나 로드에 실패하면 TF-IDF로 자동
# 폴백한다. relevance_classifier.py 상단 docstring 참고.
ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER = (
    os.getenv("ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER", "false").lower() == "true"
)
TRANSFORMER_RELEVANCE_MODEL_NAME = os.getenv(
    "TRANSFORMER_RELEVANCE_MODEL_NAME", "beomi/KcELECTRA-base-v2022"
)
# fine-tune 결과물(로컬 디렉터리)이 있으면 그걸 우선 로드한다. 없으면
# TRANSFORMER_RELEVANCE_MODEL_NAME을 헤드 없이 로드해봐야 분류가 안 되므로,
# 이 경로가 없으면 바로 TF-IDF로 폴백한다.
TRANSFORMER_RELEVANCE_MODEL_DIR = os.getenv(
    "TRANSFORMER_RELEVANCE_MODEL_DIR", "./checkpoints/relevance-kcelectra"
)

# --- State 영속화 (선택, opt-in) --------------------------------------------
# 기본은 프로세스 내 메모리(InMemoryStateStore) - 단일 인스턴스 데모/개발용.
# Redis를 켜면 UserPreferenceState/ConversationFocus를 라운드
# (room_id, round_id) 단위로 저장해, 서버 재시작이나 다중 인스턴스(로드밸런싱)
# 환경에서도 상태가 유지된다. state_store.py 참고.
ENABLE_REDIS_STATE_STORE = os.getenv("ENABLE_REDIS_STATE_STORE", "false").lower() == "true"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# 라운드 상태 만료 시간(초). 추천 라운드는 보통 짧게 끝나므로 기본 6시간.
STATE_TTL_SECONDS = int(os.getenv("STATE_TTL_SECONDS", str(6 * 3600)))
