"""
MeetupLog AI Service - 관련성 분류기 (학습형)
==================================
규칙 기반 키워드 매칭만으로는 "그냥 아무 코미디나 보고싶다"처럼 사전에 없는
표현이나, "액션 배우 되고 싶어" 같은 오탐(false positive)을 걸러내기 어렵다.

이 모듈은 TF-IDF + LogisticRegression으로 "영화 관련 발화 / 일반 대화"를
분류하는 가벼운 학습형 분류기를 제공한다.

## 학습 데이터

`data/relevance_corpus_positive.json` / `relevance_corpus_negative.json`이
있으면 그것을 우선 사용하고(각 최대 500개), 없으면 아래 SEED_TRAINING_DATA
(40여 개 수작업 예시)만으로 부트스트랩한다. 두 데이터는 항상 **합쳐서** 학습한다
— 코퍼스 데이터만 쓰면 정확도는 오르지만(held-out 정확도 57%→93%) "꿀잼",
"노잼" 같은 인터넷 신조어를 못 잡는 경우가 늘고(코퍼스가 격식 있는 구어라
신조어가 적음), SEED_TRAINING_DATA만 쓰면 반대로 일반화가 약하기 때문이다.
직접 두 조합을 비교 평가한 결과(국립국어원 구어 말뭉치 기준):

| 학습 데이터              | 코퍼스 테스트(300개) | 수작업 seed(신조어 포함) |
|--------------------------|----------------------|---------------------------|
| SEED만                   | 57.3%                | -                          |
| 코퍼스만                 | 93.0%                | 70.9%                      |
| 코퍼스 + SEED (결합)     | 92.3%                | 92.7%                      |

`data/relevance_corpus_*.json`은 국립국어원 "모두의 말뭉치" 구어 말뭉치에서
"영화"/"극장"/"감독"/"배우" 등 명시적 신호가 있는 발화(양성)와, 문화·취미
주제가 아니면서 그런 신호가 없는 발화(음성)를 각각 최대 500개 무작위 추출한
파생 데이터셋이다. 코퍼스 원본 자체는 라이선스가 있는 배포 데이터라 여기엔
포함하지 않고, 이렇게 추출·정제한 소량의 파생 학습 데이터만 둔다.

실 서비스 전환 시:
  1) 관련성 판정에 사람이 정정한 사례(FN/FP)를 seed 데이터에 누적
  2) retrain_with_feedback() 주기 실행 또는 배치 파이프라인으로 교체
  3) 문장이 길고 다양해지면 TfidfVectorizer -> SBERT 임베딩으로 교체
     (인터페이스 predict_proba(text) -> float 는 그대로 유지 가능)

## KcELECTRA 파인튜닝 (선택, opt-in) - 알려진 한계 #1 대응

이 파일 아래쪽의 `TransformerRelevanceClassifier`가 `RelevanceClassifier`와
동일한 `predict_proba(text) -> float` 인터페이스로 KcELECTRA 등 한국어
사전학습 모델 파인튜닝 결과를 감싼다. `config.ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER`
를 켜면 `get_default_classifier()`가 이쪽을 우선 시도하고, 로컬 체크포인트가
없거나 로드에 실패하면 자동으로 이 파일의 TF-IDF 분류기로 폴백한다.

체크포인트는 `train_relevance_classifier.py`로 만든다(HF Hub 접근이 가능한
환경에서 실행 - 이 코드를 작성한 샌드박스는 huggingface.co가 막혀 있어 실제
파인튜닝/정확도 검증을 직접 해보지 못했다; "알려진 한계" #6과 같은 제약).
학습 데이터는 이 파일의 `load_training_data()`(코퍼스 700개 + 수작업 seed)를
그대로 재사용하므로, 코퍼스가 늘어나면 TF-IDF와 KcELECTRA 둘 다 자동으로
더 많은 데이터로 학습된다.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List, Optional, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

import config

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Seed 학습 데이터
# ---------------------------------------------------------------------------
# label 1 = 영화 관련(추천에 반영해야 함), 0 = 일반 대화(무시해야 함)
SEED_TRAINING_DATA: List[Tuple[str, int]] = [
    # --- 관련(1) : 명시적 영화/장르/무드 언급 ---
    ("이번엔 가벼운 액션 보고 싶다", 1),
    ("무서운 건 진짜 못 봐", 1),
    ("나 공포영화 완전 좋아해", 1),
    ("잔잔한 드라마 하나 볼까", 1),
    ("SF 영화 요즘 뭐 나왔어", 1),
    ("코미디 말고 다른 거 보자", 1),
    ("그 영화 예고편 봤는데 재밌어 보이더라", 1),
    ("이 감독 작품 항상 좋더라", 1),
    ("런닝타임 너무 긴 건 부담스러워", 1),
    ("19금 영화는 빼고 골라줘", 1),
    ("주인공 연기 잘한다던데", 1),
    ("이번 주말에 뭐 상영해?", 1),
    ("cgv 예매 지금 할까", 1),
    ("그거 평점 높던데 볼만해?", 1),
    ("로맨스 영화는 좀 질린다", 1),
    ("스릴러 반전 있는 걸로 보고 싶어", 1),
    ("애니메이션도 괜찮을 것 같아", 1),
    ("그 배우 나온 영화 다 좋아", 1),
    ("액션은 좋은데 너무 잔인한 건 싫어", 1),
    ("가족 다같이 볼 수 있는 걸로 하자", 1),
    ("스트레스 풀리게 시원한 액션 하나 땡긴다", 1),
    ("최근에 개봉한 영화 뭐 있지", 1),
    ("전에 본 영화보다 재밌었으면 좋겠어", 1),
    ("무서운 거 아니면 다 괜찮아", 1),
    ("결말이 슬픈 영화는 오늘 별로야", 1),
    # --- 관련(1) : 신조어/줄임말이 섞인 영화 발화 ---
    ("그 영화 완전 꿀잼이었음", 1),
    ("어제 본 영화 핵노잼 ㅋㅋ", 1),
    ("이번 영화 인생영화 등극", 1),
    ("그 감독 작품은 다 띵작이야", 1),
    ("공포영화는 극혐이라 패스", 1),
    ("액션 존잼 ㄹㅇ 추천함", 1),
    ("완전 취저 영화였음", 1),
    # --- 무관(0) : 일상 대화 ---
    ("오늘 저녁 뭐 먹지", 0),
    ("과제 언제까지야", 0),
    ("ㅋㅋㅋ 진짜 웃기다", 0),
    ("배고프다 밥 먹자", 0),
    ("내일 몇 시에 만날까", 0),
    ("날씨 왜이렇게 덥냐", 0),
    ("시험 망했어 진짜", 0),
    ("주말에 뭐했어", 0),
    ("이거 어디서 샀어?", 0),
    ("나 오늘 늦게 잘 것 같아", 0),
    ("월요일부터 출근이라니", 0),
    ("헬스장 등록했어", 0),
    ("점심에 뭐 먹었어", 0),
    ("버스 놓쳤어 ㅠㅠ", 0),
    ("주식 요즘 어때", 0),
    ("오늘 진짜 피곤하다", 0),
    ("과제 다 했어?", 0),
    ("커피 마시고 싶다", 0),
    ("집에 언제 도착해?", 0),
    ("나 지금 출발할게", 0),
    # --- 무관(0) : 신조어가 있어도 영화와 무관한 맥락 ---
    ("오늘 게임 개꿀잼이었음", 0),
    ("오늘 발표 완전 노잼이었어", 0),
    ("이 식당 완전 인생맛집이야", 0),
]


class RelevanceClassifier:
    """TF-IDF + LogisticRegression 파이프라인.
    predict_proba(text) -> 0~1 (영화 관련일 확률)
    """

    def __init__(self):
        self.pipeline: Optional[Pipeline] = None

    def fit(self, texts: List[str], labels: List[int]) -> "RelevanceClassifier":
        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(analyzer=self._char_ngram_tokenizer)),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ])
        self.pipeline.fit(texts, labels)
        return self

    @staticmethod
    def _char_ngram_tokenizer(text: str) -> List[str]:
        """한국어는 형태소 분석기(mecab 등) 없이도 어절 내 문자 n-gram을 쓰면
        조사 변형("영화가", "영화는", "영화를")에 어느 정도 강건해진다."""
        text = re.sub(r"\s+", " ", text.strip())
        tokens = []
        for word in text.split(" "):
            n = 2
            if len(word) < n:
                tokens.append(word)
                continue
            tokens.extend(word[i:i + n] for i in range(len(word) - n + 1))
        return tokens

    def predict_proba(self, text: str) -> float:
        if self.pipeline is None:
            raise RuntimeError("모델이 학습되지 않았습니다. fit() 또는 bootstrap()을 먼저 호출하세요.")
        proba = self.pipeline.predict_proba([text])[0]
        classes = list(self.pipeline.named_steps["clf"].classes_)
        return float(proba[classes.index(1)])

    def retrain_with_feedback(self, extra_examples: List[Tuple[str, int]]) -> "RelevanceClassifier":
        """운영 중 사람이 정정한 사례를 기본 학습 데이터에 합쳐 재학습."""
        combined = load_training_data() + extra_examples
        texts, labels = zip(*combined)
        return self.fit(list(texts), list(labels))


class TransformerRelevanceClassifier:
    """KcELECTRA(또는 다른 HF 한국어 사전학습 모델) 파인튜닝 기반 관련성 분류기.

    알려진 한계 #1(TF-IDF+LogisticRegression을 KcELECTRA 파인튜닝으로 교체)에
    대응한다. `RelevanceClassifier`와 동일한 `predict_proba(text) -> float`
    인터페이스를 제공하므로, nlp_pipeline.is_relevant()는 어느 쪽이 실제로
    쓰이는지 신경 쓸 필요가 없다.

    ⚠️ 이 분류기는 "미세조정된 로컬 체크포인트"가 있어야 의미가 있다 -
    사전학습 모델(KcELECTRA)을 분류 헤드 없이 그대로 로드해서 쓰면 관련성
    판정을 못 한다. 체크포인트는 train_relevance_classifier.py로 오프라인에서
    (HF Hub 접근이 가능한 환경에서) 만들어 TRANSFORMER_RELEVANCE_MODEL_DIR에
    배치한다. 이 코드를 작성한 샌드박스는 huggingface.co 접근이 막혀 있어
    실제로 파인튜닝을 돌려서 정확도를 검증하지는 못했다(README "알려진
    한계" #6과 동일한 제약) - 실 배포 전 반드시 한 번은 직접 학습/평가할 것.

    로드 실패(체크포인트 없음, transformers/torch 미설치, 코퍼스 형식 불일치
    등) 시 예외를 던져 get_default_classifier()가 TF-IDF로 폴백하게 한다.
    """

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or config.TRANSFORMER_RELEVANCE_MODEL_DIR
        self._pipeline = None

    def _ensure_loaded(self) -> None:
        if self._pipeline is not None:
            return
        model_path = Path(self.model_dir)
        if not model_path.exists():
            raise FileNotFoundError(
                f"파인튜닝된 체크포인트가 없습니다: {self.model_dir} "
                f"(train_relevance_classifier.py로 먼저 학습을 돌리세요)"
            )
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

        tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
        model = AutoModelForSequenceClassification.from_pretrained(self.model_dir)
        self._pipeline = pipeline(
            "text-classification",
            model=model,
            tokenizer=tokenizer,
            device=0 if torch.cuda.is_available() else -1,
            framework="pt",
            top_k=None,  # 모든 라벨의 확률을 받아서 label=1(관련) 확률만 취사선택
        )

    def predict_proba(self, text: str) -> float:
        self._ensure_loaded()
        # top_k=None이면 [[{"label": "LABEL_0", "score": ...}, {"label": "LABEL_1", ...}]]
        scores = self._pipeline(text)[0]
        for item in scores:
            label = item["label"]
            # 학습 스크립트가 id2label={0: "NOT_RELEVANT", 1: "RELEVANT"}로
            # 저장하므로 문자열/숫자 라벨 표기를 모두 허용해 안전하게 매칭한다.
            if label in ("RELEVANT", "LABEL_1", "1"):
                return float(item["score"])
        # 라벨을 못 찾으면(id2label 커스터마이즈 등) 보수적으로 중립값 반환
        return 0.5


_default_transformer_classifier: Optional[TransformerRelevanceClassifier] = None


def _load_corpus_examples(filename: str, label: int, cap: int = 500) -> List[Tuple[str, int]]:
    """data/relevance_corpus_positive.json / negative.json을 읽어
    (문장, 라벨) 튜플 목록으로 변환한다. 파일이 없으면 빈 목록을 반환한다
    (SEED_TRAINING_DATA만으로도 항상 학습이 가능해야 하므로)."""
    path = DATA_DIR / filename
    if not path.exists():
        return []
    try:
        with open(path, encoding="utf-8") as f:
            texts = json.load(f)
        return [(t, label) for t in texts[:cap]]
    except (json.JSONDecodeError, OSError):
        return []


def load_training_data() -> List[Tuple[str, int]]:
    """기본 학습 데이터 = 코퍼스 파생 데이터(있으면) + 수작업 SEED(항상 포함).
    둘을 합쳐야 정확도와 신조어 일반화를 모두 잡을 수 있다(모듈 docstring의
    비교표 참고). 코퍼스 파일이 없는 환경(예: 이 데이터를 아직 만들지 않은
    새 클론)에서도 SEED_TRAINING_DATA만으로 동일한 인터페이스가 동작한다."""
    corpus = (
        _load_corpus_examples("relevance_corpus_positive.json", label=1)
        + _load_corpus_examples("relevance_corpus_negative.json", label=0)
    )
    return corpus + SEED_TRAINING_DATA


_default_classifier: Optional[RelevanceClassifier] = None


def _get_tfidf_classifier() -> RelevanceClassifier:
    global _default_classifier
    if _default_classifier is None:
        texts, labels = zip(*load_training_data())
        _default_classifier = RelevanceClassifier().fit(list(texts), list(labels))
    return _default_classifier


def get_default_classifier():
    """앱 전역에서 공유하는 기본 분류기.

    config.ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER가 켜져 있으면 KcELECTRA
    파인튜닝 분류기(TransformerRelevanceClassifier)를 우선 시도하고, 로드에
    실패하면(체크포인트 없음, 의존성 미설치 등) 조용히 TF-IDF+LogisticRegression
    으로 폴백한다 - 다른 opt-in 모델들(text_normalization.py)과 동일한 원칙:
    이 기능이 꺼져 있거나 실패해도 관련성 판별 자체는 항상 동작해야 한다.
    반환 타입은 둘 다 predict_proba(text) -> float 인터페이스를 만족한다.
    """
    global _default_transformer_classifier
    if config.ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER:
        if _default_transformer_classifier is None:
            try:
                clf = TransformerRelevanceClassifier()
                clf._ensure_loaded()  # 여기서 미리 로드해 실패 시 바로 폴백
                _default_transformer_classifier = clf
            except Exception:
                _default_transformer_classifier = False  # 실패도 캐시(매 요청 재시도 방지)
        if _default_transformer_classifier:
            return _default_transformer_classifier
    return _get_tfidf_classifier()
