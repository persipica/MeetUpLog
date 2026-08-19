# MeetupLog ML Service (재설계 버전)

그룹 채팅 메시지를 분석해 취향을 추출하고, 그룹 전체에 맞는 영화를 추천하는 FastAPI 서비스입니다.

이 버전은 팀원(sjy)이 만든 아키텍처를 기준으로 재설계되었습니다 - **ml-service가 자체 DB(chat_rooms / chat_messages / preference_snapshots / recommendation_history / recommendation_events)를 직접 소유**하며, 메인 백엔드에 의존하지 않고 채팅 수집부터 추천까지 독립적으로 동작합니다.

## 아키텍처 개요

```
채팅 메시지 -> [POST /v1/chat/messages] -> ml-service DB에 저장
                                              |
                                              v
                              [POST /v1/chat/analyze] -> chat_analysis.analyze_chat()
                                              |            (장르/인물/브랜드/OTT/국가/연도 등 취향 추출)
                                              v
                                    preference_snapshots에 저장
                                              |
                                              v
                        [POST /v1/recommendations/group] -> recommender.recommend()
                                              |             (그룹 평균 만족도 + 공정성 + 의미 유사도 + 인기도/평점)
                                              v
                                       Top-N 추천 결과 + 근거(reasons)
```

카탈로그(`data/normalized/movies.json`)는 `collect_tmdb()` / `collect_kobis()`로 TMDB·KOBIS에서 수집·병합됩니다.

## 이번 재설계에서 이식/수정한 것

- **오타 교정** (`meetup_ml/corpus_typo_corrector.py`): 국립국어원 "모두의 말뭉치" 구어 말뭉치 36만여 쌍에서 마이닝하고 홀드아웃 500문장으로 검증한 403개 규칙(0% 악화, 77.2% 개선). 외부 모델 다운로드 없이 항상 켜져 있으며, `text_correction.KoreanTextCorrector`의 첫 단계로 실행됩니다.
- **KOFIC 동명 영화 오매칭 방지** (`meetup_ml/collectors.py`의 `_find_kobis_match`, `_best_company_similarity`, `MAJOR_DISTRIBUTOR_ALIASES`): 제목만으로 KOBIS를 검색하면 리메이크 등 동명 영화가 있을 때 관람등급이 엉뚱하게 붙을 수 있어, 제목 완전일치 -> 개봉연도(±1년) -> 배급사명 유사도(로마자↔한글 별칭 정규화 포함) 순으로 후보를 좁힙니다. 예전 `collect_kobis()`는 KOBIS 데이터를 raw dump만 하고 `Movie.certification`에 전혀 반영하지 않아 관람등급 선호 필터가 조용히 무력화돼 있었는데, 이번에 실제 병합까지 연결했습니다.
- **시크릿 하드코딩 제거** (`meetup_ml/config.py`): `meetup_mysql_password="1234"`, `meetup_mysql_database="lostmatch3_dev"`(다른 프로젝트에서 복사된 것으로 보이는 이름) 같은 기본값을 제거하고, `.env` 없이 배포하면 `require_mysql()`이 명확한 에러를 내도록 바꿨습니다. 기본 DB 백엔드도 `sqlite`로 바꿔 안전한 기본값을 유지합니다.
- **장르 인식 버그 수정** (`meetup_ml/chat_analysis.py`의 `_term_forms`): "공포영화는 싫어"처럼 장르+"영화"+조사가 띄어쓰기 없이 붙으면 장르 인식 자체가 안 되던 문제(조사를 한 겹만 벗기던 로직의 한계)를 수정했습니다. 스모크 테스트 작성 중 발견했습니다.

## 시작하기

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

cp .env.example .env   # TMDB_API_KEY 등 채워 넣기
uvicorn meetup_ml.api:app --reload
```

`.env`가 없어도 서버는 뜹니다 (DB 기본값은 sqlite). TMDB/KOBIS 키가 필요한 라우트(`/v1/collections`, 관람등급 보강 등)만 호출 시점에 `RuntimeError`로 누락을 알립니다.

## 환경변수

`.env.example` 참고. 핵심만 요약하면:

| 변수                                                | 용도                            | 기본값                  |
| --------------------------------------------------- | ------------------------------- | ----------------------- |
| `TMDB_API_KEY` / `TMDB_API_TOKEN`                   | TMDB 카탈로그 수집              | 없음 (필요 시점에 에러) |
| `KOBIS_API_KEY`                                     | KOFIC 관람등급 보강             | 없음 (필요 시점에 에러) |
| `MEETUP_DB_BACKEND`                                 | `sqlite` 또는 `mysql`           | `sqlite`                |
| `MEETUP_MYSQL_DATABASE/USER/PASSWORD`               | MySQL 접속정보 (`mysql`일 때만) | 없음 (필요 시점에 에러) |
| `HF_TOKEN`                                          | SBERT 임베딩 등                 | 선택                    |
| `MEETUP_USE_TYPO_MODEL` / `MEETUP_USE_SPACER_MODEL` | 무거운 로컬 보정 모델 opt-in    | `false`                 |

## 테스트

```bash
pytest
```

`tests/test_smoke.py`는 네트워크 호출 없이(TMDB/KOBIS/HuggingFace 전혀 안 씀) 다음을 합성 데이터로 검증합니다:

- `chat_analysis.analyze_chat()` - 발화별 분석 결과 형태, 장르 호감/비호감 추출
- `recommender.recommend()` - 취향 기반 랭킹, 추천 불가(`recommendation_eligible=False`) 영화 제외
- `collectors._best_company_similarity()` - KOFIC 배급사명 별칭 매칭

## 주요 API

| 메서드     | 경로                                                   | 설명                                     |
| ---------- | ------------------------------------------------------ | ---------------------------------------- |
| GET        | `/health`, `/v1/version`                               | 헬스체크/버전                            |
| POST       | `/v1/collections`                                      | TMDB/KOBIS 수집 잡 시작                  |
| GET        | `/v1/jobs/{job_id}`                                    | 수집 잡 상태                             |
| POST       | `/v1/training`, GET `/v1/evaluation`, GET `/v1/models` | 모델 학습/평가/레지스트리                |
| POST       | `/v1/chat/messages`                                    | 채팅 메시지 저장                         |
| GET/DELETE | `/v1/chat/rooms/{room_id}`                             | 채팅방 조회/초기화                       |
| POST       | `/v1/chat/analyze`                                     | 채팅 분석 -> 취향 추출                   |
| POST       | `/v1/recommendations/group`                            | 그룹 추천                                |
| POST       | `/v1/recommendations/user`                             | 개인 추천                                |
| GET        | `/v1/feedback/readiness`                               | 재학습 게이팅(피드백 이벤트 충분성 확인) |
| GET        | `/v1/correction/status`                                | 오타 교정기 상태                         |

## 검증 범위 (중요)

이번 재설계 패스는 **그룹 추천 핵심 흐름**(`chat_analysis.analyze_chat` + `recommender.recommend`)과 이번에 이식/수정한 부분만 검증했습니다. 원래 이 코드베이스(약 8000줄, API 라우트 20개)에는 테스트가 전혀 없었고, 이번 패스에서 다음은 **검증하지 않았습니다**:

- `/v1/training`, `/v1/evaluation`, `/v1/models`, `/v1/collections` 잡 파이프라인 전체
- `data/normalized/movies.json`(16MB) 실 카탈로그 대상 임베딩 학습(`ModelBundle.fit`)
- 20개 API 라우트 전체 (요청/응답 계약, 에러 처리 포함)
- `deployment.py`의 실제 모델 교체(atomic activate/rollback) 시나리오
- MySQL 백엔드 실제 접속 (SQLite 경로만 로컬에서 확인)

프로덕션 배포 전에는 위 항목들에 대한 추가 검증이 필요합니다.
