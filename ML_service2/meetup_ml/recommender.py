import math
import re
from datetime import date

from .models import ModelBundle
from .schemas import (
    GroupRecommendRequest,
    MemberScore,
    Movie,
    Recommendation,
    RecommendationEvent,
    RecommendResponse,
)
from .person_identity import canonical_person_name


DEFAULT_WEIGHTS = {
    # 사용자 취향 점수를 최우선으로 사용한다.
    "mean": 0.52,
    "minimum": 0.22,
    "bottom": 0.12,

    # 의미 유사도와 인기·평점은 보조 기준으로만 사용한다.
    "semantic": 0.08,
    "popularity": 0.03,
    "rating": 0.03,
}

PLATFORM_ALIASES = {
    "넷플릭스": {"넷플릭스", "netflix"},
    "티빙": {"티빙", "tving"},
    "웨이브": {"웨이브", "wavve"},
    "디즈니+": {"디즈니+", "디즈니플러스", "disney+", "disney plus"},
    "왓챠": {"왓챠", "watcha"},
    "쿠팡플레이": {"쿠팡플레이", "coupang play"},
    "apple tv+": {"apple tv+", "애플티비", "애플 tv+"},
}


def _normalized_provider_names(movie: Movie) -> set[str]:
    return {
        provider.name.strip().casefold()
        for provider in movie.providers
        if provider.name
    }


def _requested_platform_names(platforms: list[str]) -> set[str]:
    names: set[str] = set()
    for platform in platforms:
        normalized = platform.strip().casefold()
        names.add(normalized)
        for canonical, aliases in PLATFORM_ALIASES.items():
            normalized_aliases = {value.casefold() for value in aliases}
            if normalized == canonical.casefold() or normalized in normalized_aliases:
                names.update(normalized_aliases)
    return names

RERANK_CONFIG = {
    # 이미 뽑힌 영화와 장르가 많이 겹치면 감점
    "diversity_penalty": 0.08,

    # 인기도 상위 후보에 대한 작은 감점
    "popularity_penalty": 0.03,

    # 최근 2년 이내 영화에 작은 노출 보너스
    "recent_boost": 0.025,

    # 명시적으로 사용자가 지목한 영화는 rerank 감점에서 보호
    "direct_movie_bonus": 0.20,
}

BRAND_TERMS = {
    "Marvel": [
        "마블",
        "marvel",
        "어벤져스",
        "아이언맨",
        "캡틴 아메리카",
        "토르",
        "스파이더맨",
        "가디언즈 오브 갤럭시",
        "블랙 팬서",
        "닥터 스트레인지",
        "앤트맨",
        "데드풀",
    ],
    "Disney": [
        "디즈니",
        "disney",
        "미키",
        "겨울왕국",
        "라이온 킹",
        "알라딘",
    ],
    "Pixar": [
        "픽사",
        "pixar",
        "토이 스토리",
        "인사이드 아웃",
        "카",
        "니모",
        "코코",
        "몬스터 주식회사",
    ],
    "Star Wars": [
        "스타워즈",
        "star wars",
        "제다이",
    ],
    "Ghibli": [
        "지브리",
        "ghibli",
        "미야자키 하야오",
    ],
}


def _country_code(value: str) -> str:
    aliases = {
        "한국": "KR",
        "대한민국": "KR",
        "south korea": "KR",
        "korea": "KR",
    }

    clean = value.strip().casefold()

    return aliases.get(
        clean,
        value.strip().upper(),
    )


def _normalize_movie_title(value: str | None) -> str:
    if not value:
        return ""

    return re.sub(
        r"[^0-9a-zA-Z가-힣]",
        "",
        value,
    ).casefold()

def _genre_overlap(
    left: Movie,
    right: Movie,
) -> float:
    """두 영화의 장르 겹침 정도를 0~1로 반환한다."""

    left_genres = {
        genre.strip().casefold()
        for genre in left.genres
        if genre
    }

    right_genres = {
        genre.strip().casefold()
        for genre in right.genres
        if genre
    }

    if not left_genres or not right_genres:
        return 0.0

    union = left_genres | right_genres

    if not union:
        return 0.0

    return len(
        left_genres & right_genres
    ) / len(union)


def _release_year(movie: Movie) -> int | None:
    if not movie.release_date:
        return None

    try:
        return int(movie.release_date[:4])
    except (TypeError, ValueError):
        return None


def rerank_candidates(
    candidates: list[Recommendation],
    limit: int,
    direct_movie_ids: set[str] | None = None,
    config: dict[str, float] | None = None,
) -> list[Recommendation]:
    """추천 적합도를 유지하면서 다양성·인기 편향·신작 노출을 보정한다.

    원래 group_score 값은 변경하지 않고 최종 노출 순서만 조정한다.
    """

    if not candidates or limit <= 0:
        return []

    config = config or RERANK_CONFIG
    direct_movie_ids = direct_movie_ids or set()

    remaining = list(candidates)
    selected: list[Recommendation] = []

    popularities = [
        max(0.0, item.movie.popularity)
        for item in remaining
    ]

    max_popularity = max(
        popularities,
        default=0.0,
    )

    current_year = date.today().year

    while remaining and len(selected) < limit:
        best_item = None
        best_score = float("-inf")

        for item in remaining:
            movie = item.movie
            rerank_score = item.group_score

            # 1. 장르 다양성
            if selected:
                max_overlap = max(
                    _genre_overlap(
                        movie,
                        chosen.movie,
                    )
                    for chosen in selected
                )

                rerank_score -= (
                    config["diversity_penalty"]
                    * max_overlap
                )

            # 2. 인기 편향 완화
            if max_popularity > 0:
                normalized_popularity = (
                    max(0.0, movie.popularity)
                    / max_popularity
                )

                rerank_score -= (
                    config["popularity_penalty"]
                    * normalized_popularity
                )

            # 3. 최근 영화에 제한적인 노출 기회 제공
            release_year = _release_year(movie)

            if (
                release_year is not None
                and current_year - 1
                <= release_year
                <= current_year
            ):
                rerank_score += config["recent_boost"]

            # 4. 사용자가 직접 지목한 영화는 다양성 보정 때문에
            # 뒤로 밀리지 않도록 보호한다.
            if movie.internal_id in direct_movie_ids:
                rerank_score += config[
                    "direct_movie_bonus"
                ]

            if rerank_score > best_score:
                best_score = rerank_score
                best_item = item

        if best_item is None:
            break

        selected.append(best_item)
        remaining.remove(best_item)

    return selected

def hard_violations(
    movie: Movie,
    pref,
) -> list[str]:
    reasons: list[str] = []

    try:
        year = int(
            (movie.release_date or "0")[:4]
            or 0
        )
    except ValueError:
        year = 0

    if (
        pref.max_runtime
        and movie.runtime
        and movie.runtime > pref.max_runtime
    ):
        reasons.append(
            f"{pref.user_id}: 최대 러닝타임 초과"
        )

    if (
        pref.min_runtime
        and movie.runtime
        and movie.runtime < pref.min_runtime
    ):
        reasons.append(
            f"{pref.user_id}: 최소 러닝타임 미달"
        )

    if (
        pref.min_year
        and year
        and year < pref.min_year
    ):
        reasons.append(
            f"{pref.user_id}: 최소 제작연도 미달"
        )

    if (
        pref.max_year
        and year
        and year > pref.max_year
    ):
        reasons.append(
            f"{pref.user_id}: 최대 제작연도 초과"
        )

    if (
        pref.certifications
        and movie.certification
        and movie.certification
        not in pref.certifications
    ):
        reasons.append(
            f"{pref.user_id}: 관람등급 제외"
        )

    if pref.countries:
        allowed_countries = {
            _country_code(value)
            for value in pref.countries
        }

        movie_countries = {
            _country_code(value)
            for value in movie.countries
        }

        if not movie_countries:
            reasons.append(
                f"{pref.user_id}: 제작 국가 정보 없음"
            )

        elif not allowed_countries.intersection(
            movie_countries
        ):
            reasons.append(
                f"{pref.user_id}: 선호 제작 국가와 불일치"
            )

    if pref.excluded_countries:
        excluded_countries = {
            _country_code(value)
            for value in pref.excluded_countries
        }

        movie_countries = {
            _country_code(value)
            for value in movie.countries
        }

        if excluded_countries.intersection(
            movie_countries
        ):
            reasons.append(
                f"{pref.user_id}: 제외 제작 국가"
            )            

    text = " ".join(
        [
            movie.title,
            movie.overview,
            *movie.genres,
            *movie.keywords,
        ]
    ).casefold()

    for phrase in pref.hard_exclusions:
        if phrase.casefold() in text:
            reasons.append(
                f"{pref.user_id}: HARD 제외 '{phrase}'"
            )

    movie_titles = {
        _normalize_movie_title(movie.title),
        _normalize_movie_title(movie.original_title),
        _normalize_movie_title(movie.title_ko),
        _normalize_movie_title(movie.title_en),
    }

    movie_titles.discard("")

    disliked_titles = {
        _normalize_movie_title(value)
        for value in pref.disliked_movies
        if value
    }

    disliked_movie_match = any(
        disliked_title == movie_title
        or (
            len(disliked_title) >= 4
            and disliked_title in movie_title
        )
        or (
            len(movie_title) >= 4
            and movie_title in disliked_title
        )
        for disliked_title in disliked_titles
        for movie_title in movie_titles
    )

    if disliked_movie_match:
        reasons.append(
            f"{pref.user_id}: 비선호 영화와 일치"
        )

    if (
        movie.internal_id in pref.seen_movies
        and movie.internal_id
        not in pref.rewatch_allowed_movies
    ):
        reasons.append(
            f"{pref.user_id}: 이미 본 영화"
        )

    return reasons


def member_fit(
    movie: Movie,
    pref,
    learned_similarity: float | None = None,
) -> MemberScore:
    score = 0.5
    matched: list[str] = []
    penalties: list[str] = []

    genres = {
        genre.strip().casefold()
        for genre in movie.genres
        if genre
    }

    for genre, strength in pref.liked_genres.items():
        normalized_genre = genre.strip().casefold()

        if normalized_genre in genres:
            score += (
                0.18
                * strength
                * pref.confidence
            )

            matched.append(
                f"{genre} 선호"
            )

    for genre, strength in pref.disliked_genres.items():
        normalized_genre = genre.strip().casefold()

        if normalized_genre in genres:
            score -= (
                0.35
                * strength
                * pref.confidence
            )

            penalties.append(
                f"{genre} 비선호"
            )

    text = " ".join(
        [
            movie.overview,
            *movie.keywords,
        ]
    ).casefold()

    brand_text = " ".join(
        [
            movie.title,
            movie.original_title or "",
            movie.overview,
            *movie.keywords,
        ]
    ).casefold()

    for brand, strength in pref.liked_brands.items():
        terms = BRAND_TERMS.get(
            brand,
            [brand],
        )

        if any(
            term.casefold() in brand_text
            for term in terms
        ):
            score += 0.14 * strength

            matched.append(
                f"{brand} 선호"
            )

    for brand, strength in pref.disliked_brands.items():
        terms = BRAND_TERMS.get(
            brand,
            [brand],
        )

        if any(
            term.casefold() in brand_text
            for term in terms
        ):
            score -= 0.20 * strength

            penalties.append(
                f"{brand} 비선호"
            )

    for topic, strength in pref.liked_topics.items():
        if topic.casefold() in text:
            score += 0.12 * strength

            matched.append(
                f"{topic} 소재"
            )

    for topic, strength in pref.disliked_topics.items():
        if topic.casefold() in text:
            score -= 0.20 * strength

            penalties.append(
                f"{topic} 비선호"
            )

    catalog_people = {
        canonical_person_name(name)
        for name in movie.cast + movie.directors
        if name
    }
    liked_people = {
        canonical_person_name(name)
        for name in pref.liked_people
        if name
    }
    disliked_people = {
        canonical_person_name(name)
        for name in pref.disliked_people
        if name
    }

    if liked_people & catalog_people:
        score += 0.38

        matched.append(
            "선호 배우/감독"
        )

    if disliked_people & catalog_people:
        score -= 0.50
        penalties.append(
            "비선호 배우/감독"
        )

    if movie.internal_id in pref.direct_movies:
        score += 0.65

        matched.append(
            "직접 보고 싶다고 한 영화"
        )

    release_year = _release_year(movie)

    # 제한 조건은 위반 시 hard_violations에서 제외되고,
    # 충족했을 때도 명시적인 가점을 준다.
    if pref.max_runtime and movie.runtime and movie.runtime <= pref.max_runtime:
        score += 0.08
        matched.append(f"{pref.max_runtime}분 이하 충족")

    if pref.min_runtime and movie.runtime and movie.runtime >= pref.min_runtime:
        score += 0.08
        matched.append(f"{pref.min_runtime}분 이상 충족")

    if pref.min_year and release_year and release_year >= pref.min_year:
        score += 0.08
        matched.append(f"{pref.min_year}년 이후 조건 충족")

    if pref.max_year and release_year and release_year <= pref.max_year:
        score += 0.08
        matched.append(f"{pref.max_year}년 이전 조건 충족")

    if pref.countries:
        preferred_countries = {
            _country_code(value)
            for value in pref.countries
        }
        movie_countries = {
            _country_code(value)
            for value in movie.countries
        }
        if preferred_countries & movie_countries:
            score += 0.08
            matched.append("선호 제작 국가 충족")

    if pref.ott_platforms:
        requested_names = _requested_platform_names(pref.ott_platforms)
        provider_names = _normalized_provider_names(movie)
        if requested_names & provider_names:
            score += 0.15
            matched.append("선호 OTT에서 시청 가능")
        elif pref.ott_strict:
            score -= 0.45
            penalties.append("필수 OTT 조건 불일치")

    if pref.prefers_theater and movie.is_now_playing:
        score += 0.10
        matched.append("현재 극장 상영 조건 충족")

    
    score += min(
        0.08,
        movie.vote_average / 10 * 0.05
        + math.log1p(movie.vote_count) / 200,
    )

    return MemberScore(
        user_id=pref.user_id,
        score=round(
            max(
                0,
                min(
                    1,
                    score,
                ),
            ),
            4,
        ),
        matched=matched,
        penalties=penalties,
    )


def recommend(
    movies: list[Movie],
    request: GroupRecommendRequest,
    weights: dict | None = None,
    learned_scores: (
        dict[str, list[float]]
        | None
    ) = None,
    reactions: (
        list[RecommendationEvent]
        | None
    ) = None,
) -> RecommendResponse:
    weights = weights or DEFAULT_WEIGHTS

    candidates: list[Recommendation] = []
    excluded: list[dict] = []

    latest_reactions: dict[
        tuple[str, str],
        str,
    ] = {}

    for event in sorted(
        reactions or [],
        key=lambda item: (
            item.occurred_at,
            item.id,
        ),
    ):
        if (
            event.user_id
            and event.movie_id
            and event.event_type
            in {
                "LIKE",
                "DISLIKE",
                "HOLD",
                "SELECT",
            }
        ):
            latest_reactions[
                (
                    event.user_id,
                    event.movie_id,
                )
            ] = event.event_type

    allowed_ids = set(
        request.allowed_providers
    )

    allowed_types = set(
        request.allowed_provider_types
    )

    reroll_exclusions = set(
        request.excluded_movie_ids
    )

    for movie_index, movie in enumerate(
        movies
    ):
        if (
            request.require_now_playing
            and not movie.is_now_playing
        ):
            continue

        if not movie.recommendation_eligible:
            excluded.append(
                {
                    "movie_id": movie.internal_id,
                    "title": movie.title,
                    "reasons": [
                        "추천 학습 정보 부족"
                    ],
                }
            )
            continue

        if (
            movie.internal_id
            in reroll_exclusions
        ):
            continue

        violations = sum(
            (
                hard_violations(
                    movie,
                    preference,
                )
                for preference
                in request.members
            ),
            [],
        )

        if violations:
            excluded.append(
                {
                    "movie_id": movie.internal_id,
                    "title": movie.title,
                    "reasons": violations,
                }
            )
            continue

        providers = [
            provider
            for provider in movie.providers
            if (
                not allowed_ids
                or provider.provider_id
                in allowed_ids
            )
            and (
                not allowed_types
                or provider.type
                in allowed_types
            )
        ]

        if not request.require_now_playing:
            if (
                (allowed_ids or allowed_types)
                and movie.providers
                and not providers
            ):
                excluded.append(
                    {
                        "movie_id":
                            movie.internal_id,
                        "title":
                            movie.title,
                        "reasons": [
                            "허용한 시청 제공처/방식과 불일치"
                        ],
                    }
                )
                continue

            if (
                (allowed_ids or allowed_types)
                and not movie.providers
                and not request
                .include_unknown_watch_path
            ):
                excluded.append(
                    {
                        "movie_id":
                            movie.internal_id,
                        "title":
                            movie.title,
                        "reasons": [
                            "KR 시청 경로 확인 안 됨"
                        ],
                    }
                )
                continue

        scores: list[MemberScore] = []

        for preference in request.members:
            learned_similarity = None

            if (
                learned_scores
                and preference.user_id
                in learned_scores
                and movie_index
                < len(
                    learned_scores[
                        preference.user_id
                    ]
                )
            ):
                learned_similarity = (
                    learned_scores[
                        preference.user_id
                    ][movie_index]
                )

            scores.append(
                member_fit(
                    movie,
                    preference,
                    learned_similarity,
                )
            )

        values = sorted(
            item.score
            for item in scores
        )
        semantic_values = []

        for preference in request.members:
            if (
                learned_scores
                and preference.user_id in learned_scores
                and movie_index < len(learned_scores[preference.user_id])
            ):
                semantic_values.append(
                    learned_scores[preference.user_id][movie_index]
                )

        semantic_mean = (
            sum(semantic_values) / len(semantic_values)
            if semantic_values
            else 0.0
        )

        mean = (
            sum(values)
            / len(values)
        )

        minimum = values[0]

        bottom_count = max(
            1,
            len(values) // 3,
        )

        bottom = (
            sum(
                values[:bottom_count]
            )
            / bottom_count
        )

        quality = min(
            1,
            movie.vote_average / 10,
        )

        popularity = min(
            1,
            math.log1p(
                movie.popularity
            )
            / 8,
        )

        final = (
            weights["mean"] * mean
            + weights["minimum"] * minimum
            + weights["bottom"] * bottom
            + weights["semantic"] * semantic_mean
            + weights["popularity"]
            * popularity
            + weights["rating"]
            * quality
        )

        # 배우·감독 조건이 그룹 평균에서 희석되지 않도록
        # 명시적 인물 일치를 그룹 단계에서도 한 번 반영한다.
        catalog_people = {
            canonical_person_name(name)
            for name in movie.cast + movie.directors
            if name
        }
        positive_person_members = sum(
            bool(
                {
                    canonical_person_name(name)
                    for name in preference.liked_people
                    if name
                }
                & catalog_people
            )
            for preference in request.members
        )
        negative_person_members = sum(
            bool(
                {
                    canonical_person_name(name)
                    for name in preference.disliked_people
                    if name
                }
                & catalog_people
            )
            for preference in request.members
        )

        final += min(0.30, positive_person_members * 0.14)
        final -= min(0.45, negative_person_members * 0.22)

        direct_request_members = sum(
            movie.internal_id in preference.direct_movies
            for preference in request.members
        )
        final += min(0.35, direct_request_members * 0.20)

        # 여러 종류의 명시적 조건을 동시에 만족한 후보에 작은
        # 근거 충족 보너스를 주어 단일 장르만 맞는 영화를 누른다.
        distinct_evidence = {
            reason
            for member_score in scores
            for reason in member_score.matched
        }
        final += min(0.12, len(distinct_evidence) * 0.025)

        reasons = sorted(
            {
                matched_reason
                for member_score in scores
                for matched_reason
                in member_score.matched
            }
        )[:4]

        if movie.is_now_playing:
            reasons.append(
                "현재 영화관에서 상영 중"
            )

        votes = [
            value
            for (
                user_id,
                movie_id,
            ), value
            in latest_reactions.items()
            if movie_id
            == movie.internal_id
        ]

        vote_adjustment = sum(
            {
                "LIKE": 0.08,
                "SELECT": 0.15,
                "DISLIKE": -0.12,
                "HOLD": -0.02,
            }[vote]
            for vote in votes
        )

        final = max(
            0,
            min(
                1,
                final + vote_adjustment,
            ),
        )

        if votes:
            positive = sum(
                vote
                in {
                    "LIKE",
                    "SELECT",
                }
                for vote in votes
            )

            negative = sum(
                vote == "DISLIKE"
                for vote in votes
            )

            reasons.append(
                f"후보 반응 찬성 "
                f"{positive}명·"
                f"반대 {negative}명 반영"
            )

        if not reasons:
            reasons = [
                (
                    f"평점 "
                    f"{movie.vote_average:.1f}점과 "
                    f"인기도를 보조 기준으로 선정"
                )
            ]

            spread = (
                max(values)
                - min(values)
            )

            if (
                len(values) > 1
                and spread <= 0.08
            ):
                reasons.append(
                    (
                        "구성원 적합도 차이가 "
                        f"{round(spread * 100)}점으로 "
                        "고른 후보"
                    )
                )

        evidence_count = sum(
            len(item.matched)
            for item in scores
        )

        if evidence_count >= 3:
            evidence_level = "HIGH"

        elif any(
            item.matched
            for item in scores
        ):
            evidence_level = "MEDIUM"

        else:
            evidence_level = "LOW"

        watch_path_status = (
            "AVAILABLE"
            if (
                providers
                or movie.is_now_playing
            )
            else "UNKNOWN"
        )

        candidates.append(
            Recommendation(
                movie=movie,
                group_score=round(
                    final,
                    4,
                ),
                member_scores=scores,
                reasons=reasons,
                evidence_level=evidence_level,
                watch_path_status=(
                    watch_path_status
                ),
            )
        )

    candidates.sort(
        key=lambda item: (
            item.group_score
        ),
        reverse=True,
    )

    direct_movies = {
        movie_id
        for member in request.members
        for movie_id
        in member.direct_movies
    }

    reranked_candidates = rerank_candidates(
        candidates,
        request.limit,
        direct_movie_ids=direct_movies,
    )

    has_conflict = any(
        movie_id in direct_movies
        and vote == "DISLIKE"
        for (
            user_id,
            movie_id,
        ), vote
        in latest_reactions.items()
    )

    consensus_threshold = max(
        2,
        math.ceil(
            len(request.members) / 2
        ),
    )

    has_consensus = any(
        movie_id in direct_movies
        and sum(
            value
            in {
                "LIKE",
                "SELECT",
            }
            for (
                user_id,
                target,
            ), value
            in latest_reactions.items()
            if target == movie_id
        )
        >= consensus_threshold
        and not any(
            value == "DISLIKE"
            for (
                user_id,
                target,
            ), value
            in latest_reactions.items()
            if target == movie_id
        )
        for movie_id in direct_movies
    )

    if has_consensus:
        mode = "CONSENSUS"

    elif (
        direct_movies
        and (
            has_conflict
            or len(direct_movies) > 1
        )
    ):
        mode = "CONFLICT_DISCOVERY"

    elif (
        reranked_candidates
        and reranked_candidates[0].evidence_level
        == "LOW"
        and not latest_reactions
    ):
        mode = "LOW_EVIDENCE"

    else:
        mode = "PREFERENCE_DISCOVERY"

    return RecommendResponse(
        room_id=request.room_id,
        round_id=request.round_id,
        mode=mode,
        recommendations=(
            reranked_candidates
        ),
        excluded=excluded,
        model_version=ModelBundle.version,
        data_version=(
            f"movies-{len(movies)}"
        ),
    )
