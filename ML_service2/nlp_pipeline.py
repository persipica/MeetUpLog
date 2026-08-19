"""
MeetupLog AI Service - NLP 파이프라인 (강화판)
==================================
기획서 8~9장 FR-AI-01~06 대응. v1 대비 강화된 부분:

1) 절(clause) 단위 분석
   "가벼운 건 좋은데 무서운 건 싫어" 처럼 한 메시지에 극성이 다른 발화가
   섞여 있어도, 문장 전체가 아니라 절 단위로 부정을 스코핑해 오탐을 줄인다.

2) 강도 부사 반영
   "완전 좋아" / "그냥 그럭저럭" 처럼 강도 표현으로 스코어 크기를 조정한다.

3) 제외(HARD) 표현 인식
   "~말고", "~빼고", "~제외" 는 단순 비선호(-1)가 아니라 제약조건
   (Constraints.excluded_genres)에 반영해 추천 후보에서 강제 제외한다.

4) Focus 문맥 연동 (FR-AI-05)
   "그거 좋음", "나도" 같은 생략 발화를 ConversationFocus에 보관된
   직전 장르/영화와 실제로 연결해 State에 반영한다(이전 버전은 별도
   함수로만 존재하고 파이프라인에 연결되지 않았던 부분을 통합).

5) 학습형 관련성 분류기 결합
   규칙 기반 점수와 TF-IDF+LogisticRegression 분류기(relevance_classifier.py)
   확률을 가중합산한 하이브리드 스코어로 Relevance Filter 정확도를 높인다.

6) 신뢰도(confidence) 노출
   추출된 각 속성에 몇 개의 근거(절 매칭 수, 강도)가 뒷받침되는지를
   confidence로 함께 반환해, FR-AI-08 "근거 수준" 설명에 활용할 수 있게 한다.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import config
from models import ScoredSignal, UserPreferenceState
from relevance_classifier import get_default_classifier
from slang_lexicon import normalize_slang
from text_normalization import normalize_text
from time_utils import to_aware_utc, utc_now

# ---------------------------------------------------------------------------
# 사전
# ---------------------------------------------------------------------------

MOVIE_CONTEXT_KEYWORDS = [
    "영화", "볼까", "상영", "예매", "극장", "cgv", "메가박스", "롯데시네마",
    "감독", "배우", "장르", "런닝타임", "관람등급", "예고편", "결말", "평점",
]

GENRE_KEYWORDS = {
    # --- TMDB 공식 장르와 이름이 정확히 일치하는 카테고리
    #     (movie.genres와 문자열로 직접 매칭됨 - movie_catalog.TMDB_GENRE_NAMES_KO 참고) ---
    "액션": ["액션", "격투", "전투", "활극"],
    "코미디": ["코미디", "웃긴", "개그", "유쾌한"],
    "공포": ["공포", "호러", "귀신", "괴담", "좀비"],
    "로맨스": ["로맨스", "멜로", "연애물"],
    "SF": ["sf", "공상과학", "우주"],
    "드라마": ["드라마", "감동적인"],
    "스릴러": ["스릴러", "추리물"],
    "범죄": ["범죄"],  # TMDB의 별도 장르(Crime) - 예전엔 "스릴러"에 섞여 있었음
    "애니메이션": ["애니", "애니메이션"],
    "음악": ["뮤지컬", "음악영화"],  # TMDB 장르명은 "음악"(Music). "뮤지컬"은 구어 동의어로 매칭용 키워드에만 사용
    "판타지": ["판타지"],
    "다큐멘터리": ["다큐", "다큐멘터리"],
    "전쟁": ["전쟁"],

    # --- TMDB 공식 장르 목록에 없는 카테고리 ---
    # movie.genres에는 원래 못 들어가지만, movie_catalog.py가 TMDB "키워드"
    # (movie/{id}/keywords)를 KEYWORD_TAG_ALIASES로 정규화해 얹어주기 때문에
    # fetch_detail()로 채운 영화에 한해 매칭이 가능하다. 목록/인기 API로만
    # 가져온 영화는 이 카테고리들이 비어있을 수 있다 - movie_catalog.py의
    # "TMDB 키워드" 절 참고.
    "재난": ["재난"],
    "무협": ["무협"],
    "히어로": ["히어로", "슈퍼히어로"],
}

MOOD_KEYWORDS = {
    "가벼운": ["가벼운", "가볍게", "편하게", "부담없는"],
    "잔잔한": ["잔잔한", "잔잔하게", "힐링", "따뜻한"],
    "무서운": ["무서운", "무섭지", "오싹한", "소름"],
    "긴장감있는": ["긴장감", "몰입감", "긴장되는"],
}

# 절 내부에서 "이 클로즈는 부정문이다"를 판단하는 마커
NEGATION_MARKERS = ["안", "못", "싫", "별로", "아니"]

# 부정이면서 동시에 강제 제외(HARD)를 의미하는 마커
HARD_EXCLUSION_MARKERS = ["말고", "빼고", "제외", "말구"]

# 강도 부사: 스코어(절대값)에 곱해지는 배수
INTENSITY_MODIFIERS = {
    "완전": 1.4, "진짜": 1.3, "너무": 1.3, "엄청": 1.3, "정말": 1.3,
    "그냥": 0.6, "조금": 0.6, "약간": 0.6, "그럭저럭": 0.5,
}

REFERENCE_MARKERS = [
    "그거", "그 영화", "아까", "그거보다", "나도", "저것도", "그것도",
    "이거", "이 영화", "이번 거", "인정",  # "인정"은 ㅇㅈ 정규화 결과이자 그 자체로도 쓰이는 동의 표현
]

RUNTIME_PATTERN = re.compile(r"(\d+)\s*분\s*(이내|안|미만|넘지|이상|넘는)?")
ADULT_EXCLUDE_KEYWORDS = ["19금 빼고", "청불 제외", "미성년자", "청소년 관람불가 빼고"]

# 절 분리 구분자 (문장부호 + 대표 접속/전환 표현)
# "좋은데/좋아하는데/힘들지만" 처럼 어미에 붙는 대조 연결어미(-는데/-은데/-던데/-지만)도
# 공백 앞에서 분리해, 한 문장 안의 서로 다른 극성이 섞이지 않도록 한다.
CLAUSE_SPLIT_PATTERN = re.compile(r"[,.!?]|그런데|근데|하지만|그리고|(?:는데|은데|던데|지만)\s")

# 관련성 하이브리드 스코어의 규칙기반:분류기 가중치
RULE_WEIGHT = 0.4
CLASSIFIER_WEIGHT = 0.6


# ---------------------------------------------------------------------------
# 절 분리 & 강도/부정 로컬 스코프
# ---------------------------------------------------------------------------

def split_clauses(text: str) -> List[str]:
    parts = [p.strip() for p in CLAUSE_SPLIT_PATTERN.split(text) if p and p.strip()]
    return parts or [text.strip()]


def _clause_polarity_and_intensity(clause: str) -> Tuple[float, bool]:
    """절 하나에 대해 (부호 있는 배수, HARD 제외 여부)를 계산한다.
    - 부정 마커가 있으면 음수
    - 강도 부사가 있으면 절대값 배수 적용
    - '말고/빼고/제외'가 있으면 HARD 제외로 표시
    """
    is_negative = any(m in clause for m in NEGATION_MARKERS)
    is_hard_exclusion = any(m in clause for m in HARD_EXCLUSION_MARKERS)

    intensity = 1.0
    for word, mult in INTENSITY_MODIFIERS.items():
        if word in clause:
            intensity = mult
            break

    sign = -1.0 if (is_negative or is_hard_exclusion) else 1.0
    return sign * intensity, is_hard_exclusion


# ---------------------------------------------------------------------------
# Relevance Filter (하이브리드: 규칙 + 학습형 분류기)
# ---------------------------------------------------------------------------

def _rule_relevance_score(text: str) -> float:
    text, _had_slang = normalize_slang(text)
    hits = sum(1 for kw in MOVIE_CONTEXT_KEYWORDS if kw in text)
    genre_hits = sum(1 for kws in GENRE_KEYWORDS.values() for kw in kws if kw in text)
    mood_hits = sum(1 for kws in MOOD_KEYWORDS.values() for kw in kws if kw in text)
    reference_hit = any(m in text for m in REFERENCE_MARKERS)
    raw = hits * 0.5 + genre_hits * 0.4 + mood_hits * 0.3 + (0.3 if reference_hit else 0)
    return 1 - math.exp(-raw)


def is_relevant(text: str, use_classifier: bool = True) -> Tuple[bool, float]:
    """Relevance Filter: 규칙 기반 점수와 학습형 분류기 확률을 가중합산한다.
    분류기 로드에 실패해도(예: 학습 데이터 없음) 규칙 기반으로 자연히 폴백한다.

    분류기는 원문(raw text) 그대로 입력한다 — "꿀잼"/"노잼" 같은 신조어 형태
    자체가 문자 n-gram 특징으로 학습되어 있어, 정규화 전 형태를 유지해야
    학습된 패턴과 맞아떨어진다. 반면 규칙 기반 점수와 엔티티 추출은
    normalize_slang()으로 일반 어휘로 치환한 뒤 처리한다.
    """
    rule_score = _rule_relevance_score(text)

    if use_classifier:
        try:
            clf_score = get_default_classifier().predict_proba(text)
        except Exception:
            clf_score = rule_score  # 폴백
        score = RULE_WEIGHT * rule_score + CLASSIFIER_WEIGHT * clf_score
    else:
        score = rule_score

    return score >= config.RELEVANCE_SCORE_THRESHOLD, round(score, 3)


# ---------------------------------------------------------------------------
# Entity 추출 (절 단위)
# ---------------------------------------------------------------------------

@dataclass
class ExtractedEntities:
    genres: Dict[str, float] = field(default_factory=dict)          # 장르 -> 극성*강도
    moods: Dict[str, float] = field(default_factory=dict)
    genre_confidence: Dict[str, float] = field(default_factory=dict)  # 0~1
    mood_confidence: Dict[str, float] = field(default_factory=dict)
    hard_excluded_genres: List[str] = field(default_factory=list)
    movie_titles: List[str] = field(default_factory=list)
    max_runtime: Optional[int] = None
    exclude_adult: bool = False
    had_slang_reaction: bool = False  # 신조어("꿀잼","노잼" 등)가 감지됐는지
    used_reference: bool = False  # Focus에서 값을 채웠는지 여부 (설명 가능성용)


def extract_entities(text: str) -> ExtractedEntities:
    """메시지를 절 단위로 나눠 각 절마다 부정/강도를 스코핑해서 추출한다.
    신조어는 normalize_slang()으로 먼저 일반 어휘("완전 재밌음" 등)로 치환한 뒤
    기존 절 분리·부정·강도 로직을 그대로 재사용한다."""
    text, had_slang = normalize_slang(text)
    result = ExtractedEntities(had_slang_reaction=had_slang)
    clauses = split_clauses(text)

    for clause in clauses:
        multiplier, is_hard = _clause_polarity_and_intensity(clause)

        for genre, keywords in GENRE_KEYWORDS.items():
            matched_kw = next((kw for kw in keywords if kw in clause.lower() or kw in clause), None)
            if not matched_kw:
                continue
            score = max(-1.0, min(1.0, multiplier))
            # 같은 장르가 여러 절에서 언급되면 더 강한(절대값 큰) 신호를 채택
            if genre not in result.genres or abs(score) > abs(result.genres[genre]):
                result.genres[genre] = score
            result.genre_confidence[genre] = min(1.0, result.genre_confidence.get(genre, 0) + 0.5)
            if is_hard and genre not in result.hard_excluded_genres:
                result.hard_excluded_genres.append(genre)

        for mood, keywords in MOOD_KEYWORDS.items():
            matched_kw = next((kw for kw in keywords if kw in clause), None)
            if not matched_kw:
                continue
            score = max(-1.0, min(1.0, multiplier))
            if mood not in result.moods or abs(score) > abs(result.moods[mood]):
                result.moods[mood] = score
            result.mood_confidence[mood] = min(1.0, result.mood_confidence.get(mood, 0) + 0.5)

    m = RUNTIME_PATTERN.search(text)
    if m:
        result.max_runtime = int(m.group(1))

    result.exclude_adult = any(kw in text for kw in ADULT_EXCLUDE_KEYWORDS)
    result.movie_titles = re.findall(r"[\"'“「《]([^\"'”」》]{1,30})[\"'”」》]", text)

    return result


# ---------------------------------------------------------------------------
# 시간 가중치 (FR-AI-06)
# ---------------------------------------------------------------------------

def time_weight(signal_time: datetime, now: Optional[datetime] = None,
                 half_life_days: int = None) -> float:
    """지수 감쇠(half-life) 가중치. half_life_days 가 지나면 가중치 0.5배.
    naive/aware datetime이 섞여 들어와도 to_aware_utc()로 정규화해 뺄셈
    오류를 방지한다."""
    half_life_days = half_life_days or config.TIME_DECAY_HALF_LIFE_DAYS
    now = to_aware_utc(now or utc_now())
    signal_time = to_aware_utc(signal_time)
    elapsed_days = max((now - signal_time).total_seconds() / 86400.0, 0.0)
    return 0.5 ** (elapsed_days / half_life_days)


def _weighted_average(signals: List[ScoredSignal], now: Optional[datetime] = None) -> float:
    if not signals:
        return 0.0
    weights = [time_weight(s.timestamp, now) for s in signals]
    total_w = sum(weights) or 1e-9
    return sum(w * s.score for w, s in zip(weights, signals)) / total_w


# ---------------------------------------------------------------------------
# Focus 문맥 (FR-AI-05) - 대화 진행 중 상태로 유지
# ---------------------------------------------------------------------------

@dataclass
class ConversationFocus:
    """'지금 이야기 중인 대상'.

    ⚠️ 반드시 방(room)/추천 라운드 단위로 **하나만** 만들어 모든 참여자가
    공유해야 한다. 그룹 채팅에서 "나도", "그거 좋아" 는 화자 자신의 과거
    발화가 아니라 방금 다른 사람이 말한 것을 가리키는 경우가 대부분이기
    때문이다. 사용자별로 별도 인스턴스를 두면 "A가 '드라마 어때' -> B가
    '나도'"에서 B의 발화가 아무것도 채우지 못하고 유실된다(과거 버전의
    실제 버그였음 - api.py/demo.py 참고).

    누가 마지막으로 채웠는지는 `last_speaker_id`에 남겨, 필요하면
    "본인이 방금 한 말에 자기가 나도라고 하는" 것 같은 이상 케이스를
    걸러내는 데 쓸 수 있다(현재 로직에서는 특별히 구분하지 않는다 —
    같은 사람이 강조차 재확인하는 것도 유효한 신호로 본다).

    ⚠️ 슬롯별 발화 시각 (last_genre_at / last_mood_at / last_movie_at)
    장르/무드/영화를 각각 별도 슬롯으로 들고 있기 때문에, 한 라운드 안에서
    서로 다른 사용자가 서로 다른 속성을 연달아 언급할 수 있다(예: A가
    무드, B가 장르 언급). 이전 버전은 "그거"가 나왔을 때 항상 장르 슬롯을
    무드보다 우선(고정 우선순위: movie > genre > mood)해서 채택했는데,
    이는 실제로는 "가장 최근에 언급된 슬롯"과 일치하지 않는 경우가 많았다
    (A가 무드, B가 장르, C가 "그거"라고 하면 실제로 가장 최근 발화인 B의
    장르가 우연히 맞을 수도 있지만, 반대로 D가 무드를 다시 언급한 뒤라면
    D의 무드가 최신인데도 장르가 계속 채택되는 오류가 발생한다).
    이제 각 슬롯에 마지막으로 채워진 시각을 따로 기록해, resolve_with_focus()가
    "실제로 가장 최근에 갱신된 슬롯"을 비교해서 채택하도록 한다.
    """
    last_genre: Optional[str] = None
    last_mood: Optional[str] = None
    last_movie: Optional[str] = None
    last_speaker_id: Optional[str] = None
    updated_at: Optional[datetime] = None

    # 슬롯별 최종 갱신 시각 (recency 비교용). updated_at은 하위호환을 위해
    # "가장 최근에 갱신된 슬롯 중 하나"의 시각으로 계속 갱신된다.
    last_genre_at: Optional[datetime] = None
    last_mood_at: Optional[datetime] = None
    last_movie_at: Optional[datetime] = None


def resolve_with_focus(text: str, entities: ExtractedEntities, focus: ConversationFocus) -> ExtractedEntities:
    """자체 엔티티가 없고 참조 표현만 있는 메시지("그거 좋아", "나도")나,
    대상 없이 반응만 있는 신조어 메시지("완전 꿀잼ㅋㅋ")를 직전 Focus로 채워 넣는다.
    """
    normalized_text, _had_slang = normalize_slang(text)
    has_reference = any(m in normalized_text for m in REFERENCE_MARKERS)
    is_bare_reaction = entities.had_slang_reaction and not entities.genres and not entities.moods
    if not (has_reference or is_bare_reaction) or entities.genres or entities.movie_titles:
        return entities

    multiplier, _ = _clause_polarity_and_intensity(normalized_text)
    polarity = max(-1.0, min(1.0, multiplier))

    if focus.last_movie:
        entities.movie_titles = [focus.last_movie]
        entities.used_reference = True

    # 장르/무드 슬롯은 둘 다 채워져 있을 수 있으므로, 고정 우선순위(장르 항상
    # 우선) 대신 실제로 어느 쪽이 더 최근에 갱신됐는지 비교해서 채택한다.
    # 타임스탬프가 없는 슬롯(과거 버전에서 만들어진 focus 등)은 가장 오래된
    # 것으로 취급해 안전하게 폴백한다.
    genre_at = focus.last_genre_at if focus.last_genre else None
    mood_at = focus.last_mood_at if focus.last_mood else None

    if genre_at and mood_at:
        pick_genre = genre_at >= mood_at
    else:
        pick_genre = bool(focus.last_genre)  # 한쪽만 있으면 그쪽을 채택

    if pick_genre and focus.last_genre:
        entities.genres = {focus.last_genre: polarity}
        entities.genre_confidence = {focus.last_genre: 0.3}  # 추정치라 신뢰도는 낮게
        entities.used_reference = True
    elif focus.last_mood:
        entities.moods = {focus.last_mood: polarity}
        entities.mood_confidence = {focus.last_mood: 0.3}
        entities.used_reference = True

    return entities


def _update_focus(focus: ConversationFocus, entities: ExtractedEntities, timestamp: datetime,
                   speaker_id: Optional[str] = None) -> None:
    """참조로 채운 게 아니라 이번 메시지에서 '새로' 언급된 것만 Focus로 갱신한다."""
    if entities.used_reference:
        return
    updated = False
    if entities.genres:
        strongest = max(entities.genres.items(), key=lambda kv: abs(kv[1]))
        focus.last_genre = strongest[0]
        focus.last_genre_at = timestamp
        updated = True
    if entities.moods:
        strongest = max(entities.moods.items(), key=lambda kv: abs(kv[1]))
        focus.last_mood = strongest[0]
        focus.last_mood_at = timestamp
        updated = True
    if entities.movie_titles:
        focus.last_movie = entities.movie_titles[0]
        focus.last_movie_at = timestamp
        updated = True
    if updated:
        focus.last_speaker_id = speaker_id
        focus.updated_at = timestamp


# ---------------------------------------------------------------------------
# State 갱신 (메인 진입점)
# ---------------------------------------------------------------------------

def apply_message_to_state(
    state: UserPreferenceState,
    text: str,
    message_id: str,
    timestamp: Optional[datetime] = None,
    focus: Optional[ConversationFocus] = None,
) -> Tuple[bool, ExtractedEntities]:
    """메시지 1건을 분석해 State를 갱신한다.
    focus를 넘기면 "그거 좋음" 류 생략 발화도 반영되고, Focus 자체도 갱신된다.
    focus는 반드시 방(room) 단위로 하나만 만들어 그 방의 모든 사용자가
    공유해야 한다 — 그래야 "A: 드라마 어때 / B: 나도"처럼 다른 사람의
    발화에 대한 맞장구도 올바르게 해석된다 (ConversationFocus 클래스 설명 참고).
    반환값: (관련 메시지였는지, 추출된 엔티티)

    config.ENABLE_CORPUS_TYPO_CORRECTION(기본 true, 코퍼스 검증된 경량 사전) /
    ENABLE_TYPO_CORRECTION(기본 false, 무거운 HF ET5) / ENABLE_SPACING_CORRECTION
    (기본 false, ElectraSpacer) 중 하나라도 켜져 있으면 맞춤법·띄어쓰기 교정을
    먼저 적용한 뒤(text_normalization.py) 이어서 신조어 정규화 -> 관련성 판별
    -> 엔티티 추출 순으로 진행한다.
    """
    timestamp = timestamp or utc_now()

    fix_typos = config.ENABLE_CORPUS_TYPO_CORRECTION or config.ENABLE_TYPO_CORRECTION
    fix_spacing = config.ENABLE_SPACING_CORRECTION
    if fix_typos or fix_spacing:
        text = normalize_text(text, fix_typos=fix_typos, fix_spacing=fix_spacing)

    relevant, _score = is_relevant(text)
    entities = extract_entities(text)

    if focus is not None:
        entities = resolve_with_focus(text, entities, focus)
        relevant = relevant or entities.used_reference

    if not relevant:
        return False, entities

    for genre, polarity in entities.genres.items():
        state._genre_signals.setdefault(genre, []).append(
            ScoredSignal(score=polarity, timestamp=timestamp, source_message_id=message_id)
        )
        state.genres[genre] = round(_weighted_average(state._genre_signals[genre]), 3)

    for mood, polarity in entities.moods.items():
        state._mood_signals.setdefault(mood, []).append(
            ScoredSignal(score=polarity, timestamp=timestamp, source_message_id=message_id)
        )
        state.moods[mood] = round(_weighted_average(state._mood_signals[mood]), 3)

    for genre in entities.hard_excluded_genres:
        if genre not in state.constraints.excluded_genres:
            state.constraints.excluded_genres.append(genre)

    if entities.max_runtime:
        if state.constraints.max_runtime is None:
            state.constraints.max_runtime = entities.max_runtime
        else:
            state.constraints.max_runtime = min(state.constraints.max_runtime, entities.max_runtime)

    if entities.exclude_adult:
        state.constraints.exclude_adult = True

    if focus is not None:
        _update_focus(focus, entities, timestamp, speaker_id=state.user_id)

    return True, entities


# ---------------------------------------------------------------------------
# Focus 직렬화 (message_analyses.focus_json 대응)
# ---------------------------------------------------------------------------
# ConversationFocus를 JSON-호환 dict로 오가는 변환. state_store.py(Redis/
# 인메모리 저장 경로)와 api.py의 무상태(stateless) /analyze-message 경로가
# 둘 다 이 함수를 쓴다 - Main Backend가 message_analyses.focus_json 컬럼에
# 그대로 저장했다가, 다음 메시지 분석 요청 시 prior_focus로 돌려보내는 흐름을
# 그대로 지원한다.

def focus_to_dict(focus: ConversationFocus) -> dict:
    return {
        "last_genre": focus.last_genre,
        "last_mood": focus.last_mood,
        "last_movie": focus.last_movie,
        "last_speaker_id": focus.last_speaker_id,
        "updated_at": focus.updated_at.isoformat() if focus.updated_at else None,
        "last_genre_at": focus.last_genre_at.isoformat() if focus.last_genre_at else None,
        "last_mood_at": focus.last_mood_at.isoformat() if focus.last_mood_at else None,
        "last_movie_at": focus.last_movie_at.isoformat() if focus.last_movie_at else None,
    }


def focus_from_dict(d: Optional[dict]) -> ConversationFocus:
    """Main Backend가 넘겨준 prior_focus(message_analyses.focus_json)를
    ConversationFocus로 복원한다. 아직 아무 메시지도 없던 방(d가 None/빈 dict)
    이면 빈 Focus를 반환한다."""
    d = d or {}

    def _dt(key: str) -> Optional[datetime]:
        v = d.get(key)
        return to_aware_utc(datetime.fromisoformat(v)) if v else None

    return ConversationFocus(
        last_genre=d.get("last_genre"),
        last_mood=d.get("last_mood"),
        last_movie=d.get("last_movie"),
        last_speaker_id=d.get("last_speaker_id"),
        updated_at=_dt("updated_at"),
        last_genre_at=_dt("last_genre_at"),
        last_mood_at=_dt("last_mood_at"),
        last_movie_at=_dt("last_movie_at"),
    )


# ---------------------------------------------------------------------------
# 발화 의도 분류 (message_analyses.intent_code 대응, FR-AI 확장)
# ---------------------------------------------------------------------------
# DB 스키마(user_preference_states/message_analyses)를 설계하면서 드러난
# 갭 ⑤: intent_code 컬럼(PREFERENCE/PROPOSAL/AGREE/REJECT 등)에 대응하는
# 분류 로직이 기존 코드에 없었다. 완전한 의도 분류기(별도 학습 모델)를
# 만들기엔 이번 범위를 넘어서므로, 우선 규칙 기반으로 가장 명확한 4가지만
# 분류하고, 애매하면 None(=미분류)을 반환해 과확신을 피한다.

AGREE_MARKERS = ["콜", "오케이", "ok", "인정", "그걸로", "찬성", "동의"]
REJECT_MARKERS = ["싫어", "별로", "패스", "반대", "그건 좀", "노노"]
PROPOSAL_MARKERS = ["어때", "볼까", "하자", "가자", "보자", "고고"]


def classify_intent(text: str, entities: "ExtractedEntities") -> Optional[str]:
    """아주 단순한 규칙 기반 발화 의도 분류.

    ⚠️ 우선순위가 중요하다: "무서운 건 싫어", "액션 완전 좋아"처럼 장르/무드에
    대한 취향 표현은 "싫어"/"좋아" 같은 단어를 포함하지만 그룹 의사결정에
    대한 AGREE/REJECT가 아니라 PREFERENCE다 - 이 함수가 처음 만들어졌을 때는
    REJECT_MARKERS를 먼저 검사해서 "무서운 건 싫어"가 REJECT로 잘못 분류되는
    버그가 있었다. 그래서 "이번 메시지에서 실제로 장르/무드/영화가 추출됐는지"
    를 최우선으로 보고, 아무 개체도 못 뽑았을 때(=단순 반응 발화, "콜", "패스"
    같은 바로 그 단어만 있는 경우)에만 AGREE/REJECT/PROPOSAL 마커로 넘어간다.
    셋 다 아니면 None(모델이 자신 없다는 뜻 - message_analyses.intent_code는
    nullable이므로 그대로 NULL로 저장하면 된다).
    """
    normalized, _ = normalize_slang(text)

    if entities.genres or entities.moods or entities.movie_titles:
        return "PREFERENCE"
    if any(m in normalized for m in REJECT_MARKERS):
        return "REJECT"
    if any(m in normalized for m in AGREE_MARKERS):
        return "AGREE"
    if any(m in normalized for m in PROPOSAL_MARKERS):
        return "PROPOSAL"
    return None


# ---------------------------------------------------------------------------
# 무상태(stateless) 메시지 분석 - message_analyses / user_preference_states
# DB 스키마에 맞춘 API 진입점 (FR-AI-01~06 전체를 메시지 1건 단위로 수행)
# ---------------------------------------------------------------------------
# apply_message_to_state()(위)는 UserPreferenceState 객체를 프로세스 메모리
# 안에서 계속 누적하는 "상태 보유형" 경로다(로컬 데모/테스트에 여전히 유용).
# 반면 실제 서비스에서는 Main Backend(Spring Boot)가 메시지/분석 결과/선호
# 상태를 각각 chat_messages/message_analyses/user_preference_states 테이블에
# 영속화하므로, ml_service는 매 요청마다 "이전 상태 조각(prior_focus,
# prior_preferences)을 받아 -> 갱신된 조각을 돌려주는" 무상태 함수로 동작하는
# 편이 이 아키텍처와 맞다. analyze_message()가 그 진입점이다.

@dataclass
class MessageAnalysisResult:
    """message_analyses 테이블 한 행 + 파생 정보. api.py가 이 필드들을 거의
    그대로 JSON 응답에 옮겨 담는다."""
    relevant_flag: bool
    relevance_score: float
    intent_code: Optional[str]
    entities_json: dict
    constraints_json: dict
    focus_json: dict
    confidence: float
    normalized_text: dict
    preference_deltas: List[dict]  # preference_eav.PreferenceDelta를 dict로 직렬화한 목록


def analyze_message(
    text: str,
    timestamp: Optional[datetime] = None,
    prior_focus: Optional[dict] = None,
    prior_preferences: Optional[List] = None,
) -> MessageAnalysisResult:
    """메시지 1건을 분석해 message_analyses 테이블에 그대로 저장할 수 있는
    형태로 돌려준다. Main Backend는:
      1) 그 방의 최신 message_analyses.focus_json을 prior_focus로 전달하고
      2) 그 사용자의 기존 user_preference_states 행들을 prior_preferences로
         전달한 뒤(preference_eav.PreferenceRow 목록)
      3) 이 함수가 돌려주는 값을 message_analyses에 INSERT하고
         preference_deltas를 user_preference_states에 upsert하면 된다.

    (순환 import를 피하려고 preference_eav는 이 함수 안에서 지연 import한다 -
    preference_eav.py가 time_weight()를 쓰려고 이 모듈을 import하기 때문에,
    모듈 최상단에서 서로를 import하면 순환 참조가 생긴다.)
    """
    from preference_eav import (  # 지연 import: 순환 참조 방지
        TARGET_TYPE_GENRE,
        TARGET_TYPE_MOOD,
        build_preference_delta,
    )

    timestamp = timestamp or utc_now()
    focus = focus_from_dict(prior_focus)

    fix_typos = config.ENABLE_CORPUS_TYPO_CORRECTION or config.ENABLE_TYPO_CORRECTION
    fix_spacing = config.ENABLE_SPACING_CORRECTION
    normalized = text
    if fix_typos or fix_spacing:
        normalized = normalize_text(text, fix_typos=fix_typos, fix_spacing=fix_spacing)

    relevant, score = is_relevant(normalized)
    entities = extract_entities(normalized)
    entities = resolve_with_focus(normalized, entities, focus)
    relevant = relevant or entities.used_reference
    # 영화 추천과 무관한 메시지엔 의도를 매기지 않는다 - "오늘 날씨 어때"의
    # "어때"가 PROPOSAL 마커와 우연히 겹치는 것처럼, 관련 없는 일상 대화에서도
    # AGREE/REJECT/PROPOSAL 마커 단어가 등장할 수 있기 때문이다.
    intent = classify_intent(normalized, entities) if relevant else None

    # prior_preferences를 (target_type, target_value) -> PreferenceRow 로 인덱싱
    prior_by_target = {(p.target_type, p.target_value): p for p in (prior_preferences or [])}

    deltas = []
    for genre, signed_score in entities.genres.items():
        conf = entities.genre_confidence.get(genre, 0.5)
        preference_type = "HARD" if genre in entities.hard_excluded_genres else "SOFT"
        delta = build_preference_delta(
            TARGET_TYPE_GENRE, genre, signed_score, conf, prior_by_target,
            preference_type=preference_type, now=timestamp,
        )
        deltas.append(delta)
    for mood, signed_score in entities.moods.items():
        conf = entities.mood_confidence.get(mood, 0.5)
        delta = build_preference_delta(TARGET_TYPE_MOOD, mood, signed_score, conf, prior_by_target, now=timestamp)
        deltas.append(delta)

    # Focus는 참조로 채운 게 아니라 "새로" 언급된 것만 갱신 (기존 _update_focus 재사용)
    if not entities.used_reference:
        _update_focus(focus, entities, timestamp, speaker_id=None)

    overall_confidence = score if not deltas else round(
        sum(d.confidence for d in deltas) / len(deltas), 4
    )

    return MessageAnalysisResult(
        relevant_flag=relevant,
        relevance_score=score,
        intent_code=intent,
        entities_json={
            "genres": entities.genres,
            "moods": entities.moods,
            "movie_titles": entities.movie_titles,
            "hard_excluded_genres": entities.hard_excluded_genres,
            "max_runtime": entities.max_runtime,
            "exclude_adult": entities.exclude_adult,
        },
        constraints_json={
            "max_runtime": entities.max_runtime,
            "exclude_adult": entities.exclude_adult,
        },
        focus_json=focus_to_dict(focus),
        confidence=overall_confidence,
        normalized_text={"text": normalized, "had_slang_reaction": entities.had_slang_reaction},
        preference_deltas=[
            {
                "target_type": d.target_type,
                "target_value": d.target_value,
                "polarity": d.polarity,
                "preference_type": d.preference_type,
                "strength": d.strength,
                "confidence": d.confidence,
            }
            for d in deltas
        ],
    )
