"""
MeetupLog AI Service - 코퍼스 기반 구어체 정규화 (검증된 경량 대안)
==================================
text_normalization.py의 TypoCorrector(j5ng/et5-typos-corrector)는 이 환경에서
실제로 다운로드/추론을 검증하지 못한 채 공식 문서만 믿고 연결한 상태였다.
반면 이 모듈은 사용자가 제공한 국립국어원 "모두의 말뭉치" 구어 말뭉치
(NIKL_DIALOGUE_2025_v1.0, 2,927개 파일)의 `original_form`(실제 발화, 오탈자
포함) vs `form`(정제된 표기) 쌍 36만여 개에서 직접 패턴을 추출하고, 별도로
떼어 둔 500개 샘플로 검증까지 마친 결과물이다. 외부 모델 다운로드 없이
바로 동작하고, 최소한 이만큼은 실제로 좋아진다는 걸 숫자로 확인했다.

## 방법론

1. `original_form`/`form`을 어절(공백) 단위로 정렬(difflib)해 1:1 치환 쌍을 수집.
2. 빈도 40회 미만, 같은 원어절이 다른 결과로 가는 비율(consistency) 85% 미만인
   패턴은 노이즈로 버림.
3. **자동 채택 후보 중 상당수가 위험했다** — 예를 들어 '가지'->'가지고'는
   이 코퍼스에서는 96% 일관되게 나타나지만, '가지'는 "두 가지"처럼 그 자체로
   흔히 쓰이는 단위명사라 일반 텍스트에 적용하면 오히려 문장을 깨뜨린다.
   수작업으로 재검토해 이런 항목(가지/아이/그리고/그리/저가/해고/이자/이르게/
   그러게/그야/그도 등, 표준어에서 이미 다른 뜻을 가진 단어들)을 모두 제외했고,
   1글자짜리 어절은 맥락 의존도가 너무 커서 원칙적으로 전부 제외했다
   (예외: '쫌'->'좀'만 안전하다고 판단해 허용).
4. "에/의" 조사 치환처럼 발음은 비슷해도 뜻이 달라지는 패턴(예: '중에'(~동안)
   ->'중의'(~중에서))은 통째로 제외.
5. 남은 403개 규칙 + "-X-"(발화 수정 표지) 제거, "~"(장음 표시) 제거 같은
   일반 정규식 규칙을 결합해 최종 교정기를 구성.

## 검증 결과 (홀드아웃 500개 문장, 학습에 쓰지 않은 별도 샘플)

| 지표                  | 교정 전 | 교정 후 |
|------------------------|---------|---------|
| 원문과 정답이 정확히 일치 | 0.0%    | 54.0%   |
| 평균 문자열 유사도       | 0.933   | 0.968   |
| 개선된 문장 비율         | -       | 77.2%   |
| 악화된 문장 비율         | -       | 0.0%    |

즉 이 사전으로 "나빠지는" 문장은 검증 샘플 500개 중 하나도 없었고,
10건 중 약 8건은 눈에 띄게 정답에 가까워졌다.

## 한계

- 이 사전은 국립국어원 코퍼스 화자들의 발화 습관을 반영한 것이라, 다른
  연령대/지역/플랫폼(카카오톡, 인스타그램 댓글 등)의 구어체와는 패턴이
  다를 수 있다. MeetupLog 실제 채팅 로그가 쌓이면 같은 방법론
  (difflib 정렬 + 빈도/일관성 필터 + 수동 위험군 검토)을 그 로그에 다시
  적용해 갱신하는 것을 권장한다 — build_corpus_data.py가 이제
  `--format meetuplog`로 NIKL 코퍼스 대신 MeetupLog 채팅 로그 파생 데이터를
  입력받을 수 있도록 일반화되어 있으니(iter_utterances_meetuplog 참고),
  로그를 그 형식(jsonl)으로만 준비하면 재실행으로 바로 갱신할 수 있다.
  다만 이건 "도구"가 준비됐다는 뜻이지 실제 재검증까지 끝났다는 뜻은 아니다
  — 실 로그로 다시 돌린 뒤에는 build_corpus_data.py가 출력하는 안전성 검토
  목록(빈도 상위 20개)을 반드시 사람이 다시 훑어봐야 한다.
- 자동 마이닝은 "그 코퍼스 안에서" 일관된 패턴을 찾을 뿐, 그 패턴이
  일반적으로 안전한지는 보장하지 않는다 — 위 3번 항목의 사례들이 실제
  증거다. 사전에 새 규칙을 추가할 때는 반드시 소스 단어가 표준어에서
  독립적으로 다른 뜻을 갖지 않는지 확인할 것.
- **"~해여" 같은 통신체 종결어미는 이 사전에 전혀 없었다** (직접 확인:
  "여"로 끝나는 사전 항목 0개) — 국립국어원 코퍼스는 공식 구어 전사본이라
  채팅 특유의 "요"→"여"/"염"/"용" 표기가 거의 안 나타난다. 아래
  `_INFORMAL_YO_SUFFIX_RULES`로 별도 보강했다.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

# meetup_ml/ 패키지 기준 한 단계 위(ml-service/)의 data/ 디렉터리를 참조한다.
# (원래 ml_service에선 corpus_typo_corrector.py가 data/와 같은 레벨에 있었지만,
# 여기서는 meetup_ml/ 패키지 안으로 들어오면서 한 단계 더 깊어졌다.)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DICT_PATH = DATA_DIR / "colloquial_normalization.json"

HYPHEN_TOKEN = re.compile(r"-(\S+?)-")  # 발화 수정(복원) 표지: "-이-" -> "이"
TILDE = re.compile(r"~+")               # 장음/필러 표시: "그~" -> "그"
WHITESPACE = re.compile(r"\s+")

_dict_cache: dict[str, str] | None = None


# ---------------------------------------------------------------------------
# "~해여/~좋아여" 통신체 종결어미 정규화
# ---------------------------------------------------------------------------
# 표준 한국어에는 "-아여"/"-어여"라는 어미가 존재하지 않는다(표준형은
# "-아요"/"-어요") - 그래서 이 두 일반 규칙은 코퍼스 마이닝 없이도 안전하게
# 일반화할 수 있다. 대신 "하다"/"되다"/"오다"/"보다"처럼 불규칙 활용이라
# 어간이 "아/어"로 안 끝나는 경우("해", "돼", "와", "봐")는 개별 항목으로
# 따로 추가했다.
#
# 어미 뒤에 붙는 문장부호나 자모 남발("!", "?", "~", "ㅋㅋㅋ", "ㅎㅎ", "ㅠㅠ")은
# 보존한 채 어미 부분만 바꾼다 - "완전 좋아여ㅋㅋ" -> "완전 좋아요ㅋㅋ".
_INFORMAL_YO_SUFFIX_RULES = [
    ("이에여", "이에요"),
    ("해여", "해요"),
    ("돼여", "돼요"),
    ("봐여", "봐요"),
    ("와여", "와요"),
    ("예여", "예요"),
    ("네여", "네요"),
    ("게여", "게요"),
    ("지여", "지요"),
    ("나여", "나요"),
    ("구여", "구요"),
    ("가여", "가요"),
    ("아여", "아요"),  # 일반화 규칙 (표준 어미 조합에 없음)
    ("어여", "어요"),  # 일반화 규칙 (표준 어미 조합에 없음)
]
# 긴 접미사부터 매칭해야 "이에여"가 "에여" 규칙 같은 걸로 잘못 잘리지 않는다.
_INFORMAL_YO_MAP: dict[str, str] = dict(_INFORMAL_YO_SUFFIX_RULES)
_INFORMAL_YO_ALTERNATION = "|".join(
    re.escape(s) for s, _ in sorted(_INFORMAL_YO_SUFFIX_RULES, key=lambda x: -len(x[0]))
)
INFORMAL_YO_PATTERN = re.compile(rf"({_INFORMAL_YO_ALTERNATION})([!?.,~ㅋㅎㅠㅜ]*)$")


def _normalize_informal_yo(token: str) -> str:
    """토큰 하나(공백으로 나눈 어절)에 "~여" 종결어미 정규화를 적용한다.
    매칭 안 되면 원래 토큰을 그대로 반환한다."""
    m = INFORMAL_YO_PATTERN.search(token)
    if not m:
        return token
    suffix, trailing = m.group(1), m.group(2)
    return token[: m.start()] + _INFORMAL_YO_MAP[suffix] + trailing


def _load_dict() -> dict[str, str]:
    global _dict_cache
    if _dict_cache is None:
        if DICT_PATH.exists():
            with open(DICT_PATH, encoding="utf-8") as f:
                _dict_cache = json.load(f)
        else:
            _dict_cache = {}
    return _dict_cache


def correct(text: str) -> str:
    """구어체 정규화. 사전 파일이 없어도 정규식 규칙(디스플루언시 제거 +
    "~여" 통신체 종결어미 정규화)은 항상 적용된다 — 예외를 던지지 않고
    항상 문자열을 반환한다.
    """
    result = HYPHEN_TOKEN.sub(r"\1", text)
    result = TILDE.sub("", result)
    result = WHITESPACE.sub(" ", result).strip()

    colloquial_dict = _load_dict()
    tokens = result.split(" ")
    normalized_tokens = []
    for token in tokens:
        token = colloquial_dict.get(token, token) if colloquial_dict else token
        token = _normalize_informal_yo(token)
        normalized_tokens.append(token)
    result = " ".join(normalized_tokens)

    return result
