"""
MeetupLog AI Service - opt-in HF 모델 실검증 스크립트
==================================
text_normalization.py의 세 모델(ET5 맞춤법 교정, ElectraSpacer 띄어쓰기 교정,
SBERT 문장 임베딩) 중 실제로 검증 가능한 건 SBERT뿐이다 - HF 모델 페이지를
직접 확인한 결과 j5ng/et5-typos-corrector는 Inference Provider가 배포돼
있지 않아 애초에 API로 테스트할 수 없고(로컬 torch 로딩만 가능),
ElectraSpacer는 HF Hub가 아니라 GitHub 리포지토리라 별개다.

이 스크립트는 huggingface.co 접근이 가능한 환경에서 실행해, 실제로
로드/호출되고 그럴듯한 출력을 내는지 스모크 테스트한다. CI나 배포
파이프라인에 넣고 통과할 때만 config.py의 해당 ENABLE_* 플래그를 true로
켜는 것을 권장한다.

## 사용법

    export HF_TOKEN=hf_...        # .env에 넣어도 됨 - SBERT 검증에 필요
    pip install -r requirements.txt   # SBERT는 requests만 있으면 됨(경량 API 경로)
    # ET5/ElectraSpacer까지 로컬로 검증하려면 추가로:
    #   pip install -r requirements-nlp-heavy.txt
    #   git clone https://github.com/jaeyeongs/ElectraSpacer
    python verify_hf_models.py

## ⚠️ 이 스크립트 자체도 이 환경(샌드박스)에서 실행해 통과 여부를 확인하지
못했다 - huggingface.co 접근이 이 환경에서도 막혀 있고(host_not_allowed),
torch/transformers/sentence-transformers도 설치돼 있지 않다. 즉 지금
할 수 있는 것은 "검증 스크립트를 준비해 두는 것"까지이고, 실제 검증은
반드시 접근 가능한 환경(로컬 개발 머신, CI 러너 등)에서 한 번 실행해야 한다.
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def _report(name: str, ok: bool, detail: str) -> None:
    status = "✅ 통과" if ok else "❌ 실패"
    print(f"[{name}] {status}")
    print(f"    {detail}")


def verify_typo_corrector() -> bool:
    from text_normalization import TypoCorrector

    corrector = TypoCorrector()
    samples = ["나는걸어가고 있는중입니다", "완죤 어이업ㅅ네진짜"]
    try:
        outputs = [corrector.correct(s) for s in samples]
        loaded = corrector._pipeline is not None
        for s, o in zip(samples, outputs):
            print(f"    원문: {s!r} -> 교정: {o!r}")
        _report(
            "ET5 맞춤법 교정 (j5ng/et5-typos-corrector)",
            loaded,
            "모델 로드 성공, 추론 실행됨" if loaded
            else "모델 로드 실패 - 원문 그대로 반환됨(no-op 폴백). 위 오류 로그 확인 필요",
        )
        return loaded
    except Exception:
        _report("ET5 맞춤법 교정", False, "예외 발생:\n" + traceback.format_exc())
        return False


def verify_spacing_corrector() -> bool:
    from text_normalization import SpacingCorrector

    corrector = SpacingCorrector()
    sample = "나는걸어가고있는중입니다"
    try:
        output = corrector.correct(sample)
        loaded = corrector._model is not None
        print(f"    원문: {sample!r} -> 교정: {output!r}")
        _report(
            "ElectraSpacer 띄어쓰기 교정",
            loaded,
            "모델 로드 성공, 추론 실행됨" if loaded
            else "모델 로드 실패 - 원문 그대로 반환됨(no-op 폴백). "
                 "ElectraSpacer 리포지토리를 클론해 PYTHONPATH에 추가했는지 확인",
        )
        return loaded
    except Exception:
        _report("ElectraSpacer 띄어쓰기 교정", False, "예외 발생:\n" + traceback.format_exc())
        return False


def verify_sentence_embedder() -> bool:
    """SBERT 유사도 검증. embedder.encode()가 아니라 similarity_matrix()를
    테스트한다 - 실제로 HF Inference API에 배포된 형태가 벡터를 주는
    feature-extraction이 아니라 문장 쌍 유사도를 주는 SentenceSimilarityPipeline
    이라는 게 실측으로 확인됐기 때문이다(2026-08, 사용자가 직접 호출해 확인).
    encode()는 이제 로컬 sentence-transformers 폴백 전용이라 API 키만 있는
    환경에서는 항상 실패한다 - 여기서 그걸 테스트하면 오탐이 난다."""
    from text_normalization import get_sentence_embedder

    try:
        embedder = get_sentence_embedder()
        if embedder is None:
            _report("SBERT 문장 유사도 (jhgan/ko-sroberta-multitask)", False,
                     "로드 실패 - get_sentence_embedder()가 None을 반환함")
            return False
        matrix = embedder.similarity_matrix(
            ["잔잔한 드라마 하나 볼까", "오늘 저녁 뭐 먹지"],
            ["따뜻하고 감동적인 가족 이야기"],
        )
        shape_ok = hasattr(matrix, "shape") and tuple(matrix.shape) == (2, 1)
        print(f"    유사도 행렬 shape: {getattr(matrix, 'shape', type(matrix))}")
        print(f"    값: {matrix}")
        _report("SBERT 문장 유사도", shape_ok,
                 "유사도 정상 계산됨" if shape_ok else "결과 shape이 예상과 다름")
        return shape_ok
    except Exception:
        _report("SBERT 문장 유사도", False, "예외 발생:\n" + traceback.format_exc())
        return False


def main() -> None:
    print("=== MeetupLog opt-in HF 모델 실검증 ===\n")
    results = {
        "typo": verify_typo_corrector(),
        "spacing": verify_spacing_corrector(),
        "sbert": verify_sentence_embedder(),
    }
    print("\n=== 요약 ===")
    for name, ok in results.items():
        print(f"  {name}: {'통과' if ok else '실패/미확인'}")
    print(
        "\n통과한 항목만 config.py(.env)의 대응 ENABLE_* 플래그를 true로 "
        "켜는 것을 권장한다. (ENABLE_TYPO_CORRECTION / ENABLE_SPACING_CORRECTION "
        "/ ENABLE_SBERT_SIMILARITY)"
    )
    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
