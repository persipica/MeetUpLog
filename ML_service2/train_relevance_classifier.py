"""
MeetupLog AI Service - 관련성 분류기 KcELECTRA 파인튜닝 스크립트
==================================
relevance_classifier.py의 TF-IDF+LogisticRegression을 대체할 수 있는
KcELECTRA(또는 다른 HF 한국어 사전학습 모델) 파인튜닝 체크포인트를 만든다.
(알려진 한계 #1 대응)

## 실행 전 준비

  pip install -r requirements-nlp-heavy.txt   # torch, transformers 등
  huggingface.co 접근이 가능한 환경이어야 한다 (사전학습 모델 다운로드).

## 사용법

    python train_relevance_classifier.py
    python train_relevance_classifier.py --model beomi/KcELECTRA-base-v2022 \
        --output ./checkpoints/relevance-kcelectra --epochs 4

학습이 끝나면 --output 경로에 HF 표준 포맷(config.json, model.safetensors,
tokenizer 파일들)으로 저장된다. 이 경로를 .env의
TRANSFORMER_RELEVANCE_MODEL_DIR에 넣고 ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER=true
로 켜면 relevance_classifier.get_default_classifier()가 이 체크포인트를 쓴다.

## ⚠️ 이 스크립트는 이 샌드박스에서 실행/검증되지 못했다

작성 환경이 huggingface.co에 접근할 수 없어(README/config.py의 다른 opt-in
모델들과 동일한 제약), 이 스크립트로 실제 파인튜닝을 돌려 정확도를 재본 적이
없다. 로직은 HF `Trainer` API의 표준 텍스트 분류 예제를 따랐지만, 실 배포
전 다음을 반드시 확인할 것:
  1) 학습이 실제로 수렴하는지 (loss 곡선)
  2) held-out 세트에서 TF-IDF 베이스라인(relevance_classifier.py 상단
     docstring의 비교표: 코퍼스+SEED 결합 92.3%/92.7%) 대비 실제로 더
     나은지 - 데이터가 700개+55개 수준으로 작으면 트랜스포머가 항상
     이긴다는 보장은 없다. 개선이 확인되지 않으면 TF-IDF를 유지하는 것도
     합리적 선택이다(ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER=false 유지).
  3) 추론 지연시간(latency) - 채팅 메시지마다 호출되므로 CPU 추론 시
     TF-IDF보다 눈에 띄게 느릴 수 있다.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Tuple

sys.path.insert(0, str(Path(__file__).parent))

from relevance_classifier import load_training_data  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="beomi/KcELECTRA-base-v2022",
                         help="파인튜닝 베이스 모델 (HF Hub 이름)")
    parser.add_argument("--output", default="./checkpoints/relevance-kcelectra",
                         help="체크포인트 저장 경로")
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--test-size", type=float, default=0.15,
                         help="held-out 평가용으로 떼어둘 비율")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        import numpy as np
        import torch  # noqa: F401 - 설치 여부만 미리 확인하는 용도 (아래서 직접 호출 안 함)
        from datasets import Dataset
        from sklearn.model_selection import train_test_split
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
            Trainer,
            TrainingArguments,
        )
    except ImportError as e:
        raise SystemExit(
            "필요한 패키지가 없습니다. `pip install -r requirements-nlp-heavy.txt "
            "datasets`로 설치하세요.\n원본 오류: " + str(e)
        )

    examples: List[Tuple[str, int]] = load_training_data()
    texts = [t for t, _ in examples]
    labels = [l for _, l in examples]
    print(f"전체 학습 데이터: {len(texts)}개 (관련 {sum(labels)}개 / 무관 {len(labels) - sum(labels)}개)")

    train_texts, eval_texts, train_labels, eval_labels = train_test_split(
        texts, labels, test_size=args.test_size, random_state=args.seed, stratify=labels
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    id2label = {0: "NOT_RELEVANT", 1: "RELEVANT"}
    label2id = {v: k for k, v in id2label.items()}
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model, num_labels=2, id2label=id2label, label2id=label2id
    )

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=64)

    train_ds = Dataset.from_dict({"text": train_texts, "label": train_labels}).map(tokenize, batched=True)
    eval_ds = Dataset.from_dict({"text": eval_texts, "label": eval_labels}).map(tokenize, batched=True)

    def compute_metrics(eval_pred):
        logits, refs = eval_pred
        preds = np.argmax(logits, axis=-1)
        acc = float((preds == refs).mean())
        tp = int(((preds == 1) & (refs == 1)).sum())
        fp = int(((preds == 1) & (refs == 0)).sum())
        fn = int(((preds == 0) & (refs == 1)).sum())
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        return {"accuracy": acc, "precision": precision, "recall": recall, "f1": f1}

    training_args = TrainingArguments(
        output_dir=args.output + "-tmp",
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        eval_strategy="epoch",
        save_strategy="no",
        logging_steps=10,
        seed=args.seed,
        report_to=[],
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate()
    print("\n[held-out 평가]")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    print(
        "\n위 accuracy/f1을 relevance_classifier.py 상단 docstring의 TF-IDF "
        "베이스라인(코퍼스+SEED 92.3%/92.7%)과 비교해서, 실제로 개선됐는지 "
        "확인한 뒤 배포 여부를 결정할 것."
    )

    Path(args.output).mkdir(parents=True, exist_ok=True)
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"\n체크포인트 저장 완료: {args.output}")
    print(
        "다음으로 .env에 TRANSFORMER_RELEVANCE_MODEL_DIR="
        f"{args.output} 와 ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER=true 를 "
        "설정하면 relevance_classifier.get_default_classifier()가 이 체크포인트를 사용한다."
    )


if __name__ == "__main__":
    main()
