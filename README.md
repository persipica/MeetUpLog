# MeetupLog AI Service (v2 — 백지 재설계)

그룹 채팅 대화를 분석해 영화를 추천하는 MeetupLog의 AI 파트. 이전 버전
(v1)을 완전히 새로 설계했다 — 기능/로직도 전부 재검토 대상으로 놓고,
**검증되지 않은 무거운 의존성은 다 빼고 최소 기능만** 남겼다.

## v1과 달라진 점

| 항목 | v1 | v2 |
|---|---|---|
| 관련성 판별 / 텍스트 유사도 | TF-IDF+LogisticRegression 학습형 분류기, opt-in SBERT/KcELECTRA | 규칙 기반 키워드 매칭 + 문자 n-gram TF-IDF만 |
| 맞춤법 교정 | ET5(opt-in, 로컬 torch 필요, 미검증) | 없음 (필요성이 확인되면 추후 추가) |
| 띄어쓰기 교정 | ElectraSpacer(opt-in, 미검증) | 없음 |
| 신조어 정규화 | 코퍼스 마이닝 403개 규칙 사전 | 소규모 하드코딩 사전(꿀잼/노잼 등 10여 개) |
| 영화 카탈로그 | TMDB + KOFIC(등급 보강) | TMDB만 |
| State 저장 | Redis/인메모리 옵션 (`state_store.py`, 실제로는 죽은 코드였음) | 없음 — 애초에 무상태 설계만 유지 |
| 코퍼스 통합 파이프라인 | `build_corpus_data.py` + 코퍼스 3종 데이터 | 없음 |

빠진 기능들은 "필요 없다"가 아니라 **"이 환경에서 실측 검증이 안 됐거나,
MVP 핵심 기능에 필수가 아니라서 지금은 뺐다"**는 뜻이다. 실 채팅 로그가
쌓이고 관련성 판별 정확도가 부족하다고 확인되면, 그때 v1의 학습형
분류기나 코퍼스 사전을 다시 참고해 추가하는 것을 권장한다.

## 빠른 시작

```bash
pip install -r requirements.txt
python demo.py          # 외부 API 키 없이 파이프라인 확인
```

실 서버:
```bash
cp .env.example .env    # TMDB_API_KEY 채워넣기
uvicorn api:app --reload --port 8000
```

## API

무상태(stateless) — Main Backend가 DB(`message_analyses`/
`user_preference_states`)에서 이전 상태를 읽어 요청에 실어 보내고, 이
서비스는 갱신된 조각만 계산해 돌려준다.

- `POST /analyze-message` — 메시지 1건 분석 (관련성, 절 단위 극성/제약,
  Focus 문맥, 의도, `preference_deltas`)
- `POST /recommend` — 그 방의 `user_preference_states` 전체를 받아 TOP-3 추천
- `GET /health`

## 파일 구성

| 파일 | 역할 |
|---|---|
| `config.py` | 환경설정(.env), 추천 가중치, 임계값 |
| `time_utils.py` | timezone-aware UTC 헬퍼 |
| `models.py` | 데이터 모델 |
| `movie_catalog.py` | TMDB 카탈로그 수집 + 오타 제목 매칭(difflib) |
| `nlp_pipeline.py` | 관련성 판별, 절 단위 추출, Focus 해석, 의도 분류, `analyze_message()` |
| `preference_eav.py` | EAV ↔ UserPreferenceState 변환, 시간가중 블렌딩 |
| `recommendation_engine.py` | HARD 제약 필터링, 5요소 스코어링, 모드 결정 |
| `api.py` | FastAPI 엔드포인트 |
| `demo.py` | 외부 API 없이 전체 흐름 확인 |

## 기획서 대응表

| 기획서 항목 | 구현 위치 |
|---|---|
| 관련성 필터 (FR-AI-01~02) | `nlp_pipeline.is_relevant()` — 규칙 기반 |
| 최신 의견 우선 (FR-AI-06) | `preference_eav._time_weight()` — half-life 지수 감쇠 |
| 추천 점수 5요소 (10장 표) | `recommendation_engine.score_candidates()` — 그룹만족도 42% / 공정성 28% / 텍스트유사도 18% / 대중성 7% / 평점 5% |
| HARD 제약 | `recommendation_engine._violates_hard_constraints()` |
| 4가지 추천 모드 (10장) | `recommendation_engine.decide_mode()` |
| 오타 보정/미등록 제목 (FR-AI-04) | `movie_catalog.match_title()` — difflib 기반, 확신도(기본 0.72) 미만이면 미매칭 |
| 문맥 해석 (FR-AI-05) | `nlp_pipeline.ConversationFocus` + `resolve_with_focus()` |

## 알려진 한계 (v2 MVP 시점)

1. **키워드 사전이 작다.** `GENRE_KEYWORDS`/`MOOD_KEYWORDS`/`SLANG_*`이
   v1 대비 훨씬 작은 수작업 사전이다. 실 채팅 로그를 모아 커버리지를
   측정하고, 부족하면 확장할 것.
2. **관련성 판별이 규칙 기반이라 학습형 분류기보다 정확도가 낮을 수 있다.**
   실측 정확도를 재보고, 부족하면 v1의 TF-IDF+LogisticRegression 접근을
   다시 가져올 것을 권장한다.
3. **KOFIC/등급 보강 없음.** 성인 등급이 TMDB의 `adult` 플래그에만 의존한다
   — TMDB 데이터가 부정확한 소수 사례에서는 걸러지지 않을 수 있다.
4. **영화 상세 정보(러닝타임) 미보강.** TMDB 목록 API에는 러닝타임이 없어
   `MovieCandidate.runtime`이 항상 `None`이다 — HARD 제약 중 `max_runtime`이
   실질적으로 걸러내지 못한다. 상세 API(`/movie/{id}`) 호출로 보강 필요.
5. **임베딩 사전 계산 없음.** 텍스트 유사도는 요청마다 TF-IDF를 즉석
   계산한다 — 카탈로그가 커지면 배치 사전 계산을 고려할 것.
