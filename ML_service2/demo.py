"""
MeetupLog AI Service - 데모 (NLP 강화판 검증)
==================================
TMDB/KOFIC 실 API 호출 없이, 모의 채팅 로그로 강화된 NLP 파이프라인을 검증한다.
확인 포인트:
  1) 복합 절("좋은데/근데")에서 극성이 절 단위로 올바르게 분리되는지
  2) "말고/빼고" 표현이 단순 비선호가 아니라 HARD 제외 제약으로 반영되는지
  3) 강도 부사("완전", "그냥")가 점수 크기에 반영되는지
  4) "그거 좋아", "나도" 같은 생략 발화가 Focus를 통해 올바르게 해석되는지
  5) 학습형 관련성 분류기가 규칙 기반이 놓치는/오탐하는 문장을 보정하는지
"""

from datetime import timedelta

from models import MovieCandidate, UserPreferenceState
from nlp_pipeline import ConversationFocus, apply_message_to_state, is_relevant
from recommendation_engine import recommend
from time_utils import utc_now


def section(title: str):
    print(f"\n{'=' * 10} {title} {'=' * 10}")


def demo_relevance_filter():
    section("1) 관련성 분류기: 규칙기반이 취약한 문장들")
    cases = [
        ("그냥 아무 코미디나 보고싶다", True),   # 규칙기반 키워드는 다 잡지만 확인용
        ("액션 배우가 꿈이야 진짜", True),        # 배우 언급이라 관련은 맞지만 추천 근거로는 약함
        ("오늘 너무 피곤해서 아무것도 하기 싫다", False),
        ("그 감독 다음 작품 언제 나와?", True),
        ("과제 하기 싫다 진짜", False),
    ]
    for text, expected in cases:
        relevant, score = is_relevant(text)
        mark = "OK " if relevant == expected else "!! "
        print(f"  {mark}'{text}' -> relevant={relevant} (score={score}, expected={expected})")


def demo_clause_scoping():
    section("2) 절 단위 극성 분리 + 강도 부사")
    state = UserPreferenceState(user_id="D")
    texts = [
        "가벼운 건 완전 좋은데 무서운 건 그냥 별로야",
        "액션은 진짜 좋아하는데 너무 잔인한 로맨스는 싫어",
    ]
    now = utc_now()
    for i, text in enumerate(texts):
        apply_message_to_state(state, text, message_id=f"c{i}", timestamp=now)
        print(f"  '{text}'")
    print(f"  -> 누적 genres: {state.genres}")
    print(f"  -> 누적 moods : {state.moods}")


def demo_hard_exclusion():
    section("3) '말고/빼고' -> HARD 제외 제약 반영")
    state = UserPreferenceState(user_id="E")
    apply_message_to_state(state, "공포 말고 다른 거 보자", "h1", utc_now())
    print("  발화: '공포 말고 다른 거 보자'")
    print(f"  -> genres(비선호 점수): {state.genres}")
    print(f"  -> constraints.excluded_genres(강제 제외): {state.constraints.excluded_genres}")


def demo_focus_resolution():
    section("4) Focus 문맥: '그거 좋아', '나도' 해석")
    state = UserPreferenceState(user_id="F")
    focus = ConversationFocus()
    now = utc_now()

    steps = [
        "잔잔한 드라마 어때",   # 여기서 Focus.last_mood/last_genre 갱신
        "그거 완전 좋아",       # Focus(드라마)를 강한 긍정으로 재확인해야 함
    ]
    for i, text in enumerate(steps):
        relevant, entities = apply_message_to_state(
            state, text, message_id=f"f{i}", timestamp=now + timedelta(seconds=i), focus=focus
        )
        print(f"  '{text}' -> relevant={relevant}, used_reference={entities.used_reference}, "
              f"genres={entities.genres}")
    print(f"  -> 최종 focus: last_genre={focus.last_genre}, last_mood={focus.last_mood}")
    print(f"  -> 최종 state.genres: {state.genres}, state.moods: {state.moods}")


def mock_catalog():
    return [
        MovieCandidate(
            movie_id="1", title="은하 추격전",
            overview="가벼운 유머와 통쾌한 액션이 어우러진 우주 활극.",
            genres=["액션", "SF", "코미디"], moods=["가벼운"],
            runtime=118, popularity=88.0, vote_average=7.4,
        ),
        MovieCandidate(
            movie_id="2", title="깊은 밤의 속삭임",
            overview="폐가에서 벌어지는 오싹한 사건을 다룬 공포 영화.",
            genres=["공포", "스릴러"], moods=["무서운", "긴장감있는"],
            runtime=101, popularity=45.0, vote_average=6.1,
        ),
        MovieCandidate(
            movie_id="3", title="느린 오후",
            overview="잔잔한 일상 속 가족의 따뜻한 이야기를 그린 힐링 드라마.",
            genres=["드라마"], moods=["잔잔한"],
            runtime=105, popularity=30.0, vote_average=7.9,
        ),
    ]


def demo_end_to_end():
    section("5) 전체 흐름: 채팅 -> HARD 제외 -> 추천")
    users = {uid: UserPreferenceState(user_id=uid) for uid in ("A", "B", "C")}
    room_focus = ConversationFocus()  # 방 전체가 공유하는 Focus (사용자별 X)
    now = utc_now()

    chat = [
        ("A", "잔잔한 거 완전 좋아", 60),
        ("C", "그거 나도 좋아", 55),   # A가 남긴 '잔잔한'을 참조 (B가 끼어들기 전)
        ("B", "공포는 무조건 빼고 골라줘", 40),
    ]
    for i, (uid, text, minutes_ago) in enumerate(chat):
        ts = now - timedelta(minutes=minutes_ago)
        apply_message_to_state(users[uid], text, f"e{i}", ts, focus=room_focus)
        print(f"  [{uid}] '{text}'")

    for u in users.values():
        print(f"  -> {u.user_id}: genres={u.genres}, moods={u.moods}, excluded={u.constraints.excluded_genres}")

    result = recommend(
        room_id="room-2", round_id="round-1",
        candidates=mock_catalog(), users=list(users.values()),
        had_chat_candidates=False,
    )
    print(f"\n  추천 모드: {result.mode.value}")
    for rank, sm in enumerate(result.top_k, start=1):
        print(f"  TOP{rank}. {sm.movie.title} (점수 {sm.final_score}) - {sm.explanation.matched_preferences}")


def demo_slang():
    section("6) 신조어/줄임말 처리")
    state = UserPreferenceState(user_id="G")
    focus = ConversationFocus()
    now = utc_now()

    steps = [
        "액션 존잼 ㄹㅇ 추천함",          # 접두어+잼 패턴 -> 액션 강한 긍정
        "공포는 극혐이라 패스",            # 고정사전 -> 공포 강한 부정
    ]
    for i, text in enumerate(steps):
        relevant, entities = apply_message_to_state(
            state, text, message_id=f"g{i}", timestamp=now, focus=focus
        )
        print(f"  '{text}' -> relevant={relevant}, genres={entities.genres}, "
              f"had_slang_reaction={entities.had_slang_reaction}")
    print(f"  -> 누적 state.genres: {state.genres}")

    print()
    state2 = UserPreferenceState(user_id="H")
    focus2 = ConversationFocus()
    apply_message_to_state(state2, "잔잔한 드라마 어때", "s0", now, focus=focus2)
    relevant, entities = apply_message_to_state(state2, "완전 꿀잼ㅋㅋ", "s1", now, focus=focus2)
    print(f"  (Focus=드라마 상태에서) '완전 꿀잼ㅋㅋ' -> relevant={relevant}, "
          f"genres={entities.genres}, moods={entities.moods}, used_reference={entities.used_reference}")
    print(f"  -> 최종 state2.moods: {state2.moods}")

    print()
    irrelevant_slang, score = is_relevant("오늘 게임 개꿀잼이었음")
    print(f"  '오늘 게임 개꿀잼이었음' (영화 무관 맥락) -> relevant={irrelevant_slang} (score={score})")


def demo_cross_user_reference():
    section("7) 다른 사람이 '나도'라고 했을 때 문맥이 이어지는지")
    now = utc_now()

    print("  [예전 방식] Focus를 사용자별로 따로 관리 (버그)")
    focus_by_user = {"A": ConversationFocus(), "B": ConversationFocus()}
    state_a = UserPreferenceState(user_id="A")
    state_b = UserPreferenceState(user_id="B")
    apply_message_to_state(state_a, "잔잔한 드라마 어때", "x0", now, focus=focus_by_user["A"])
    _, entities = apply_message_to_state(state_b, "나도", "x1", now, focus=focus_by_user["B"])
    print("    A: '잔잔한 드라마 어때' (A의 focus에만 기록됨)")
    print(f"    B: '나도' -> genres={entities.genres}, moods={entities.moods}  "
          f"<- B 자신의 focus는 비어있어서 아무것도 못 잡음")

    print()
    print("  [지금 방식] Focus를 방(room) 전체가 공유")
    room_focus = ConversationFocus()
    state_a2 = UserPreferenceState(user_id="A")
    state_b2 = UserPreferenceState(user_id="B")
    apply_message_to_state(state_a2, "잔잔한 드라마 어때", "y0", now, focus=room_focus)
    _, entities2 = apply_message_to_state(state_b2, "나도", "y1", now, focus=room_focus)
    print(f"    A: '잔잔한 드라마 어때' -> focus.last_genre={room_focus.last_genre}, "
          f"last_speaker_id={room_focus.last_speaker_id}")
    print(f"    B: '나도' -> genres={entities2.genres}, moods={entities2.moods}, "
          f"used_reference={entities2.used_reference}  <- A가 남긴 focus를 B가 그대로 이어받음")
    print(f"    B 최종 state.genres: {state_b2.genres}")


def demo_corpus_typo_correction():
    section("8) 코퍼스 기반 구어체 정규화 (corpus_typo_corrector)")
    from corpus_typo_corrector import correct as corpus_correct

    examples = [
        "그냥 쫌 재밌는 영화 보구 싶어 가지구 그런 거 찾고 있었거든요.",
        "그~ 액션 영화 같은 거 좋아하는데 어~ 공포는 잘 못 보겠드라구요.",
        "-그- 그 감독 작품은 항상 재밌더라구요 그니까.",
        "완전 좋아여ㅋㅋ 이거 완전 취향이에여",  # "~여" 통신체 종결어미 (새로 추가된 규칙)
    ]
    for text in examples:
        print(f"  원문 : {text}")
        print(f"  정규화: {corpus_correct(text)}")
        print()

    print("  (국립국어원 구어 말뭉치 홀드아웃 500문장 기준 검증 결과)")
    print("  정확히 일치: 0.0% -> 54.0% / 평균 유사도: 0.933 -> 0.968")
    print("  개선된 문장: 77.2% / 악화된 문장: 0.0%")


def demo_text_similarity_upgrade():
    section("9) 텍스트 유사도: 어절 TF-IDF vs 문자 n-gram TF-IDF")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    pairs = [
        ("가볍게 웃을 수 있는 유쾌한 이야기", "가벼운 코미디"),
        ("무섭고 소름 돋는 공포 영화", "무서운 거 싫어"),
    ]
    for movie_text, user_text in pairs:
        word_vec = TfidfVectorizer()
        m1 = word_vec.fit_transform([movie_text, user_text])
        word_sim = cosine_similarity(m1[0:1], m1[1:2])[0][0]

        char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3))
        m2 = char_vec.fit_transform([movie_text, user_text])
        char_sim = cosine_similarity(m2[0:1], m2[1:2])[0][0]

        print(f"  영화 줄거리: '{movie_text}'")
        print(f"  사용자 발화: '{user_text}'")
        print(f"    어절 단위 TF-IDF 유사도: {word_sim:.4f}  (활용형이 다르면 0에 수렴)")
        print(f"    문자 n-gram TF-IDF 유사도: {char_sim:.4f}  (지금 recommendation_engine이 쓰는 방식)")
        print()

    print("  참고: config.ENABLE_SBERT_SIMILARITY를 켜고 SBERT가 정상 로드되면")
    print("  이 문자 n-gram 경로 대신 진짜 의미 기반 임베딩 유사도를 쓴다.")


def demo_kofic_disambiguation():
    section("10) KOFIC 동명 영화 오매칭 방지 (release_year / 배급사 비교)")
    from unittest.mock import MagicMock
    from movie_catalog import KoficClient

    def fake_response(json_data):
        r = MagicMock()
        r.raise_for_status = lambda: None
        r.json = lambda: json_data
        return r

    print("  시나리오 A: 같은 제목, 다른 개봉연도의 영화 두 편")
    list_response = {
        "movieListResult": {"movieList": [
            {"movieCd": "2019CODE", "movieNm": "리멤버 미", "prdtYear": "2019"},
            {"movieCd": "2023CODE", "movieNm": "리멤버 미", "prdtYear": "2023"},
        ]}
    }
    client = KoficClient(api_key="demo-key")
    client.session.get = MagicMock(return_value=fake_response(list_response))
    print("    release_year 없이 조회 ->", client.find_movie_code("리멤버 미"),
          "(첫 후보로 폴백, 오매칭 위험)")
    print("    release_year=2023 조회 ->", client.find_movie_code("리멤버 미", release_year=2023))
    print("    release_year=2019 조회 ->", client.find_movie_code("리멤버 미", release_year=2019))

    print()
    print("  시나리오 B: 제목·연도까지 같아서 배급사로만 구분 가능한 경우")
    list_response2 = {
        "movieListResult": {"movieList": [
            {"movieCd": "INDIE_CODE", "movieNm": "여름밤", "prdtYear": "2022"},
            {"movieCd": "MAJOR_CODE", "movieNm": "여름밤", "prdtYear": "2022"},
        ]}
    }
    info_responses = {
        "INDIE_CODE": {"movieInfoResult": {"movieInfo": {
            "companys": [{"companyNm": "인디스토리", "companyPartNm": "배급사"}]}}},
        "MAJOR_CODE": {"movieInfoResult": {"movieInfo": {
            "companys": [{"companyNm": "씨제이이엔엠", "companyPartNm": "배급사"}]}}},
    }

    def mock_get(url, params=None, timeout=10):
        if "searchMovieList" in url:
            return fake_response(list_response2)
        return fake_response(info_responses[params["movieCd"]])

    client2 = KoficClient(api_key="demo-key")
    client2.session.get = MagicMock(side_effect=mock_get)
    code = client2.find_movie_code("여름밤", release_year=2022, production_companies=["CJ ENM"])
    print(f"    TMDB production_companies=['CJ ENM'] 전달 -> {code}")
    print("    (별칭 테이블로 'CJ ENM' <-> '씨제이이엔엠'을 매칭해 MAJOR_CODE를 정확히 골라냄)")


def demo_tmdb_keyword_enrichment():
    section("11) TMDB 키워드로 재난/무협/히어로 등 비-공식장르 매칭")
    from unittest.mock import MagicMock
    from movie_catalog import TMDBClient

    def fake_response(json_data):
        r = MagicMock()
        r.raise_for_status = lambda: None
        r.json = lambda: json_data
        return r

    genre_list_response = {"genres": [{"id": 28, "name": "액션"}, {"id": 878, "name": "SF"}]}
    movie_detail_response = {
        "id": 12345, "title": "대격변",
        "overview": "거대한 화산 폭발로 도시가 무너지기 시작한다.",
        "genres": [{"id": 28, "name": "액션"}, {"id": 878, "name": "SF"}],
        "runtime": 120, "popularity": 55.0, "vote_average": 6.8, "adult": False,
        "release_date": "2023-07-01",
        "keywords": {"keywords": [{"id": 1, "name": "disaster"}]},
    }

    def mock_get(url, params=None, timeout=10):
        if "genre/movie/list" in url:
            return fake_response(genre_list_response)
        return fake_response(movie_detail_response)

    client = TMDBClient(api_key="demo-key")
    client.session.get = MagicMock(side_effect=mock_get)
    movie = client.fetch_detail("12345")

    print("  TMDB 원본 장르: ['액션', 'SF']  (재난은 TMDB 공식 장르 목록에 없음)")
    print("  TMDB 키워드: ['disaster']")
    print(f"  -> fetch_detail() 이후 movie.genres: {movie.genres}")

    print()
    state = UserPreferenceState(user_id="A")
    apply_message_to_state(state, "재난 영화 완전 좋아함", "m1", utc_now())
    result = recommend(
        room_id="r1", round_id="round1",
        candidates=[movie], users=[state], had_chat_candidates=False,
    )
    print(f"  채팅: '재난 영화 완전 좋아함' -> 추천 TOP1: {result.top_k[0].movie.title}")
    print(f"  반영된 선호: {result.top_k[0].explanation.matched_preferences}")


def demo_stateless_db_aligned_flow():
    """meetuplog_schema.sql(Main Backend DB)에 맞춘 무상태 경로 검증.
    apply_message_to_state()(프로세스 메모리에 UserPreferenceState를 계속
    누적)와 달리, analyze_message()는 매 호출마다 이전 조각(prior_focus,
    prior_preferences)을 받아 갱신된 조각만 돌려준다 - Main Backend가
    message_analyses/user_preference_states 테이블에 저장했다가 다음 메시지
    분석 요청 시 다시 실어 보내는 흐름을 그대로 흉내낸다."""
    section("12) 무상태 분석 경로 (api.py /analyze-message, /recommend와 동일 로직)")

    from nlp_pipeline import analyze_message
    from preference_eav import PreferenceRow, eav_rows_to_user_states

    t0 = utc_now()

    # 1) 첫 메시지: DB에 아직 이 방의 message_analyses가 없으므로 prior_focus=None
    r1 = analyze_message("가벼운 코미디 완전 좋아", timestamp=t0)
    print(f"  [메시지1] intent={r1.intent_code}, deltas={r1.preference_deltas}")
    print("  -> Main Backend가 이 결과를 message_analyses에 INSERT하고,")
    print("     preference_deltas를 user_preference_states에 upsert한다고 가정")

    # 2) Main Backend가 DB에서 다시 읽어와 다음 요청에 실어 보낸다고 가정
    prior_rows = [
        PreferenceRow(
            user_id="u1", target_type=d["target_type"], target_value=d["target_value"],
            polarity=d["polarity"], preference_type=d["preference_type"],
            strength=d["strength"], confidence=d["confidence"], updated_at=t0,
        )
        for d in r1.preference_deltas
    ]
    r2 = analyze_message(
        "무서운 건 싫어", timestamp=t0 + timedelta(hours=1),
        prior_focus=r1.focus_json, prior_preferences=prior_rows,
    )
    print(f"  [메시지2, 1시간 뒤] intent={r2.intent_code}, deltas={r2.preference_deltas}")

    # 3) 방장이 추천받기 -> Main Backend가 user_preference_states 전체를 모아 전달
    all_rows = prior_rows + [
        PreferenceRow(user_id="u1", target_type=d["target_type"], target_value=d["target_value"],
                       polarity=d["polarity"], preference_type=d["preference_type"],
                       strength=d["strength"], confidence=d["confidence"])
        for d in r2.preference_deltas
    ]
    users = list(eav_rows_to_user_states(all_rows).values())
    print(f"  -> EAV {len(all_rows)}행에서 복원한 UserPreferenceState: "
          f"genres={users[0].genres}, moods={users[0].moods}")


if __name__ == "__main__":
    demo_relevance_filter()
    demo_clause_scoping()
    demo_hard_exclusion()
    demo_focus_resolution()
    demo_end_to_end()
    demo_slang()
    demo_cross_user_reference()
    demo_corpus_typo_correction()
    demo_text_similarity_upgrade()
    demo_kofic_disambiguation()
    demo_tmdb_keyword_enrichment()
    demo_stateless_db_aligned_flow()
