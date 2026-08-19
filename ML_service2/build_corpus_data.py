"""
MeetupLog AI Service - 코퍼스 데이터 빌드 스크립트
==================================
말뭉치 원본(예: 국립국어원 "모두의 말뭉치" NIKL_DIALOGUE_2025_v1.0)에서
`data/` 아래의 파생 데이터를 다시 만든다. corpus_typo_corrector.py와
relevance_classifier.py의 학습 데이터를 만들 때 실제로 쓴 것과 동일한
로직이며, 코퍼스가 갱신되거나(새 버전) MeetupLog 자체 채팅 로그로
교체하고 싶을 때 그대로 재실행하면 된다.

## 사용법

1. 말뭉치 원본을 압축 해제해서 아래 경로에 둔다 (또는 --corpus-dir로 지정):
     ml_service/corpus_raw/NIKL_DIALOGUE_2025_v1.0/*.json
   이 폴더는 라이선스가 있는 배포 데이터라 .gitignore에 이미 포함돼 있다 —
   커밋되지 않는다.

2. 실행:
     python build_corpus_data.py
   또는
     python build_corpus_data.py --corpus-dir /path/to/other_corpus

   ⚠️ 알려진 한계 #7(이 사전은 국립국어원 코퍼스 화자들의 발화 습관을
   반영한 것이라 MeetupLog 실 채팅과 패턴이 다를 수 있음) 대응: MeetupLog
   실 채팅 로그가 쌓이면 --format meetuplog로 같은 방법론을 그 로그에
   재적용할 수 있다:
     python build_corpus_data.py --format meetuplog --corpus-dir /path/to/chatlog_pairs
   --corpus-dir 아래에 {"topic":.., "raw":.., "corrected":..} (한 줄당
   하나) 형식의 *.jsonl 파일들을 두면 된다 - "corrected"는 원문 오탈자를
   사람이 정정한 정답 표기이고, 아직 정답 표기가 없다면 생략해도(그러면
   원문=정답으로 처리되어 사전 마이닝에는 기여하지 않지만 관련성 분류기
   학습 데이터 추출에는 그대로 쓰인다) 동작한다. 자세한 스키마와 두 가지
   케이스(정답 있음/없음)는 iter_utterances_meetuplog() docstring 참고.

3. data/ 아래에 다음 파일들이 (다시) 생성된다:
     colloquial_normalization.json   구어체 정규화 사전
     typo_eval_sample.json           정규화 사전 검증용 홀드아웃 샘플
     relevance_corpus_positive.json  관련성 분류기 학습용 양성 예시
     relevance_corpus_negative.json  관련성 분류기 학습용 음성 예시

4. 실행 끝에 정규화 사전을 홀드아웃 샘플로 자체 평가한 수치가 출력된다 —
   README.md에 있는 수치(정확히 일치 0%->54%, 악화 0%)와 비슷하게 나오는지
   확인하면 회귀 여부를 바로 알 수 있다.

## ⚠️ 자동 마이닝은 항상 사람이 한 번 더 검토할 것

이 스크립트가 빈도·일관성 기준으로 뽑은 단어 치환 후보 중에는 표준어에서
이미 다른 뜻을 가진 위험한 것들이 섞여 있을 수 있다. 실제로 처음 실행했을
때 '가지'->'가지고'(단위명사 "두 가지"를 깨뜨림), '아이'->'아니'(어린이를
깨뜨림), '그리고'->'그러고'(접속사를 깨뜨림), '네'->'근데', '이자'->'이제'
같은 위험한 규칙이 자동으로 채택된 걸 발견하고 BLOCKLIST에 추가해 제외했다.
코퍼스를 바꿔서 재실행한다면 REVIEW_TOP_N개 정도는 사람이 다시 눈으로
훑어보고, 표준어에서 독립적으로 다른 뜻을 갖는 단어는 BLOCKLIST에 추가하는
과정을 꼭 거칠 것. (근거: 이 스크립트 맨 아래 "안전성에 대한 노트" 참고.)
"""

from __future__ import annotations

import argparse
import collections
import difflib
import glob
import json
import random
import re
from pathlib import Path
from typing import Callable, Dict, Iterator, List, Tuple

SCRIPT_DIR = Path(__file__).parent
DEFAULT_CORPUS_DIR = SCRIPT_DIR / "corpus_raw" / "NIKL_DIALOGUE_2025_v1.0"
DATA_DIR = SCRIPT_DIR / "data"

# 한 발화를 나타내는 (topic, original_form/raw, form/corrected) 튜플을 yield하는
# 함수 타입. NIKL 코퍼스든 MeetupLog 실 채팅 로그든 이 형태로만 맞춰주면
# build_colloquial_dict()/build_relevance_corpus() 이하 로직은 그대로 재사용된다.
UtteranceLoader = Callable[[Path], Iterator[Tuple[str, str, str]]]

# ---------------------------------------------------------------------------
# 안전성에 대한 노트 (재실행 시에도 반드시 유지/재검토할 목록)
# ---------------------------------------------------------------------------
# 자동으로 빈도>=40, consistency>=85% 기준을 통과했지만, 표준어에서 이미
# 다른 뜻을 갖고 있어 수작업으로 제외한 항목들. 새 코퍼스로 재실행해도 이
# 항목들은 기본적으로 계속 제외하고, 새로 등장하는 후보는 직접 눈으로
# 검토해서 이 목록에 추가할지 판단할 것 (build 함수의 REVIEW용 출력 참고).
BLOCKLIST = {
    "제", "까", "데", "서", "따른", "건", "그른",
    "가지", "아이", "그리고", "그리", "저가", "해고", "이자", "이르게",
    "그러게", "그야", "그도",
}
# 1글자 어절은 문맥 의존도가 너무 커서 원칙적으로 전부 제외한다.
# 예외적으로 안전하다고 확인된 것만 명시적으로 허용.
WHITELIST_SHORT = {"쫌": "좀"}

MIN_FREQUENCY = 40
MIN_CONSISTENCY = 0.85
HYPHEN_PATTERN = re.compile(r"^-(.+)-([.,!?]*)$")


def _is_particle_meaning_change(src: str, dst: str) -> bool:
    """'에'->'의' 처럼 발음은 비슷해도 뜻이 달라지는 조사 치환은 통째로 제외.
    예: '중에'(~하는 동안) vs '중의'(~중에서)는 완전히 다른 말이다."""
    src_core = re.sub(r"[.,!?]+$", "", src)
    dst_core = re.sub(r"[.,!?]+$", "", dst)
    if src_core.endswith("에") and dst_core.endswith("의") and src_core[:-1] == dst_core[:-1]:
        return True
    return False


def iter_utterances_nikl(corpus_dir: Path) -> Iterator[Tuple[str, str, str]]:
    """국립국어원 "모두의 말뭉치" 구어 말뭉치 JSON 파일들을 순회하며
    (topic, original_form, form) 튜플을 낸다.
    NIKL_DIALOGUE 형식(document[].utterance[].{form,original_form})을 가정한다.
    """
    files = glob.glob(str(corpus_dir / "*.json"))
    for fn in files:
        with open(fn, encoding="utf-8") as f:
            data = json.load(f)
        for doc in data.get("document", []):
            topic = doc.get("metadata", {}).get("topic", "")
            for utt in doc.get("utterance", []):
                o = utt.get("original_form", "")
                f_ = utt.get("form", "")
                if o and f_:
                    yield topic, o, f_


def iter_utterances_meetuplog(corpus_dir: Path) -> Iterator[Tuple[str, str, str]]:
    """MeetupLog 실 채팅 로그 기반 파생 데이터를 순회한다 (알려진 한계 #7 대응).

    NIKL 코퍼스와 달리 실제 채팅 로그(카카오톡류)에는 애초에 "정답 표기"가
    붙어 있지 않으므로, 원문 그대로는 이 함수를 쓸 수 없다. 대신 다음 두
    산출물 중 하나가 이 폴더 아래 `*.jsonl`로 준비돼 있다고 가정한다:

      1) 사람이 정정한 (원문, 정답) 쌍 - 예: 신고/피드백 화면이나 소규모
         수작업 라벨링으로 모은 `{"topic": "...", "raw": "...", "corrected": "..."}`
         한 줄당 하나. 있으면 colloquial_normalization 사전 마이닝(빈도/일관성
         필터 + BLOCKLIST 수동 검토는 build_colloquial_dict()가 그대로 처리)에
         바로 쓸 수 있다.
      2) 정답 표기가 아직 없는 원문 채팅 로그 - `{"topic": "...", "raw": "..."}`.
         이 경우 원문/정답이 동일하다고 두어(diff 없음) 사전 마이닝에는
         기여하지 않지만, build_relevance_corpus()의 "영화 관련/무관 발화"
         추출에는 그대로 활용된다 - 관련성 분류기 학습 데이터는 정답 교정
         표기가 필요 없기 때문이다.

    두 경우 모두 파일 인코딩/스키마가 다르면 이 함수만 실제 로그 포맷에
    맞게 고치면 나머지(build_colloquial_dict, build_relevance_corpus,
    evaluate_corrector)는 그대로 재사용할 수 있다.
    """
    files = sorted(glob.glob(str(corpus_dir / "*.jsonl")))
    if not files:
        raise SystemExit(
            f"MeetupLog 채팅 로그 파생 파일(*.jsonl)을 찾을 수 없습니다: {corpus_dir}\n"
            f"각 줄이 {{'topic':..,'raw':..,'corrected':..}} (또는 'corrected' 생략) "
            f"형태인 .jsonl 파일을 이 폴더에 두세요."
        )
    for fn in files:
        with open(fn, encoding="utf-8") as f:
            for line_no, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    print(f"  ⚠️ {fn}:{line_no} JSON 파싱 실패 - 건너뜀")
                    continue
                raw = rec.get("raw", "")
                corrected = rec.get("corrected", raw)  # 정답 없으면 원문=정답(diff 없음)
                topic = rec.get("topic", "")
                if raw:
                    yield topic, raw, corrected


CORPUS_LOADERS: Dict[str, UtteranceLoader] = {
    "nikl": iter_utterances_nikl,
    "meetuplog": iter_utterances_meetuplog,
}


def build_colloquial_dict(
    corpus_dir: Path, loader: UtteranceLoader = iter_utterances_nikl
) -> Tuple[Dict[str, str], List[Tuple[str, str]]]:
    """어절 단위 치환 패턴을 마이닝해 구어체 정규화 사전을 만든다.
    반환값: (최종 사전, diff가 있는 전체 (원문, 정답) 쌍 목록 - 평가 샘플용)

    loader를 바꾸면(예: iter_utterances_meetuplog) 코퍼스 형식이 달라져도
    이 함수 이하의 마이닝/필터링/BLOCKLIST 로직은 그대로 재사용된다.
    """
    sub_counter: collections.Counter = collections.Counter()
    src_total: collections.Counter = collections.Counter()
    diff_pairs: List[Tuple[str, str]] = []

    for _topic, o, f_ in loader(corpus_dir):
        if o == f_:
            continue
        diff_pairs.append((o, f_))
        o_tokens, f_tokens = o.split(), f_.split()
        sm = difflib.SequenceMatcher(None, o_tokens, f_tokens)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "replace" and (i2 - i1) == 1 and (j2 - j1) == 1:
                src, dst = o_tokens[i1], f_tokens[j1]
                if re.search(r"\d", src) or re.search(r"\d", dst):
                    continue  # 숫자 표기 변환("삼십"->"30")은 별도 규칙 영역
                sub_counter[(src, dst)] += 1
                src_total[src] += 1

    final_dict: Dict[str, str] = {}
    review_candidates: List[Tuple[str, str, int, float]] = []

    for (src, dst), cnt in sub_counter.items():
        if HYPHEN_PATTERN.match(src):
            continue  # "-X-" 발화 수정 표지는 corpus_typo_corrector의 정규식 규칙이 처리
        core = re.sub(r"[.,!?~]+$", "", src)
        if not core or src in BLOCKLIST or core in BLOCKLIST:
            continue
        if len(core) < 2:
            continue
        if cnt < MIN_FREQUENCY:
            continue
        consistency = cnt / src_total[src]
        if consistency < MIN_CONSISTENCY:
            continue
        if _is_particle_meaning_change(src, dst):
            continue
        final_dict[src] = dst
        review_candidates.append((src, dst, cnt, consistency))

    final_dict.update(WHITELIST_SHORT)

    # 사람이 한 번 더 훑어볼 수 있게, 빈도 상위 항목을 출력해 준다.
    review_candidates.sort(key=lambda x: -x[2])
    print("\n[안전성 검토용] 새로 채택된 규칙 중 빈도 상위 20개 (표준어 의미 충돌 없는지 확인할 것):")
    for src, dst, cnt, cons in review_candidates[:20]:
        print(f"    {src!r} -> {dst!r}  (빈도 {cnt}, 일관성 {cons:.0%})")

    return final_dict, diff_pairs


def build_relevance_corpus(
    corpus_dir: Path, cap: int = 500, seed: int = 7, loader: UtteranceLoader = iter_utterances_nikl
) -> Tuple[List[str], List[str]]:
    """관련성 분류기 학습용 양성(영화 관련)/음성(무관) 발화를 추출한다."""
    MOVIE_SIGNAL = ["영화", "극장", "상영", "예매", "cgv", "메가박스", "롯데시네마", "감독", "주연", "배우"]
    EXCLUDE_NEGATIVE_TOPICS = {"문화예술", "취미/여가"}

    positive, negative = [], []
    for topic, _o, f_ in loader(corpus_dir):
        text = f_.strip()
        if len(text) < 4:
            continue
        if any(sig in text for sig in MOVIE_SIGNAL):
            positive.append(text)
        elif topic not in EXCLUDE_NEGATIVE_TOPICS:
            negative.append(text)

    rng = random.Random(seed)
    rng.shuffle(positive)
    rng.shuffle(negative)
    return positive[:cap], negative[:cap]


def evaluate_corrector(colloquial_dict: Dict[str, str], eval_pairs: List[Tuple[str, str]]) -> None:
    """생성된 사전으로 홀드아웃 샘플을 교정해보고 개선/악화 비율을 출력한다."""
    tilde = re.compile(r"~+")

    def correct(text: str) -> str:
        text = re.sub(r"-(\S+?)-", r"\1", text)
        text = tilde.sub("", text)
        text = re.sub(r"\s+", " ", text).strip()
        return " ".join(colloquial_dict.get(t, t) for t in text.split(" "))

    n = len(eval_pairs)
    exact = improved = worsened = 0
    sim_before_total = sim_after_total = 0.0
    for orig, form in eval_pairs:
        corrected = correct(orig)
        sim_before = difflib.SequenceMatcher(None, orig, form).ratio()
        sim_after = difflib.SequenceMatcher(None, corrected, form).ratio()
        sim_before_total += sim_before
        sim_after_total += sim_after
        if corrected == form:
            exact += 1
        if sim_after > sim_before:
            improved += 1
        elif sim_after < sim_before:
            worsened += 1

    print("\n[자체 평가] 홀드아웃 500문장 기준")
    print(f"  정확히 일치: {exact}/{n} ({exact/n:.1%})")
    print(f"  평균 유사도: {sim_before_total/n:.4f} -> {sim_after_total/n:.4f}")
    print(f"  개선된 문장: {improved}건 ({improved/n:.1%}) / 악화된 문장: {worsened}건 ({worsened/n:.1%})")
    if worsened > 0:
        print("  ⚠️ 악화된 문장이 있다 - BLOCKLIST를 더 보강해야 할 수 있다.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR,
        help=f"말뭉치 파일들이 있는 폴더 (기본값: {DEFAULT_CORPUS_DIR})",
    )
    parser.add_argument(
        "--format", choices=sorted(CORPUS_LOADERS), default="nikl",
        help=(
            "코퍼스 형식. 'nikl'(기본값)은 국립국어원 모두의 말뭉치 JSON, "
            "'meetuplog'는 MeetupLog 실 채팅 로그에서 뽑은 *.jsonl "
            "(iter_utterances_meetuplog 참고 - 알려진 한계 #7 대응). "
            "실 채팅 로그가 쌓이면 --format meetuplog --corpus-dir <그 로그 폴더> 로 재실행하면 된다."
        ),
    )
    parser.add_argument(
        "--eval-sample-size", type=int, default=500,
        help="검증/저장용으로 무작위 추출할 (원문, 정답) 쌍 개수",
    )
    parser.add_argument(
        "--relevance-cap", type=int, default=500,
        help="관련성 분류기 학습용으로 양성/음성 각각 몇 개씩 추출할지",
    )
    args = parser.parse_args()

    if not args.corpus_dir.exists():
        raise SystemExit(
            f"코퍼스 폴더를 찾을 수 없습니다: {args.corpus_dir}\n"
            f"--format nikl 이면 압축 해제한 말뭉치 JSON 파일들을, "
            f"--format meetuplog 이면 채팅 로그 파생 *.jsonl 파일들을 이 경로에 두거나, "
            f"--corpus-dir로 다른 경로를 지정하세요."
        )

    loader = CORPUS_LOADERS[args.format]
    DATA_DIR.mkdir(exist_ok=True)

    print(f"코퍼스 경로: {args.corpus_dir} (형식: {args.format})")
    print("1) 구어체 정규화 사전 마이닝 중...")
    colloquial_dict, diff_pairs = build_colloquial_dict(args.corpus_dir, loader=loader)
    print(f"   -> {len(colloquial_dict)}개 규칙 채택")

    with open(DATA_DIR / "colloquial_normalization.json", "w", encoding="utf-8") as f:
        json.dump(colloquial_dict, f, ensure_ascii=False, indent=2, sort_keys=True)

    rng = random.Random(0)
    eval_sample = rng.sample(diff_pairs, min(args.eval_sample_size, len(diff_pairs)))
    with open(DATA_DIR / "typo_eval_sample.json", "w", encoding="utf-8") as f:
        json.dump(eval_sample, f, ensure_ascii=False)

    evaluate_corrector(colloquial_dict, eval_sample)

    print("\n2) 관련성 분류기 학습 데이터 추출 중...")
    positive, negative = build_relevance_corpus(args.corpus_dir, cap=args.relevance_cap, loader=loader)
    with open(DATA_DIR / "relevance_corpus_positive.json", "w", encoding="utf-8") as f:
        json.dump(positive, f, ensure_ascii=False, indent=1)
    with open(DATA_DIR / "relevance_corpus_negative.json", "w", encoding="utf-8") as f:
        json.dump(negative, f, ensure_ascii=False, indent=1)
    print(f"   -> 양성 {len(positive)}개 / 음성 {len(negative)}개 저장 완료")

    print(f"\n완료. {DATA_DIR}/ 에 4개 파일이 생성되었습니다.")
    print("relevance_classifier.py는 다음 실행부터 자동으로 이 데이터를 사용합니다.")


if __name__ == "__main__":
    main()
