# MeetupLog AI Service

그룹 채팅 대화를 분석해 영화를 추천하는 MeetupLog의 AI 파트
FastAPI 기준으로 구현.

⚠️ **아키텍처가 한 번 바뀌었습니다.** Main Backend(Spring Boot) DB 스키마
(`meetuplog_schema.sql`)를 실제로 설계해보니 `message_analyses`/
`user_preference_states` 테이블이 이미 메시지 단위·선호 단위 영속화를
MySQL에서 전담하도록 돼 있었습니다. 그래서 FastAPI는 이제 **완전히
무상태(stateless)**입니다 - 상태를 스스로 들고 있지 않고, 매 요청마다
"이전 상태 조각"을 받아 "갱신된 조각"만 돌려줍니다. 자세한 건
[API 아키텍처](#api-아키텍처) 절 참고.

```
채팅 메시지 1건 + (Main Backend가 DB에서 읽어온) 이전 Focus·이전 선호
   → POST /analyze-message
   → [관련성 판별 → 절 단위 극성/제약 추출 → Focus 문맥 해석 → 의도 분류]
   → message_analyses 행 + user_preference_states upsert용 델타 (Main Backend가 저장)

방장이 추천 버튼 클릭, Main Backend가 그 방의 user_preference_states 전체를 읽어
   → POST /recommend
   → [EAV → UserPreferenceState 변환 → HARD 제약 필터 → 5요소 스코어링 → 모드 결정]
   → TOP3 + 추천 근거
```

## 목차

- [빠른 시작](#빠른-시작)
- [API 아키텍처](#api-아키텍처)
- [파일 구성](#파일-구성)
- [환경설정](#환경설정)
- [기획서 대응表](#기획서-대응표)
- [NLP 파이프라인](#nlp-파이프라인)
- [추천 엔진](#추천-엔진)
- [코퍼스 통합](#코퍼스-통합-국립국어원-모두의-말뭉치-구어-말뭉치)
- [보안](#보안)
- [알려진 한계와 다음 단계](#알려진-한계와-다음-단계)

---

## 빠른 시작

외부 API 키 없이 모의 데이터로 전체 파이프라인을 확인할 수 있습니다.

```bash
pip install -r requirements.txt
python demo.py
```

12개 시나리오가 순서대로 출력됩니다: 관련성 분류, 절 단위 극성 분리, HARD
제외 제약, Focus 문맥 해석, 채팅→추천 전체 흐름, 신조어 처리, 다른 사용자
간 문맥 이어받기, 코퍼스 기반 오타 정규화, 텍스트 유사도(어절 vs 문자
n-gram TF-IDF), KOFIC 동명 영화 오매칭 방지, TMDB 키워드로 비공식 장르
보강, DB 스키마에 맞춘 무상태 분석 경로.

실 서버로 띄우려면:

```bash
cp .env.example .env    # TMDB_API_KEY / KOFIC_API_KEY / HF_TOKEN 값 채워넣기
uvicorn api:app --reload --port 8000
```

서버 기동 시 TMDB 인기영화를 미리 수집해 인메모리 카탈로그를 구성합니다
(9장 "서버 시작 시 미리 계산" 원칙). 실 서비스에서는 `MovieCatalog`를 배치로
DB/캐시에 적재하도록 바꾸는 것을 권장합니다.

---

## API 아키텍처

FastAPI는 상태를 스스로 들고 있지 않습니다. Main Backend가 DB
(`message_analyses`/`user_preference_states`)에서 이전 상태를 읽어 요청에
실어 보내고, FastAPI는 갱신된 조각만 계산해 돌려줍니다.

### `POST /analyze-message` - 메시지 1건 분석

| 요청 필드                                             | 설명                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `text`, `sent_at`, `room_id`, `user_id`, `message_id` | 분석할 메시지                                                      |
| `prior_focus`                                         | 그 방의 최신 `message_analyses.focus_json` (없으면 `null`)         |
| `prior_preferences`                                   | 그 발화자의 기존 `user_preference_states` 행들 (시간가중 블렌딩용) |

응답은 `message_analyses` 테이블 한 행과 거의 1:1(`relevant_flag`,
`relevance_score`, `intent_code`, `entities_json`, `constraints_json`,
`focus_json`, `confidence`, `model_version`, `processing_status`)이고,
추가로 `preference_deltas`(그대로 `user_preference_states`에 upsert할 행
목록)를 함께 돌려줍니다. Main Backend는 응답을 그대로 저장하기만 하면 됩니다.

내부적으로 실패하면(예외 발생) 500으로 죽이지 않고
`processing_status: "FAILED"`로 응답합니다 - `message_analyses.processing_status`
컬럼이 바로 이 케이스를 위한 것이라, 실패도 구조화된 기록으로 남습니다.

### `POST /recommend` - TOP3 추천

`preference_states`(그 방의 `user_preference_states` 전체, 여러 사용자
뒤섞임)를 받아 `preference_eav.eav_rows_to_user_states()`로 사용자별
`UserPreferenceState`로 변환한 뒤, 기존 추천 로직(`recommendation_engine.recommend()`)
을 그대로 돌립니다.

### 왜 이렇게 바꿨나 (state_store.py와의 관계)

`state_store.py`(Redis/인메모리로 라운드 상태를 FastAPI가 직접 들고 있는
방식)가 원래 있었는데, DB 스키마 설계 이후로는 기본 경로에서 쓰지 않습니다.
"상태를 어디서 들고 있을 것인가"의 정답은 Main Backend의 DB였습니다.
`state_store.py`는 Main Backend 없이 단독 데모/로드테스트할 때나, 나중에
"매번 DB 왕복하기엔 느리니 캐시하고 싶다"는 성능 최적화가 필요할 때를 위해
남겨뒀습니다 - 자세한 이유는 그 파일 상단 docstring 참고.

`nlp_pipeline.apply_message_to_state()`(프로세스 메모리에 `UserPreferenceState`
를 계속 누적하는 예전 방식)도 코드에 남아 있습니다 - `demo.py`의 여러
시나리오가 여전히 이 방식으로 동작하며, DB 없이 파이프라인 자체를 검증하고
싶을 때 유용합니다. 실제 API(`api.py`)는 새 무상태 함수
`nlp_pipeline.analyze_message()`만 씁니다.

---

## 파일 구성

| 파일                            | 역할                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.py`                     | 환경설정 로드(.env), API 키 지연검증, 추천 가중치, 시간감쇠·관련성 임계값, feature flag                                                                                                                    |
| `time_utils.py`                 | timezone-aware UTC 시각 헬퍼                                                                                                                                                                               |
| `models.py`                     | Preference State, MovieCandidate, 추천 결과 등 데이터 모델                                                                                                                                                 |
| `movie_catalog.py`              | TMDB 카탈로그 수집(TMDB 공식 장르 taxonomy 정렬 + 키워드 기반 비공식 장르 보강), KOFIC 등급 보강(동명 영화 disambiguation 포함), 무드 태깅, 제목 오타 보정                                                 |
| `nlp_pipeline.py`               | 관련성 판별, 절 단위 장르/무드/제약 추출, Focus 문맥 해석, 발화 의도 분류(`classify_intent`), 무상태 분석 진입점(`analyze_message`) + 예전 방식의 시간가중 State 누적(`apply_message_to_state`, demo.py용) |
| `preference_eav.py`             | `user_preference_states`(EAV) ↔ `UserPreferenceState`(dict) 변환, 메시지 신호 + DB 기존값의 시간가중 블렌딩                                                                                                |
| `slang_lexicon.py`              | 신조어/줄임말("꿀잼", "노잼", "ㄹㅇ" 등)을 일반 어휘로 정규화                                                                                                                                              |
| `corpus_typo_corrector.py`      | 코퍼스에서 마이닝·검증한 경량 구어체 정규화 사전 (기본 사용)                                                                                                                                               |
| `text_normalization.py`         | 맞춤법(ET5)·띄어쓰기(ElectraSpacer) 교정, SBERT 문장 임베딩 래퍼 (모두 opt-in)                                                                                                                             |
| `relevance_classifier.py`       | TF-IDF+LogisticRegression 학습형 관련성 분류기 (코퍼스 데이터 + 수작업 seed) + KcELECTRA 파인튜닝 대체 경로(opt-in)                                                                                        |
| `recommendation_engine.py`      | HARD 제약 필터링, 5요소 스코어링, 4가지 추천 모드 결정                                                                                                                                                     |
| `api.py`                        | FastAPI 엔드포인트 — `POST /analyze-message`(메시지 1건 분석, 무상태), `POST /recommend`(EAV 기반 추천)                                                                                                    |
| `state_store.py`                | (옵션/레거시) 라운드 State를 FastAPI가 직접 들고 있는 방식 — 기본 경로에서는 안 쓰임, 상단 docstring 참고                                                                                                  |
| `train_relevance_classifier.py` | KcELECTRA 등으로 관련성 분류기를 파인튜닝하는 오프라인 스크립트 (opt-in)                                                                                                                                   |
| `verify_hf_models.py`           | ET5/ElectraSpacer/SBERT opt-in 모델을 실제로 로드해보는 스모크 테스트 스크립트                                                                                                                             |
| `demo.py`                       | 외부 API 없이 모의 데이터로 전체 흐름(예전 방식 + 새 무상태 방식 모두)을 검증하는 스크립트                                                                                                                 |
| `build_corpus_data.py`          | 원본 말뭉치(`corpus_raw/`) 또는 MeetupLog 채팅 로그(`--format meetuplog`)에서 `data/` 파생 데이터를 (재)생성하는 스크립트                                                                                  |
| `data/`                         | 코퍼스에서 추출한 파생 학습 데이터                                                                                                                                                                         |

---

## 환경설정

키는 코드에 기본값으로 박아두지 않고 `.env` 또는 서버 환경변수로만 주입합니다.

```bash
cp .env.example .env
# TMDB_API_KEY / KOFIC_API_KEY / HF_TOKEN 채워넣기
```

키가 비어 있으면 실제로 그 키가 필요한 외부 API 호출 시점에
`config.require_key()`가 무엇이 빠졌는지 알려주는 에러를 던집니다 —
`demo.py`처럼 외부 API를 쓰지 않는 코드 경로는 키 없이도 그대로 동작합니다.

**Feature flag** (`config.py`, 전부 환경변수로 오버라이드 가능):

| 플래그                          | 기본값  | 설명                                                              |
| ------------------------------- | ------- | ----------------------------------------------------------------- |
| `ENABLE_CORPUS_TYPO_CORRECTION` | `true`  | 코퍼스 검증된 경량 구어체 정규화 (외부 다운로드 불필요)           |
| `ENABLE_TYPO_CORRECTION`        | `false` | HF ET5 맞춤법 교정 모델 (무거움, 이 환경에서 미검증)              |
| `ENABLE_SPACING_CORRECTION`     | `false` | ElectraSpacer 띄어쓰기 교정 (별도 리포 클론 필요)                 |
| `ENABLE_SBERT_SIMILARITY`       | `false` | SBERT 문장 임베딩 기반 텍스트 유사도 (무거움, 이 환경에서 미검증) |

---

## 기획서 대응表

| 기획서 항목                                  | 구현 위치                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 관련성 필터 / 증분 분석 (8~9장, FR-AI-01~02) | `nlp_pipeline.is_relevant()` — 일반 대화는 State에 반영 안 함, 새 메시지만 분석                                            |
| 최신 의견 우선 (FR-AI-06)                    | `nlp_pipeline.time_weight()` — half-life 지수 감쇠, `config.TIME_DECAY_HALF_LIFE_DAYS`로 조절                              |
| 추천 점수 5요소 (10장 표)                    | `recommendation_engine.score_candidates()` — 그룹만족도 42% / 공정성 28%(`min()`) / 텍스트유사도 18% / 대중성 7% / 평점 5% |
| HARD 제약 (Free Slot Engine과 동일 사상)     | `recommendation_engine._violates_hard_constraints()`                                                                       |
| 4가지 추천 모드 (10장)                       | `recommendation_engine.decide_mode()` — CONSENSUS / PREFERENCE_DISCOVERY / CONFLICT_DISCOVERY / LOW_EVIDENCE_DISCOVERY     |
| 오타 보정 / 미등록 제목 (FR-AI-04)           | `movie_catalog.match_title()` — 확신도(기본 0.72) 미만이면 UNKNOWN_TITLE 유지                                              |
| 문맥 해석 (FR-AI-05)                         | `nlp_pipeline.ConversationFocus` + `resolve_with_focus()` — 방(room) 전체가 공유                                           |

---

## NLP 파이프라인

`nlp_pipeline.apply_message_to_state()`가 메시지 1건을 받아 State를 갱신하는
단일 진입점입니다. 내부 처리 순서:

```
원문 메시지
  → (opt-in) 오타/띄어쓰기 교정            text_normalization.py
  → 신조어 정규화("꿀잼" -> "완전 재밌음")   slang_lexicon.py
  → 관련성 판별 (규칙 40% + 분류기 60%)     relevance_classifier.py
  → 절 단위 극성/강도/HARD제외 추출          nlp_pipeline.extract_entities()
  → Focus 문맥 해석("그거", "나도")         nlp_pipeline.resolve_with_focus()
  → 시간가중 반영해 UserPreferenceState 갱신
```

### 절(clause) 단위 파싱

문장 전체가 아니라 절 단위로 부정을 스코핑한다. "액션은 진짜 좋아하는데
로맨스는 싫어"를 문장 전체 기준으로 보면 부정어(싫어) 하나 때문에 액션까지
부정으로 잘못 반영될 수 있는데, `-는데/-지만` 등 대조 연결어미와 문장부호로
절을 나눈 뒤 절마다 판단해서 액션 +1.0 / 로맨스 -1.0로 정확히 분리한다.
"완전/진짜/너무"(배수 1.3~1.4), "그냥/조금/약간"(0.5~0.6배) 같은 강도 부사도
반영한다.

### HARD 제외 vs 단순 비선호

"말고/빼고/제외"는 단순 비선호(-1)가 아니라 `Constraints.excluded_genres`에
반영되어 추천 후보에서 **강제** 제외된다(`_violates_hard_constraints`에서 소비).

### Focus 문맥 (그룹 채팅 특화)

`ConversationFocus`는 **방(room)/추천 라운드당 하나만 만들어 모든 사용자가
공유**해야 한다. 처음엔 `api.py`가 사용자별로 별도 Focus를 두는 실수가
있었는데, 그러면 "A: 잔잔한 드라마 어때? / B: 나도"에서 B의 "나도"가 참조할
대상이 없어 아무것도 반영되지 않는 버그가 생긴다 — 그룹 채팅은 애초에
서로 다른 사람이 서로의 말에 맞장구치는 게 정상 흐름이라 영향이 컸다. 지금은
`api.py`가 요청 하나(=한 라운드)당 `room_focus` 하나를 만들어 메시지를
시간순으로 재생하며 공유한다(`ConversationFocus.last_speaker_id`에 누가
마지막으로 채웠는지도 기록). `demo.py` 7번 시나리오에서 예전 방식과 지금
방식을 나란히 비교할 수 있다.

### 신조어/줄임말 (`slang_lexicon.py`)

"꿀잼", "노잼", "핵망", "인생영화", "ㄹㅇ", "ㅇㅈ" 같은 표현을 두 층으로 처리한다.

- **고정 사전**: "인생영화", "띵작", "극혐"처럼 불규칙한 대표 표현.
- **생산적 패턴(정규식)**: "핵/개/존/극/갓" + "잼" 조합처럼 규칙적으로
  생성되는 계열은 접두어+어근 패턴으로 일반화해 사전에 없는 새 조합도 커버.

신조어는 기존 강도부사/부정마커 어휘("완전 재밌음", "별로임")로 치환되기
때문에 절 분리·부정 스코핑 로직을 그대로 재사용한다. 관련성 분류기는
신조어의 **원문 형태**로 학습·추론해 "노잼"류 패턴 자체를 문자 n-gram으로
인식하도록 정규화 전 텍스트를 그대로 쓴다.

### 학습형 관련성 분류기

TF-IDF(문자 2-gram, 조사 변형에 강건) + LogisticRegression으로 "영화
관련/일반 대화"를 분류하고, 규칙 기반 점수(40%)와 가중합산한다. 학습
데이터는 코퍼스 파생 데이터(있으면 최대 500+500개)와 수작업 seed(신조어
포함)를 **항상 합쳐서** 쓴다 — 자세한 근거는 [코퍼스 통합](#코퍼스-통합-국립국어원-모두의-말뭉치-구어-말뭉치)
절 참고. 운영 중 정정 사례는 `retrain_with_feedback()`으로 반영할 수 있다.

### 오타/띄어쓰기 교정, 신뢰도

- 기본 오타 교정 경로는 `corpus_typo_corrector`(코퍼스 검증됨, opt-out만
  가능). 더 무거운 HF ET5/ElectraSpacer는 `config.ENABLE_TYPO_CORRECTION` /
  `ENABLE_SPACING_CORRECTION`으로 켤 수 있으나 이 환경에서 실제 다운로드·
  추론을 검증하지 못했다 — 모델 로드 실패 시 예외를 흡수해 원문 그대로
  진행하도록 만들어 최소한 파이프라인이 죽지는 않는다.
- 추출된 각 속성마다 `genre_confidence` / `mood_confidence`를 함께 반환해
  추후 "근거 수준" 표시(FR-AI-08)에 활용할 수 있다.

---

## 추천 엔진

### 텍스트 유사도: 어절 TF-IDF → 문자 n-gram TF-IDF → (opt-in) SBERT

`_text_similarity_scores()`는 3단계 우선순위로 계산한다.

1. **SBERT** (`config.ENABLE_SBERT_SIMILARITY=true`, jhgan/ko-sroberta-multitask)
   — 진짜 의미 기반 매칭이라 "가벼운 거"처럼 사전에 없는 표현도 잡을 수
   있다. 모델 다운로드가 필요해 무겁고, 이 환경(huggingface.co 접근 차단)
   에서는 직접 검증하지 못했다 — 배포 전 반드시 확인할 것.
2. **문자 n-gram TF-IDF** (`analyzer="char_wb", ngram_range=(2,3)`, 기본값) —
   외부 의존성 없이 지금 당장 검증 가능한 폴백. 기존 어절 단위 TF-IDF는
   "가볍게"(줄거리)와 "가벼운"(사용자 발화)처럼 어근은 같지만 활용형이
   다르면 유사도가 정확히 0.0이었는데, 문자 n-gram으로 바꾸면 0.02~0.03
   수준의 겹침을 잡아낸다(`demo.py` 9번 시나리오에서 직접 비교 가능). SBERT
   만큼 강력하진 않지만 진짜 개선이고, 이 프로젝트에서 검증 가능한 유일한
   "의미 비슷한 표현 매칭" 경로다.
3. 입력이 비어있는 등 예외 상황이면 전부 0.0.

### KOFIC 동명 영화 오매칭 방지

`KoficClient.enrich_age_rating()`은 원래 "제목이 같은 첫 번째 검색 결과"를
그대로 썼다 — 리메이크작처럼 동명 영화가 여러 편 있으면 엉뚱한 관람등급이
붙을 수 있었다. 지금은 이렇게 좁힌다:

1. 제목이 정확히 일치하는 후보만 남긴다.
2. 후보가 여럿이면 `MovieCandidate.release_year`(TMDB `release_date`에서
   추출)와 KOFIC의 `prdtYear`가 ±1년 이내인 후보를 우선한다.
3. 그래도 여럿이면(동일 제목·동일 연도) `production_companies`(TMDB 상세
   조회 시에만 채워짐)를 넘겨받았을 때만 KOFIC 상세조회로 배급사명을
   비교한다. **문자열 유사도만으로는 "CJ ENM"(TMDB, 로마자)과
   "씨제이이엔엠"(KOFIC, 한글) 같은 경우를 전혀 못 잡는다는 걸 테스트로
   직접 발견**했고, 그래서 국내 주요 배급사 로마자↔한글 별칭 테이블
   (`MAJOR_DISTRIBUTOR_ALIASES`)을 만들어 먼저 정규화한 뒤 비교한다.
4. 그래도 못 좁히면 첫 후보로 폴백한다(오매칭 가능성 남음).

`demo.py` 10번 시나리오에서 세 경우(연도로 좁혀짐 / 배급사로 좁혀짐 / 완전
동일해서 폴백) 모두 mock으로 재현해 확인할 수 있다. 별칭 테이블은 메이저
배급사 위주라 완전하지 않으니, 실제로 자주 틀리는 조합을 발견하면
`movie_catalog.MAJOR_DISTRIBUTOR_ALIASES`에 추가할 것.

### TMDB 키워드로 비공식 장르 보강 (재난/무협/히어로)

TMDB `/genre/movie/list`(ko-KR)의 공식 영화 장르는 19개뿐이다
(`movie_catalog.TMDB_GENRE_NAMES_KO`) — 액션·모험·애니메이션·코미디·범죄·
다큐멘터리·드라마·가족·판타지·역사·공포·음악·미스터리·로맨스·SF·TV 영화·
스릴러·전쟁·서부. "재난", "무협", "히어로"는 여기 없다. 예전엔
`GENRE_KEYWORDS`에만 이 카테고리를 추가해뒀는데, 그러면 채팅에서 "재난
영화 좋아"를 추출은 해도 `movie.genres`(TMDB 장르 그대로)에는 "재난"이
절대 안 들어있어서 추천 스코어링에서 매칭이 안 되는 반쪽짜리 기능이었다.

TMDB는 장르와 별개로 영화마다 영어 "키워드" 태그를 붙여둔다(`disaster`,
`martial arts`, `superhero` 등). `TMDBClient.fetch_detail()`이
`append_to_response=keywords`로 이 키워드를 함께 받아와서,
`KEYWORD_TAG_ALIASES`(영어 키워드 → 한글 카테고리, 예: `"disaster"` →
`"재난"`)로 정규화한 뒤 `movie.genres`에 **얹는다**. 이렇게 하면
`recommendation_engine`은 `movie.genres`만 보면 되므로 코드를 전혀 안
고쳐도 된다 — 보강 로직이 `movie_catalog.py` 안에서 전부 끝난다.

```python
# movie_catalog.py에서 실제로 검증한 흐름 (demo.py 11번 시나리오)
# TMDB 원본 장르: ["액션", "SF"]  (재난은 TMDB 장르 목록에 없음)
# TMDB 키워드: ["disaster"]
# -> fetch_detail() 이후 movie.genres: ["액션", "SF", "재난"]
# -> 채팅에서 "재난 영화 완전 좋아함" 발화 -> 추천 스코어링에 "장르:재난"으로 정확히 반영됨
```

⚠️ 두 가지 현실적인 제약이 있다.

- TMDB 키워드는 `/movie/{id}` 상세조회에만 있고 `/movie/popular`,
  `/search/movie` 같은 목록 API에는 없다. 그래서
  `MovieCatalog.bootstrap(enrich_keywords=True)`로 켜야 카탈로그 전체에
  키워드가 채워지는데, 인기영화 페이지당 20편씩 **추가 API 호출**이
  나간다(끄면 재난/무협/히어로 태그 없이 나머지 장르는 그대로 동작한다).
- `KEYWORD_TAG_ALIASES`는 자주 쓰이는 키워드 위주라 완전하지 않다. TMDB
  키워드는 영어만 지원해서(언어 파라미터 없음) 매칭이 안 되는 케이스를
  발견하면 표에 추가할 것.

### 스코어링 요약

그룹평균만족도(42%, 전체 평균) · 하위사용자공정성(28%, `min()` 사용해 강한
비선호 보호) · 텍스트유사도(18%, 위 3단계) · 대중성(7%, TMDB popularity
정규화) · 평점(5%, vote_average 정규화)을 가중합산한다. HARD 제약(상영시간
초과, 성인 제외, 명시적 강한 비선호 -0.9 이하)을 위반하는 영화는 점수
계산 전에 제거된다.

---

## 코퍼스 통합 (국립국어원 "모두의 말뭉치" 구어 말뭉치)

사용자가 제공한 `NIKL_DIALOGUE_2025_v1.0`(구어 말뭉치, 2,927개 파일, 화자
1~4명의 실제 대화/독백 전사 데이터)을 분석해 세 가지를 만들었다. **원본
코퍼스 자체는 라이선스가 있는 배포 데이터라 이 저장소에 포함하지 않았고,**
추출·정제된 소량의 파생 데이터만 `data/`에 둔다.

### 원본은 어디에 두고 어떻게 재생성하나

```bash
mkdir -p corpus_raw
unzip NIKL_DIALOGUE_2025_v1_0.zip -d corpus_raw
#   -> corpus_raw/NIKL_DIALOGUE_2025_v1.0/*.json 형태가 되어야 한다
python build_corpus_data.py
# 다른 경로라면: python build_corpus_data.py --corpus-dir /path/to/corpus
```

`corpus_raw/`는 `.gitignore`에 포함되어 커밋되지 않는다. 코퍼스가 갱신되거나
MeetupLog 실제 채팅 로그로 바꿔서 다시 만들고 싶을 때 그대로 재실행하면
`data/` 4개 파일이 재생성되고, 끝에 자체 평가 수치가 출력된다.

**⚠️ 자동 마이닝 결과는 항상 사람이 한 번 더 검토할 것.** 빈도·일관성
기준만으로는 위험한 규칙이 섞여 들어온다 — 실제로 겪은 사례를 아래에 정리했다.
`build_corpus_data.py`는 새로 채택된 규칙 중 빈도 상위 20개를 실행 끝에
출력해주니, 다른 코퍼스로 재실행했다면 훑어보고 의심스러우면 스크립트
상단 `BLOCKLIST`에 추가할 것.

### 1) 구어체 정규화 사전 (`corpus_typo_corrector.py`)

`original_form`(실제 발화)과 `form`(정제된 표기) 36만여 쌍을 어절 단위로
정렬(difflib)해 치환 패턴을 마이닝했다. **자동 채택 후보 중 상당수가
위험했다** — 빈도·일관성 기준을 통과했어도 표준어에서 이미 다른 뜻을 가진
단어가 섞여 있었다:

| 자동 채택된 위험한 규칙      | 실제 문제                                      |
| ---------------------------- | ---------------------------------------------- |
| `가지` → `가지고` (96% 일관) | "두 가지"(단위명사)를 깨뜨림                   |
| `아이` → `아니` (100%)       | "아이"(어린이)를 깨뜨림                        |
| `그리고` → `그러고` (100%)   | 접속사 "그리고"(and)를 깨뜨림                  |
| `이자` → `이제` (100%)       | "이자"(금융 이자)를 깨뜨림                     |
| `네` → `근데`                | "네"(yes/formal you)를 깨뜨림                  |
| `중에` → `중의`              | "~하는 중에"(동안)와 "~중의"(중에서)는 다른 뜻 |

전부 수작업으로 재검토해 블록리스트로 제외했고, 1글자 어절은 문맥
의존도가 너무 커서 원칙적으로 전부 제외했다(유일한 예외: `쫌`→`좀`).
최종 403개 규칙 + "-X-"(발화 수정 표지)/"~"(장음) 제거 정규식으로 구성했다.

**검증** (학습에 쓰지 않은 홀드아웃 500문장, 문자열 유사도 difflib ratio):

| 지표                  | 교정 전 | 교정 후  |
| --------------------- | ------- | -------- |
| 원문=정답 정확히 일치 | 0.0%    | 54.0%    |
| 평균 문자열 유사도    | 0.933   | 0.968    |
| 악화된 문장           | -       | **0.0%** |

외부 모델 다운로드가 필요 없고 실제로 검증된 유일한 정규화 경로라
`config.ENABLE_CORPUS_TYPO_CORRECTION` 기본값을 `true`로 뒀다.

### 2) 관련성 분류기 재학습 (`relevance_classifier.py`)

"영화"/"감독"/"배우"/"극장" 등 명시적 신호가 있는 실제 발화(양성)와, 그런
신호가 없고 문화/취미 주제도 아닌 발화(음성)를 각 500개 추출했다.

| 학습 데이터                           | 코퍼스 테스트 정확도 | 수작업 seed(신조어 포함) 정확도 |
| ------------------------------------- | -------------------- | ------------------------------- |
| 수작업 seed(40줄)만                   | 57.3%                | -                               |
| 코퍼스(700개)만                       | 93.0%                | 70.9% (신조어 재현율 급락)      |
| **코퍼스 + 수작업 seed (결합, 채택)** | 92.3%                | **92.7%**                       |

코퍼스만 쓰면 정확도는 오르지만 격식 있는 구어 코퍼스 특성상 "꿀잼"류
신조어를 절반 가까이 놓쳤다. 결합했더니 둘 다 90%대로 나와서 기본으로
채택했다(`relevance_classifier.load_training_data()`).

### 3) 장르/무드 키워드 확장 (`nlp_pipeline.py`)

실제 "영화" 언급 발화 4,596건 중 **86.2%가 기존 GENRE/MOOD 키워드로 하나도
안 잡혔다** — 대부분 장르 단어 없이 "영화 봤어?" 식이라 예상된 결과지만,
그 안에서 실제로 반복 등장하는 장르 단어(뮤지컬, 판타지, 다큐멘터리, 전쟁,
재난, 무협, 좀비, 범죄)를 빈도 기준으로 골라 `GENRE_KEYWORDS`에 추가했다.

처음엔 이 카테고리들이 TMDB 공식 장르 taxonomy와 안 맞아서(뮤지컬 → TMDB는
"음악", 범죄가 스릴러 안에 섞여 있음, 재난/무협은 TMDB에 아예 없음) 채팅에서
추출은 되어도 추천 스코어링에서 매칭이 안 되는 문제가 있었다. TMDB
`/genre/movie/list`(ko-KR) 19개 공식 장르를 직접 확인해서
(`movie_catalog.TMDB_GENRE_NAMES_KO`) 카테고리 이름을 최대한 맞췄고
("뮤지컬"→"음악" 매칭용 키워드로 재배치, "범죄"를 "스릴러"에서 분리), TMDB
장르 목록에 아예 없는 재난/무협/히어로는 **TMDB 키워드 API**
(`/movie/{id}/keywords`, `append_to_response=keywords`)로 보강했다 —
자세한 내용은 [추천 엔진](#추천-엔진) 절의 "TMDB 키워드로 비공식 장르 보강" 참고.

---

## 보안

- 이전에 채팅으로 공유됐던 TMDB/KOFIC/Hugging Face 키는 **평문으로 노출**된
  적이 있으므로, 각 서비스 콘솔에서 반드시 재발급(rotate)하세요.
- `config.py`는 `.env`/환경변수로 주입된 값이 없으면 빈 문자열이고, 실제로
  그 키가 필요한 외부 호출 시점에만 `require_key()`가 명확한 에러를 던집니다.
  코드 어디에도 실제 키 값을 기본값으로 박아두지 않았습니다.
- `.env.example`을 `.env`로 복사해 채우세요. `.gitignore`에 `.env`와
  `corpus_raw/`가 이미 포함돼 있어 실수로 커밋되는 것을 막습니다.
- API 설계 문서의 "외부 API 키 관리 원칙"(TMDB/KOBIS 키는 서버 환경변수에만
  저장, 클라이언트가 외부 API를 직접 호출하지 않음)과 이 코드의 구조가
  일치합니다 — TMDB/KOFIC/HF 키는 모두 `config.py`(서버 프로세스 환경변수)에만
  존재하고, 클라이언트(Spring Boot/프런트)는 오직 이 FastAPI 서비스의
  `/recommend` 엔드포인트만 호출합니다.

---

## 알려진 한계와 다음 단계

1. **관련성 분류기 재학습 — ✅ 코드 준비 완료, 실측 검증은 미완.**
   `relevance_classifier.py`에 `TransformerRelevanceClassifier`를 추가해
   KcELECTRA 등 한국어 사전학습 모델 파인튜닝 결과를 `predict_proba`
   인터페이스 그대로 감싸도록 했고(`config.ENABLE_TRANSFORMER_RELEVANCE_CLASSIFIER`
   opt-in, 체크포인트 없거나 로드 실패 시 TF-IDF로 자동 폴백), 오프라인
   파인튜닝용 `train_relevance_classifier.py`도 준비했다(학습 데이터는
   기존 `load_training_data()`를 그대로 재사용하므로 코퍼스가 늘면 자동
   반영됨). 다만 이 코드를 작성한 환경은 huggingface.co 접근이 막혀 있어
   실제로 파인튜닝을 돌려 TF-IDF 베이스라인(코퍼스+SEED 92.3%/92.7%) 대비
   더 나은지 검증하지 못했다 — HF 접근이 되는 환경에서
   `python train_relevance_classifier.py` 실행 후 held-out 지표를 확인하고
   개선이 확인될 때만 플래그를 켤 것. 실 MeetupLog 운영 로그가 쌓이면
   `load_training_data()`가 그 로그도 함께 쓰도록 확장하는 것을 권장한다.
2. **State 영속화 — ✅ 해결(설계 변경).** 처음엔 `state_store.py`(Redis/
   인메모리로 FastAPI가 직접 라운드 상태를 들고 있는 방식)로 풀었는데,
   이후 Main Backend DB 스키마를 실제로 설계해보니 `message_analyses`/
   `user_preference_states` 테이블이 이미 이 역할을 MySQL에서 전담하도록
   돼 있었다. 그래서 최종적으로는 **FastAPI를 완전히 무상태로 바꾸는
   쪽으로 재설계**했다 — `nlp_pipeline.analyze_message()` +
   `api.py`의 `/analyze-message`, `/recommend` 참고([API 아키텍처](#api-아키텍처)
   절에 상세 설명). `state_store.py`는 삭제하지 않고 옵션/레거시 경로로
   남겨뒀다(단독 데모, 향후 캐시 레이어 후보).
3. **ConversationFocus의 슬롯 구조 — ✅ 해결됨.** 장르/무드/영화 슬롯 각각에
   `last_genre_at`/`last_mood_at`/`last_movie_at` 발화 시각을 별도로
   기록하도록 `ConversationFocus`를 확장했고, `resolve_with_focus()`가
   (예전처럼 장르를 무조건 무드보다 우선하는 고정 순서가 아니라) 실제로
   더 최근에 갱신된 슬롯을 비교해서 채택하도록 바꿨다. 예: A가 무드, B가
   장르를 언급하고 C가 "그거"라 하면 더 최근인 B의 장르가 채택되지만,
   이후 D가 무드를 다시 언급하면 그다음 "그거"는 다시 무드로 해석된다.
4. **GENRE_KEYWORDS ↔ TMDB 장르 taxonomy 불일치 — ✅ 해결됨.** 카테고리
   이름을 TMDB 공식 19개 장르(`movie_catalog.TMDB_GENRE_NAMES_KO`)에
   맞췄고("뮤지컬"→"음악", "범죄"를 "스릴러"에서 분리), 장르 목록에 아예
   없는 재난/무협/히어로는 TMDB 키워드 API로 보강했다 — [추천 엔진 절의
   "TMDB 키워드로 비공식 장르 보강"](#tmdb-키워드로-비공식-장르-보강-재난무협히어로)
   참고. 다만 이 보강은 `fetch_detail()`(또는
   `bootstrap(enrich_keywords=True)`)로 가져온 영화에만 적용되고, 목록 API로만
   가져온 영화는 여전히 비어있을 수 있다.
5. **KEYWORD_TAG_ALIASES / MAJOR_DISTRIBUTOR_ALIASES 확장 — ✅ 1차 확장
   완료, 계속 진행형 항목.** `KEYWORD_TAG_ALIASES`에 재난(전염병/지진/쓰나미/
   화산/조난 등)·무협(사무라이/검객 등)·히어로(빌런/자경단 등) 관련 TMDB
   영어 키워드를 추가했고, `MAJOR_DISTRIBUTOR_ALIASES`에 NEW·플러스엠 같은
   준 메이저와 명필름·집시네마·시네마달·바른손이앤에이 등 중소/독립
   제작·배급사를 추가했다(실제 존재 확인 후 반영). 다만 두 표 모두 성격상
   "발견하는 대로 계속 추가하는" 표라 여전히 완전하지 않다 — TMDB 키워드는
   영어만 지원해서 매칭이 안 되는 케이스를, KOFIC 배급사는 중소/독립
   배급사 오매칭을 발견하면 각각 `movie_catalog.py`의 해당 표에 계속
   추가할 것.
6. **SBERT/ET5/ElectraSpacer 실검증 — ✅ SBERT는 실측 완료, ET5는 확정된
   미지원, ElectraSpacer만 여전히 미해결.**
   사용자가 실제 HF 토큰으로 `router.huggingface.co/hf-inference`를 두 차례
   직접 호출해 다음을 실측으로 확인해줬다:
   - `j5ng/et5-typos-corrector`는 `400 Model not supported by provider
hf-inference` — API로는 확정적으로 불가능하다(재시도해도 바뀔 문제가
     아님). `corpus_typo_corrector.py`가 계속 정답이다.
   - `jhgan/ko-sroberta-multitask`는 처음엔 `feature-extraction` 형식
     (`{"inputs": [...]}`)으로 보냈더니 `400`이 났는데, 알고 보니 이 모델은
     벡터가 아니라 문장 쌍 유사도를 주는 `SentenceSimilarityPipeline`
     (`{"inputs": {"source_sentence":.., "sentences":[..]}}`)으로 배포돼
     있었다 - 에러 메시지로 정확한 원인을 확인하고 `text_normalization.
SentenceEmbedder`를 `similarity_matrix()` 방식으로 다시 짜서 `200`과
     실제 유사도 값(`[0.333, 0.067]`)을 받는 것까지 확인했다.
   - 도중에 `api-inference.huggingface.co`(폐지된 구 도메인, HTTP 410)를
     쓰고 있던 버그도 발견해서 `router.huggingface.co`로 고쳤다 - 처음 DNS
     조회 실패가 났던 원인이었다.

   `ElectraSpacer`는 이번에 손대지 않았다 - GitHub 리포지토리 체크포인트라
   HF Inference API 대상이 아니고, 로컬 검증도 여전히 안 된 상태다.
   `verify_hf_models.py`가 세 모델 다 커버하니, ElectraSpacer 리포를 클론해
   로컬에 두고 검증하고 싶다면 그대로 실행하면 된다.

7. **`corpus_typo_corrector.py`의 사전 특성 — ✅ 재적용 도구 준비 완료.**
   `build_corpus_data.py`가 이제 `--format {nikl,meetuplog}`를 지원하도록
   일반화됐다. `iter_utterances_meetuplog()`가 MeetupLog 실 채팅 로그 기반
   `*.jsonl`(`{"topic":..,"raw":..,"corrected":..}`, "corrected"는 사람이
   정정한 정답 표기로 없으면 생략 가능)을 읽어 기존 마이닝/필터링
   (빈도≥40, 일관성≥85%, BLOCKLIST 수동 검토)·관련성 코퍼스 추출 로직을
   그대로 재사용하게 해준다. 다만 이건 "같은 방법론을 실 로그에 돌릴 수
   있는 도구"가 준비됐다는 뜻이지, 실제 MeetupLog 운영 로그로 재검증까지
   끝났다는 뜻은 아니다 — 로그가 쌓이면
   `python build_corpus_data.py --format meetuplog --corpus-dir <경로>`로
   재실행하고, 출력되는 "안전성 검토용" 빈도 상위 목록을 반드시 사람이 한
   번 더 훑어볼 것.
8. **`user_preference_states` EAV 매핑 — ✅ 해결, 단 규약 하나는 팀 검토
   필요.** `preference_eav.py`가 EAV 행 ↔ `UserPreferenceState`(dict) 양방향
   변환과, DB에 히스토리가 없는 상태에서 시간가중 값을 갱신하는
   `blend_preference_update()`(온라인 근사, 원본 히스토리 재계산과 100%
   동일하진 않음 - 모듈 docstring 참고)를 제공한다. ⚠️ **`target_type=
CONSTRAINT`일 때 `target_value`를 `"키:값"` 문자열로 인코딩하는 규약**
   (`max_runtime:120` 등)은 테이블 정의서에 없어서 이번에 임의로 정한
   것이다 — DB에 제약값을 담을 별도 컬럼이 없어서 나온 임시방편이니, 실제
   Main Backend 구현 전에 팀과 이 규약을 맞출지 스키마를 바꿀지 확인할 것.
9. **`recommendation_runs.run_number`(재추천) — ⚠️ 미해결.** DB 스키마는
   한 세션 안에서 재추천마다 `run_number`가 늘어나는 구조인데,
   `recommendation_engine.recommend()`는 여전히 매번 단발 계산만 한다 —
   이전 run에서 이미 추천했던 영화를 재추천 시 제외/감점하는 로직이 없다.
   이건 ml_service보다는 Main Backend가 "몇 번째 run인지, 이전 run에서 뭘
   추천했는지"를 알고 있어야 하는 문제라, `/recommend` 요청에 "제외할
   movie_id 목록" 같은 필드를 추가하는 방향으로 다음에 풀 것을 제안한다.
10. **`movie_embeddings` 배치 저장 — ⚠️ 미해결.** `text_normalization.
SentenceEmbedder`는 여전히 요청마다 즉석으로 임베딩을 계산하고, DB의
    `movie_embeddings` 테이블에 미리 계산해 저장하는 배치 파이프라인은
    아직 없다. SBERT 자체가 이 환경에서 실검증 안 된 상태(#6)라 우선순위가
    낮지만, #6이 풀리면 `build_corpus_data.py`와 비슷한 구조의
    `build_movie_embeddings.py`(카탈로그 전체를 순회하며 임베딩 계산 →
    `movie_embeddings` 테이블 형식으로 저장)를 다음에 만들 것을 제안한다.
