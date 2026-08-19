"""
외부 API 키 없이 모의 데이터로 analyze_message -> recommend 흐름을 확인한다.

    python demo.py
"""

from datetime import timedelta

from ML_service.models import MovieCandidate
from ML_service.nlp_pipeline import analyze_message
from ML_service.preference_eav import eav_rows_to_user_states, PreferenceRow
from ML_service.recommendation_engine import recommend
from ML_service.time_utils import utc_now


def scenario_analyze_message():
    print("=== 1) 메시지 분석 (무상태) ===")
    now = utc_now()
    result = analyze_message("액션 영화 완전 좋아하는데 공포는 별로야", timestamp=now)
    print("relevant:", result.relevant_flag, "score:", round(result.relevance_score, 2))
    print("entities:", result.entities_json)
    print("deltas:", result.preference_deltas)
    print()
    return result


def scenario_focus_reference():
    print("=== 2) Focus 문맥 해석 (\"그거\"/\"나도\") ===")
    now = utc_now()
    first = analyze_message("잔잔한 드라마 어때", timestamp=now)
    second = analyze_message("나도", timestamp=now + timedelta(seconds=5), prior_focus=first.focus_json)
    print("첫 메시지 focus:", first.focus_json)
    print("\"나도\" 메시지 entities:", second.entities_json)
    print()


def scenario_recommend():
    print("=== 3) 추천 (모의 카탈로그) ===")
    candidates = [
        MovieCandidate(
            movie_id="1", title="더 배틀", original_title="The Battle",
            genres=["액션"], overview="치열한 전투가 벌어진다", popularity=80.0,
            vote_average=7.5, runtime=120, adult=False, poster_path=None, release_date="2024-01-01",
        ),
        MovieCandidate(
            movie_id="2", title="유령의 밤", original_title="Night of Ghosts",
            genres=["공포"], overview="어두운 저택에서 벌어지는 공포", popularity=40.0,
            vote_average=6.0, runtime=95, adult=False, poster_path=None, release_date="2024-02-01",
        ),
    ]
    rows = [
        PreferenceRow(user_id="u1", target_type="GENRE", target_value="액션", polarity="LIKE", strength=0.9),
        PreferenceRow(user_id="u1", target_type="GENRE", target_value="공포", polarity="DISLIKE", strength=0.8),
        PreferenceRow(user_id="u2", target_type="GENRE", target_value="액션", polarity="LIKE", strength=0.6),
    ]
    users = list(eav_rows_to_user_states(rows).values())
    result = recommend(room_id="room1", round_id="round1", candidates=candidates, users=users)
    print("mode:", result.mode.value)
    for sm in result.top_k:
        print(f"  {sm.movie.title}: {round(sm.final_score, 3)} ({sm.explanation.evidence_level})")
    print()


if __name__ == "__main__":
    scenario_analyze_message()
    scenario_focus_reference()
    scenario_recommend()
