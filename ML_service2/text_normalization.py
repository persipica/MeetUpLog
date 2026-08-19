"""
MeetupLog AI Service - 텍스트 정규화 (맞춤법·띄어쓰기·문장 임베딩)
==================================
구어체 채팅은 오탈자와 붙여쓰기가 잦아("완죤 어이업ㅅ네진짜ㅋㅋㅋ",
"나는걸어가고 있는중입니다") 키워드 매칭 인식률을 떨어뜨린다. 이 모듈은
세 개의 사전학습 모델을 감싸 전처리/유사도 계산 단계에 끼워 넣는다.

  - 맞춤법(오타) 교정 : j5ng/et5-typos-corrector (ET5 seq2seq, HF Hub)
  - 띄어쓰기 교정     : ElectraSpacer(KoCharELECTRA, github.com/jaeyeongs/ElectraSpacer)
  - 문장 임베딩       : jhgan/ko-sroberta-multitask (SBERT, HF Hub)
                        -> recommendation_engine의 TF-IDF 유사도를 대체

⚠️ 2026-08 업데이트: HF 모델 페이지를 직접 확인해보니, 세 모델이 "API로
가볍게 쓸 수 있는지" 여부가 서로 달라서 각각 다르게 처리한다. (사용자가
실제 토큰으로 두 번 호출해봐서 아래 내용을 전부 실측 확인했다.)

  - **SentenceEmbedder(SBERT)** — jhgan/ko-sroberta-multitask는 HF Inference
    Provider가 배포돼 있다(실제 호출로 확인). 다만 원했던 "문장을 벡터로
    바꿔줘"(feature-extraction)가 아니라 "문장 A가 [문장들] 중 뭐랑
    비슷해?"(source_sentence + sentences, SentenceSimilarityPipeline) 형태로만
    배포돼 있다는 것도 실제 호출 에러 메시지로 확인했다
    ("SentenceSimilarityPipeline.__call__() missing 1 required positional
    argument: 'sentences'"). 그래서 `encode()`로 벡터를 받는 대신
    `similarity_matrix()`로 유사도 값 자체를 API에서 바로 받아온다 - 마침
    이 프로젝트가 실제로 필요한 것도 벡터가 아니라 유사도 값뿐이라 이쪽이
    더 정확히 들어맞는다. requests만 필요(경량) - torch/sentence-transformers
    를 로컬에 설치할 필요가 없다. API 호출이 실패하면(토큰 없음, 네트워크
    오류 등) 로컬 sentence-transformers가 설치돼 있을 때만 그쪽으로 폴백한다.
  - **TypoCorrector(ET5)** — j5ng/et5-typos-corrector는 **HF Inference
    Provider가 배포되어 있지 않다**는 것도 실제 호출로 재확인했다
    ("Model not supported by provider hf-inference"). API로는 아예 호출이
    안 되고, 쓰려면 torch로 로컬에 직접 올려야 한다 - 경량화 목적과는
    반대라 기본적으로 권장하지 않는다. corpus_typo_corrector.py(외부
    의존성 없이 코퍼스로 검증된 경량 사전)를 우선 쓰는 걸 권장하며, 이
    클래스는 "그래도 로컬에 무겁게 돌리고 싶다"는 선택지로만 남겨뒀다.
  - **SpacingCorrector(ElectraSpacer)** — HF Hub가 아니라 GitHub 리포지토리
    체크포인트라 애초에 Inference API 대상이 아니다. 리포를 클론해 로컬에
    두지 않으면 항상 no-op 폴백이다(이번엔 손대지 않았다).

⚠️ 실행 환경 주의
이 코드가 작성된 샌드박스는 huggingface.co 네트워크 접근이 막혀 있어
(host_not_allowed) 이 자리에서 직접 실행해보지 못했다. 대신 사용자가 로컬
환경에서 실제 토큰으로 두 차례 호출해 위 내용(도메인 변경, ET5 미지원,
SBERT의 정확한 페이로드 형식)을 전부 실측 검증해줬다 - `test_hf_inference.py`
참고. config.py의 ENABLE_* 플래그가 기본 false인 이유는 여전히 유효하다:
프로덕션에 켜기 전 `python verify_hf_models.py`로 한 번 더 확인할 것.

검증은 `python verify_hf_models.py`로 자동화해뒀다(huggingface.co 접근이
가능한 환경에서 실행). 통과한 항목만 대응하는 ENABLE_* 플래그를 켤 것.
"""

from __future__ import annotations

from typing import List, Optional

import config

TYPO_MODEL_NAME = "j5ng/et5-typos-corrector"
TYPO_PROMPT_PREFIX = "맞춤법을 고쳐주세요: "
EMBEDDING_MODEL_NAME = "jhgan/ko-sroberta-multitask"


# ---------------------------------------------------------------------------
# 1) 맞춤법(오타) 교정
# ---------------------------------------------------------------------------

class TypoCorrector:
    """구어체 오타 교정(ET5, 로컬 torch 로딩 전용). 모델 로드/추론 실패 시
    원문을 그대로 반환한다.

    ⚠️ j5ng/et5-typos-corrector는 HF Inference Provider가 배포돼 있지 않아
    (모델 페이지에서 직접 확인) API로는 호출할 수 없다 - 이 클래스는 항상
    torch로 로컬에 모델을 통째로 내려받아 돌린다(무거움). 경량화가
    목표라면 이 클래스 대신 corpus_typo_corrector.py(외부 의존성 없음,
    코퍼스로 실측 검증됨)를 쓰는 걸 권장한다 - config.ENABLE_TYPO_CORRECTION
    이 기본 false인 이유이기도 하다.
    """

    def __init__(self, model_name: str = TYPO_MODEL_NAME):
        self.model_name = model_name
        self._pipeline = None
        self._load_failed = False

    def _ensure_loaded(self) -> None:
        if self._pipeline is not None or self._load_failed:
            return
        try:
            import torch
            from transformers import T5ForConditionalGeneration, T5Tokenizer, pipeline

            model = T5ForConditionalGeneration.from_pretrained(self.model_name, token=config.HF_TOKEN or None)
            tokenizer = T5Tokenizer.from_pretrained(self.model_name, token=config.HF_TOKEN or None)
            self._pipeline = pipeline(
                "text2text-generation",
                model=model,
                tokenizer=tokenizer,
                device=0 if torch.cuda.is_available() else -1,
                framework="pt",
            )
        except Exception:
            # 모델 다운로드 실패, torch/transformers 미설치, 메모리 부족 등
            # 어떤 이유든 오타 교정 없이 원문으로 계속 진행한다.
            self._load_failed = True

    def correct(self, text: str) -> str:
        self._ensure_loaded()
        if self._pipeline is None:
            return text
        try:
            output = self._pipeline(
                TYPO_PROMPT_PREFIX + text, max_length=128, num_beams=5, early_stopping=True
            )
            return output[0]["generated_text"]
        except Exception:
            return text


# ---------------------------------------------------------------------------
# 2) 띄어쓰기 교정
# ---------------------------------------------------------------------------

class SpacingCorrector:
    """띄어쓰기 교정. ElectraSpacer가 준비돼 있으면 사용하고,
    없으면 원문을 그대로 반환하는 no-op으로 폴백한다.

    (근사 규칙으로 임의로 공백을 삽입하는 방식은 "은하 추격전"처럼 조사와
    같은 형태의 글자가 포함된 고유명사를 깨뜨릴 위험이 있어 채택하지 않았다.
    교정을 안 하는 것이 잘못 교정하는 것보다 안전하다.)
    """

    def __init__(self):
        self._model = None
        self._load_failed = False

    def _ensure_loaded(self) -> None:
        if self._model is not None or self._load_failed:
            return
        try:
            from spaceprediction import ElectraSpacer  # type: ignore
            self._model = ElectraSpacer()
        except Exception:
            self._load_failed = True

    def correct(self, text: str) -> str:
        self._ensure_loaded()
        if self._model is None:
            return text
        try:
            return self._model(text)
        except Exception:
            return text


# ---------------------------------------------------------------------------
# 3) 문장 임베딩 (SBERT) - TF-IDF 유사도 대체용
# ---------------------------------------------------------------------------

HF_INFERENCE_API_URL = "https://router.huggingface.co/hf-inference/models/{model_id}"
# ⚠️ 2026-08: 예전에 쓰던 https://api-inference.huggingface.co 는 HF가 완전히
# 폐지했다(HTTP 410 "no longer supported, use router.huggingface.co instead").
# 처음 이 코드를 작성할 때 옛날 문서를 참고해서 죽은 도메인을 그대로 썼는데,
# 사용자가 직접 스크립트를 돌려서 DNS 조회 실패(도메인 자체가 없음)로 확인해줘
# 잡은 버그다. 공식 문서(huggingface.co/docs/inference-providers)에서 재확인한
# 현재 주소로 교체했다.


class SentenceEmbedder:
    """SBERT(jhgan/ko-sroberta-multitask) 기반 한국어 문장 유사도.

    ⚠️ 2026-08 업데이트: 실제로 토큰으로 호출해보니(사용자가 직접 실행해
    확인해줌) 이 모델이 HF Inference API에 "SentenceSimilarityPipeline"으로
    배포돼 있어서, 원하는 "문장을 벡터로 바꿔줘"(feature-extraction) 형태가
    아니라 "문장 A가 [문장들] 중 뭐랑 제일 비슷해?"(source_sentence +
    sentences) 형태만 받는다는 게 확인됐다(에러 메시지: "SentenceSimilarity
    Pipeline.__call__() missing 1 required positional argument: 'sentences'").
    그래서 API 경로는 벡터를 직접 안 받고, `similarity_matrix()`로 필요한
    유사도 값 자체를 API에서 바로 받아온다 - 오히려 이 프로젝트가 실제로
    필요한 건 벡터가 아니라 유사도 값뿐이라 더 정확히 들어맞는다.

    기본 경로는 HF Inference API(requests, 경량 - torch/sentence-transformers
    불필요)다. config.HF_TOKEN이 없거나 API 호출이 실패하면(네트워크 오류,
    모델 콜드스타트 타임아웃 등) 로컬 sentence-transformers가 설치돼 있을
    때만 그쪽으로 폴백한다 - 없으면 예외를 그대로 던져 호출부
    (recommendation_engine)가 문자 n-gram TF-IDF로 폴백하도록 한다.
    """

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self._local_model = None  # 로컬 sentence-transformers 폴백용 (opt-in)

    # -- 1) HF Inference API 경로 (기본, 경량) -----------------------------
    def _similarity_row_via_api(self, source_sentence: str, sentences: List[str]) -> List[float]:
        """source_sentence 하나가 sentences 각각과 얼마나 비슷한지 한 번의
        API 호출로 받아온다. 반환값 길이는 len(sentences)와 같다."""
        import requests

        token = config.require_key("HF_TOKEN", config.HF_TOKEN)
        resp = requests.post(
            HF_INFERENCE_API_URL.format(model_id=self.model_name),
            headers={"Authorization": f"Bearer {token}"},
            json={
                "inputs": {"source_sentence": source_sentence, "sentences": sentences},
                # 서버리스 Inference API는 안 쓰인 지 오래된 모델을 "콜드
                # 스타트"할 수 있다. wait_for_model=True면 즉시 503으로
                # 실패하는 대신 API가 알아서 기다렸다가 응답해준다.
                "options": {"wait_for_model": True},
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()  # List[float], len == len(sentences)

    def similarity_matrix_via_api(self, texts_a: List[str], texts_b: List[str]):
        """texts_a[i]와 texts_b[j] 사이 유사도로 이뤄진 (len(a), len(b)) 행렬.
        texts_a 개수만큼 API를 호출한다(호출 1회당 texts_b 전체와 비교) -
        원소 하나하나를 다 비교하는 것보다 훨씬 적은 호출 수다."""
        import numpy as np

        rows = [self._similarity_row_via_api(a, texts_b) for a in texts_a]
        return np.array(rows, dtype=float)

    # -- 2) 로컬 sentence-transformers 폴백 (무거움, opt-in) ----------------
    def _ensure_local_loaded(self) -> None:
        if self._local_model is None:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.model_name, use_auth_token=config.HF_TOKEN or None)

    def encode(self, texts: List[str]):
        """로컬 sentence-transformers로 문장을 벡터로 인코딩한다(API 경로는
        벡터를 안 주므로 이 메서드는 로컬 폴백 전용이다)."""
        self._ensure_local_loaded()
        return self._local_model.encode(texts)

    def similarity_matrix(self, texts_a: List[str], texts_b: List[str]):
        """texts_a[i]와 texts_b[j] 사이 유사도 (len(a), len(b)) 행렬.
        API를 먼저 시도하고, 실패하면 로컬 인코딩 + 코사인 유사도로 폴백한다."""
        try:
            return self.similarity_matrix_via_api(texts_a, texts_b)
        except Exception:
            from sklearn.metrics.pairwise import cosine_similarity
            vecs_a = self.encode(texts_a)  # sentence-transformers 미설치면 여기서 예외 발생 -> 호출부가 처리
            vecs_b = self.encode(texts_b)
            return cosine_similarity(vecs_a, vecs_b)


# ---------------------------------------------------------------------------
# 싱글턴 접근자
# ---------------------------------------------------------------------------

_typo_corrector: Optional[TypoCorrector] = None
_spacing_corrector: Optional[SpacingCorrector] = None
_embedder: Optional["SentenceEmbedder"] = None


def get_typo_corrector() -> TypoCorrector:
    global _typo_corrector
    if _typo_corrector is None:
        _typo_corrector = TypoCorrector()
    return _typo_corrector


def get_spacing_corrector() -> SpacingCorrector:
    global _spacing_corrector
    if _spacing_corrector is None:
        _spacing_corrector = SpacingCorrector()
    return _spacing_corrector


def get_sentence_embedder() -> Optional[SentenceEmbedder]:
    """SentenceEmbedder를 돌려준다.

    이전 버전은 로컬 모델을 미리 로드해보고 실패하면 None을 캐시하는
    방식이었는데, 이제 기본 경로가 HF Inference API(요청 시점에만 네트워크
    호출)라 "미리 로드해서 검증"할 무거운 준비 단계 자체가 없다. 그래서
    이 함수는 항상 인스턴스를 돌려주고, 실제 실패 여부는 매 encode() 호출
    시점에 판가름난다 - 호출부(recommendation_engine)가 이미 그 실패를
    잡아서 TF-IDF로 폴백하도록 돼 있다.
    """
    global _embedder
    if _embedder is None:
        _embedder = SentenceEmbedder()
    return _embedder


def normalize_text(text: str, fix_typos: bool = True, fix_spacing: bool = True) -> str:
    """맞춤법 교정 -> 띄어쓰기 교정 순서로 적용한다.
    각 단계는 내부에서 예외를 흡수하므로 이 함수는 항상 문자열을 반환한다
    (최악의 경우 원문 그대로).

    맞춤법 교정은 기본적으로 corpus_typo_corrector(코퍼스에서 실측 검증된
    경량 사전)를 사용한다 — 외부 모델 다운로드가 필요 없고, 이 프로젝트에서
    유일하게 실제 데이터로 개선 효과를 확인한 경로이기 때문이다.
    config.ENABLE_TYPO_CORRECTION을 켜면 더 무겁지만 표현력이 큰 HF ET5
    모델(TypoCorrector)을 대신 사용한다 — 다만 이 모델은 이 환경에서 직접
    검증하지 못했으니 실 배포 전 반드시 확인할 것.
    """
    result = text
    if fix_typos:
        if config.ENABLE_TYPO_CORRECTION:
            result = get_typo_corrector().correct(result)
        else:
            from corpus_typo_corrector import correct as corpus_correct
            result = corpus_correct(result)
    if fix_spacing:
        result = get_spacing_corrector().correct(result)
    return result
