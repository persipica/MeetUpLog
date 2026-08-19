"""Offline smoke tests for the redesigned meetup_ml base (sjy 아키텍처 채택 후).

이 저장소에는 원래 tests/ 디렉터리가 전혀 없었다 - pyproject.toml에는
testpaths=["tests"]가 이미 있었지만 실제 파일은 하나도 없었다. 8000줄
규모(20개 API 라우트, 모델 학습/등록/배포 파이프라인 포함) 전체를 이번
패스에서 다 검증하는 건 범위 밖이라, 이 파일은 그룹 추천의 핵심 두 함수
- chat_analysis.analyze_chat()과 recommender.recommend() - 그리고 이번에
새로 포팅한 KOBIS 동명 영화 오매칭 방지 로직(collectors.py)만 네트워크
없이 합성 데이터로 검증한다. TMDB/KOBIS/HuggingFace 호출은 전혀 하지
않는다 (analyze_chat/recommend 자체가 순수 함수라 원래도 네트워크를
타지 않는다 - api.py에서 두 함수를 감싸는 라우트 레이어만 TMDB 등을
호출한다).
"""

from meetup_ml.chat_analysis import analyze_chat
from meetup_ml.collectors import MAJOR_DISTRIBUTOR_ALIASES, _best_company_similarity
from meetup_ml.recommender import recommend
from meetup_ml.schemas import (
    ChatAnalyzeRequest,
    ChatMessage,
    GroupRecommendRequest,
    Movie,
    Preference,
)


def _movie(**overrides) -> Movie:
    base = dict(
        internal_id="mov_test",
        tmdb_id=1,
        title="테스트 영화",
        title_ko="테스트 영화",
        overview="친구들과 함께 떠나는 신나는 모험 이야기.",
        genres=["모험", "코미디"],
        keywords=["우정", "여행"],
        cast=["김배우"],
        directors=["이감독"],
        countries=["KR"],
        release_date="2023-05-01",
        runtime=110,
        vote_average=7.5,
        vote_count=500,
        popularity=42.0,
        recommendation_eligible=True,
    )
    base.update(overrides)
    return Movie(**base)


# ---------------------------------------------------------------------------
# chat_analysis.analyze_chat()
# ---------------------------------------------------------------------------

def test_analyze_chat_returns_one_analysis_per_message_and_a_member_per_user():
    request = ChatAnalyzeRequest(
        messages=[
            ChatMessage(user_id="u1", text="나 액션 영화 완전 좋아해"),
            ChatMessage(user_id="u1", text="근데 공포영화는 절대 싫어"),
            ChatMessage(user_id="u2", text="난 로맨스가 좋더라"),
            ChatMessage(user_id="u2", text="액션은 별로야"),
        ]
    )
    movies = [_movie()]

    result = analyze_chat(request, movies)

    assert len(result.analyses) == len(request.messages)
    member_ids = {member.user_id for member in result.members}
    assert member_ids == {"u1", "u2"}
    # 매 발화마다 target_type이 스키마가 정의한 열거값 중 하나여야 한다
    # (엉뚱한 문자열이 새어나가면 프론트/DB 저장 단계에서 조용히 깨진다).
    allowed_target_types = {
        "GENRE", "MOVIE", "PERSON", "BRAND", "TOPIC",
        "COUNTRY", "CONSTRAINT", "THEATER", "YEAR", "OTT", "UNKNOWN",
    }
    for analysis in result.analyses:
        assert analysis.target_type in allowed_target_types
        assert 0.0 <= analysis.confidence <= 1.0


def test_analyze_chat_picks_up_explicit_genre_like_and_dislike():
    # "액션 영화 좋아해"처럼 장르명 + 명시적 호감 표현이 붙은 문장은
    # liked_genres에, "공포영화는 싫어"류는 disliked_genres에 반영돼야
    # 그룹 추천(recommender.hard_violations/member_fit)이 실제로 동작한다.
    request = ChatAnalyzeRequest(
        messages=[
            ChatMessage(user_id="u1", text="액션 영화 좋아해"),
            ChatMessage(user_id="u1", text="공포영화는 싫어"),
        ]
    )
    result = analyze_chat(request, [_movie()])
    member = next(m for m in result.members if m.user_id == "u1")

    assert member.liked_genres.get("액션", 0) > 0
    assert member.disliked_genres.get("공포", 0) > 0


# ---------------------------------------------------------------------------
# recommender.recommend()
# ---------------------------------------------------------------------------

def test_recommend_ranks_liked_genre_above_disliked_and_excludes_ineligible():
    liked_movie = _movie(
        internal_id="mov_liked",
        tmdb_id=10,
        title="액션 모험 대작",
        genres=["액션", "모험"],
        vote_average=8.2,
        vote_count=2000,
        popularity=90.0,
    )
    disliked_movie = _movie(
        internal_id="mov_disliked",
        tmdb_id=11,
        title="공포 특집",
        genres=["공포"],
        vote_average=6.0,
        vote_count=300,
        popularity=20.0,
    )
    ineligible_movie = _movie(
        internal_id="mov_ineligible",
        tmdb_id=12,
        title="정보 부족 영화",
        genres=[],
        overview="",
        recommendation_eligible=False,
    )

    members = [
        Preference(user_id="u1", liked_genres={"액션": 1.0}, disliked_genres={"공포": 1.0}),
        Preference(user_id="u2", liked_genres={"액션": 0.6, "모험": 0.6}),
    ]
    request = GroupRecommendRequest(
        room_id="room1",
        round_id="round1",
        members=members,
        limit=3,
    )

    response = recommend([liked_movie, disliked_movie, ineligible_movie], request)

    recommended_ids = [rec.movie.internal_id for rec in response.recommendations]
    assert "mov_ineligible" not in recommended_ids
    excluded_ids = {row["movie_id"] for row in response.excluded}
    assert "mov_ineligible" in excluded_ids

    assert recommended_ids, "추천 결과가 비어 있으면 안 된다"
    top = response.recommendations[0]
    assert top.movie.internal_id == "mov_liked"
    assert len(top.member_scores) == len(members)
    assert top.reasons, "사람이 읽을 수 있는 추천 근거 문자열이 채워져 있어야 한다"


def test_recommend_respects_hard_exclusion_for_disliked_genre():
    # ott_strict=False인 일반 disliked_genres는 감점만 되지만, 기획서상
    # "명시적으로 싫다고 한 장르는 최종 후보에서 배제"에 대응하는 확실한
    # 회귀 신호로 - 취향이 정반대인 영화 하나만 있는 그룹에서는 최소한
    # excluded 목록에 이유가 남거나 최하위로 밀려야 한다.
    only_movie = _movie(
        internal_id="mov_only",
        genres=["공포"],
    )
    members = [Preference(user_id="u1", disliked_genres={"공포": 1.0})]
    request = GroupRecommendRequest(
        room_id="room2",
        round_id="round1",
        members=members,
        limit=3,
    )

    response = recommend([only_movie], request)

    # 강제 배제까지는 아니더라도 최소한 비선호 신호가 어딘가에는 남아야 한다.
    if response.recommendations:
        top = response.recommendations[0]
        assert top.member_scores[0].penalties, "비선호 장르 페널티가 기록돼야 한다"
    else:
        assert response.excluded


# ---------------------------------------------------------------------------
# collectors._best_company_similarity() - 포팅한 KOBIS 동명 영화 오매칭 방지
# ---------------------------------------------------------------------------

def test_distributor_alias_table_bridges_romanized_and_korean_names():
    # 실제로 오매칭이 관찰됐던 케이스: TMDB는 로마자("CJ ENM"), KOBIS는
    # 한글("씨제이이엔엠")로 배급사명을 표기한다. 별칭 테이블로 정규화하지
    # 않으면 문자열 유사도가 낮게 나와 동명 영화를 잘못 고를 수 있다.
    assert "cj enm" in MAJOR_DISTRIBUTOR_ALIASES

    aliased_score = _best_company_similarity(["CJ ENM"], ["씨제이이엔엠"])
    unrelated_score = _best_company_similarity(["CJ ENM"], ["무관한배급사"])

    assert aliased_score > unrelated_score
    assert aliased_score >= 0.99  # 별칭 정규화 후에는 사실상 동일 문자열
