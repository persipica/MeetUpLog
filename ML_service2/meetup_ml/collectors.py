import asyncio
import hashlib
from datetime import datetime, timezone
from difflib import SequenceMatcher
import httpx
from .config import settings
from .schemas import Movie, Provider
from .storage import JsonStore


class ApiClient:
    def __init__(self, client: httpx.AsyncClient, interval: float | None = None):
        self.client = client
        self.interval = settings.meetup_request_interval_seconds if interval is None else interval

    async def get(self, url: str, **kwargs) -> dict:
        error = None
        for attempt in range(settings.meetup_max_retries):
            try:
                response = await self.client.get(url, timeout=20, **kwargs)
                response.raise_for_status()
                if self.interval:
                    await asyncio.sleep(self.interval)
                return response.json()
            except (httpx.HTTPError, ValueError) as exc:
                error = exc
                await asyncio.sleep(2 ** attempt * 0.2)
        raise RuntimeError(f"외부 API 요청이 {settings.meetup_max_retries}회 실패했습니다: {type(error).__name__}") from error


def _internal_id(tmdb_id: int | None, kobis_code: str | None, title: str) -> str:
    source = f"{tmdb_id or ''}|{kobis_code or ''}|{title}"
    return "mov_" + hashlib.sha1(source.encode()).hexdigest()[:12]


def _completeness(movie: Movie) -> int:
    return min(100, (30 if movie.genres else 0) + (30 if (movie.overview_ko or movie.overview_en or movie.overview) else 0)
               + (15 if movie.directors else 0) + (15 if movie.cast else 0) + (10 if movie.keywords else 0))


def normalize_tmdb(detail: dict, english_detail: dict | None = None) -> Movie:
    english_detail = english_detail or {}
    credits = detail.get("credits", {})
    kr = detail.get("watch/providers", {}).get("results", {}).get("KR", {})
    providers = []
    for kind in ("flatrate", "free", "ads", "rent", "buy"):
        for row in kr.get(kind, []):
            providers.append(Provider(provider_id=row["provider_id"], name=row["provider_name"], logo_path=row.get("logo_path"), type=kind))
    directors = [p["name"] for p in credits.get("crew", []) if p.get("job") == "Director"]
    keywords = detail.get("keywords", {}).get("keywords", detail.get("keywords", {}).get("results", []))
    movie = Movie(
        internal_id=_internal_id(detail.get("id"), None, detail.get("title", "")), tmdb_id=detail.get("id"),
        title=detail.get("title") or english_detail.get("title") or detail.get("original_title") or "제목 없음",
        title_ko=detail.get("title"), title_en=english_detail.get("title"), original_title=detail.get("original_title"),
        overview=detail.get("overview") or english_detail.get("overview") or "",
        overview_ko=detail.get("overview") or "", overview_en=english_detail.get("overview") or "",
        genres=[g["name"] for g in detail.get("genres", [])],
        keywords=[k["name"] for k in keywords], cast=[p["name"] for p in credits.get("cast", [])[:10]], directors=directors,
        countries=[c["iso_3166_1"] for c in detail.get("production_countries", [])], language=detail.get("original_language"),
        release_date=detail.get("release_date"), runtime=detail.get("runtime"), vote_average=detail.get("vote_average", 0),
        vote_count=detail.get("vote_count", 0), popularity=detail.get("popularity", 0), poster_path=detail.get("poster_path"),
        providers=providers, provider_link=kr.get("link"),
        recommendations=[m["id"] for m in detail.get("recommendations", {}).get("results", [])],
        similar=[m["id"] for m in detail.get("similar", {}).get("results", [])],
        data_sources=["TMDB"],
    )
    movie.completeness_score = _completeness(movie)
    movie.recommendation_eligible = movie.completeness_score >= 60 and bool(movie.genres) and bool(movie.overview)
    return movie

async def search_tmdb_movie(title: str) -> Movie | None:
    credential = settings.require_tmdb()

    is_v4_token = (
        credential.startswith("eyJ")
        or len(credential) > 80
    )

    headers = {
        "accept": "application/json",
    }

    auth_params = {}

    if is_v4_token:
        headers["Authorization"] = f"Bearer {credential}"
    else:
        auth_params["api_key"] = credential

    async with httpx.AsyncClient(
        base_url=settings.tmdb_base_url,
        headers=headers,
    ) as http:
        api = ApiClient(http)

        search = await api.get(
            "/search/movie",
            params={
                **auth_params,
                "query": title,
                "language": "ko-KR",
                "region": "KR",
            },
        )

        results = search.get("results", [])

        if not results:
            return None

        tmdb_id = results[0]["id"]

        detail = await api.get(
            f"/movie/{tmdb_id}",
            params={
                **auth_params,
                "language": "ko-KR",
                "append_to_response": (
                    "credits,keywords,recommendations,"
                    "similar,watch/providers"
                ),
            },
        )

        english = await api.get(
            f"/movie/{tmdb_id}",
            params={
                **auth_params,
                "language": "en-US",
            },
        )

        return normalize_tmdb(
            detail,
            english,
        )

def search_tmdb_movie_sync(title: str) -> Movie | None:
    credential = settings.require_tmdb()

    is_v4_token = (
        credential.startswith("eyJ")
        or len(credential) > 80
    )

    headers = {
        "accept": "application/json",
    }

    params = {}

    if is_v4_token:
        headers["Authorization"] = f"Bearer {credential}"
    else:
        params["api_key"] = credential

    with httpx.Client(
        base_url=settings.tmdb_base_url,
        headers=headers,
        timeout=20,
    ) as http:
        search_response = http.get(
            "/search/movie",
            params={
                **params,
                "query": title,
                "language": "ko-KR",
                "region": "KR",
            },
        )
        search_response.raise_for_status()
        results = search_response.json().get("results", [])

        if not results:
            return None

        tmdb_id = results[0]["id"]

        detail_response = http.get(
            f"/movie/{tmdb_id}",
            params={
                **params,
                "language": "ko-KR",
                "append_to_response": (
                    "credits,keywords,recommendations,"
                    "similar,watch/providers"
                ),
            },
        )
        detail_response.raise_for_status()

        english_response = http.get(
            f"/movie/{tmdb_id}",
            params={
                **params,
                "language": "en-US",
            },
        )
        english_response.raise_for_status()

        return normalize_tmdb(
            detail_response.json(),
            english_response.json(),
        )

async def collect_tmdb(store: JsonStore, pages: int = 1, incremental: bool = False, with_english: bool = False) -> list[Movie]:
    credential = settings.require_tmdb()
    # TMDB v4 Read Access Token is a long JWT-like token. The legacy v3 API
    # key is a short hexadecimal value and must be sent as the api_key query.
    is_v4_token = credential.startswith("eyJ") or len(credential) > 80
    headers = {"accept": "application/json"}
    auth_params = {}
    if is_v4_token:
        headers["Authorization"] = f"Bearer {credential}"
    else:
        auth_params["api_key"] = credential
    state_file = store.state / "tmdb.json"
    start = 1
    if incremental and state_file.exists():
        import json
        start = json.loads(state_file.read_text(encoding="utf-8")).get("last_page", 0) + 1
    movies = []
    async with httpx.AsyncClient(base_url=settings.tmdb_base_url, headers=headers) as http:
        api = ApiClient(http)
        for page in range(start, start + pages):
            listing = await api.get("/discover/movie", params={**auth_params, "language": "ko-KR", "region": "KR", "page": page, "sort_by": "popularity.desc"})
            store.append_jsonl(store.raw / "tmdb" / "discover.jsonl", listing)
            for row in listing.get("results", []):
                detail = await api.get(f"/movie/{row['id']}", params={**auth_params, "language": "ko-KR", "append_to_response": "credits,keywords,recommendations,similar,watch/providers"})
                store.append_jsonl(store.raw / "tmdb" / "details.jsonl", detail)
                english = await api.get(f"/movie/{row['id']}", params={**auth_params, "language": "en-US"}) if with_english else None
                if english:
                    store.append_jsonl(store.raw / "tmdb" / "details_en.jsonl", english)
                movies.append(normalize_tmdb(detail, english))
            state_file.write_text(__import__("json").dumps({"last_page": page, "collected_at": datetime.now(timezone.utc).isoformat()}), encoding="utf-8")
    existing = store.load_movies(use_fixture=False) if incremental else []
    by_id = {(m.tmdb_id or m.internal_id): m for m in existing}
    by_id.update({(m.tmdb_id or m.internal_id): m for m in movies})
    merged = list(by_id.values())
    store.save_movies(merged)
    return movies


# 로마자(TMDB 표기, 소문자 키) -> 한글(KOBIS 표기) 별칭. movie_catalog.py의
# KoficClient에서 그대로 포팅 - "CJ ENM"(TMDB)과 "씨제이이엔엠"(KOBIS) 같은
# 표기 차이는 문자열 유사도만으로는 절대 잡히지 않아서 실제로 오매칭이
# 관찰된 뒤에 만든 테이블이다. 메이저 배급사 위주라 완전하지 않으니,
# 자주 틀리는 조합을 새로 발견하면 이 표에 추가할 것.
MAJOR_DISTRIBUTOR_ALIASES: dict[str, str] = {
    "cj enm": "씨제이이엔엠",
    "cj entertainment": "씨제이이엔엠",
    "lotte entertainment": "롯데엔터테인먼트",
    "showbox": "쇼박스",
    "new": "뉴",
    "megabox joongang plus m": "메가박스중앙",
    "megabox": "메가박스중앙",
    "warner bros. korea": "워너브러더스코리아",
    "walt disney company korea": "월트디즈니컴퍼니코리아",
    "sony pictures releasing korea": "소니픽쳐스릴리징월트디즈니컴퍼니코리아",
    "universal pictures international korea": "유니버설픽쳐스인터내셔널코리아",
    "twentieth century fox korea": "이십세기폭스코리아",
    "watcha": "왓챠",
    "little big pictures": "리틀빅픽처스",
    "acemaker movieworks": "에이스메이커무비웍스",
    "next entertainment world": "넥스트엔터테인먼트월드",
    "plus m entertainment": "플러스엠엔터테인먼트",
    "megabox plus m": "메가박스중앙플러스엠",
    "indiestory": "인디스토리",
    "finecut": "화인컷",
    "barunson e&a": "바른손이앤에이",
    "bom film productions": "봄필름",
    "myung films": "명필름",
    "zip cinema": "집시네마",
    "cinema dal": "시네마달",
}


def _best_company_similarity(tmdb_companies: list[str], kobis_companies: list[str]) -> float:
    """TMDB 제작/배급사명과 KOBIS 배급사명 목록 중 가장 비슷한 쌍의 유사도.
    MAJOR_DISTRIBUTOR_ALIASES로 먼저 정규화한 뒤 비교하고, 표에 없는 회사는
    문자열 유사도로 느슨하게 비교한다."""
    if not tmdb_companies or not kobis_companies:
        return 0.0

    def normalize(name: str) -> str:
        key = name.strip().lower()
        return MAJOR_DISTRIBUTOR_ALIASES.get(key, name).lower()

    best = 0.0
    for a in tmdb_companies:
        for b in kobis_companies:
            score = SequenceMatcher(None, normalize(a), normalize(b)).ratio()
            best = max(best, score)
    return best


async def _kobis_search_list(api: ApiClient, key: str, title: str, store: JsonStore) -> list[dict]:
    result = await api.get(
        "/movie/searchMovieList.json",
        params={"key": key, "movieNm": title, "itemPerPage": 10},
    )
    store.append_jsonl(store.raw / "kobis" / "lists.jsonl", result)
    return result.get("movieListResult", {}).get("movieList", [])


async def _kobis_fetch_info(api: ApiClient, key: str, movie_cd: str, store: JsonStore) -> dict:
    try:
        detail = await api.get(
            "/movie/searchMovieInfo.json",
            params={"key": key, "movieCd": movie_cd},
        )
    except RuntimeError:
        # 상세조회 실패는 후보 하나를 못 쓰는 것뿐이니 전체 배치를 막지 않는다.
        return {}
    store.append_jsonl(store.raw / "kobis" / "details.jsonl", detail)
    return detail.get("movieInfoResult", {}).get("movieInfo", {})


async def _find_kobis_match(
    api: ApiClient,
    key: str,
    store: JsonStore,
    title: str,
    release_year: int | None,
    production_companies: list[str] | None,
) -> tuple[str | None, bool]:
    """제목(+가능하면 개봉연도/배급사)으로 KOBIS movieCd를 찾는다.

    movie_catalog.KoficClient.find_movie_code()와 동일한 순서로 후보를
    좁힌다 - 동명 영화(리메이크, 같은 제목의 다른 작품 등)가 있을 때
    "제목이 정확히 같은 첫 결과"만 쓰면 엉뚱한 movieCd가 뽑혀 관람등급이
    잘못 붙을 수 있기 때문이다.

      1) 제목이 정확히 일치하는 후보만 남긴다.
      2) 후보가 여럿이면 release_year와 KOBIS의 prdtYear(제작연도)가
         일치(또는 국내 개봉이 제작연도 다음해인 경우가 흔하므로 ±1년
         이내)하는 후보를 우선한다.
      3) 그래도 여러 개면(동일 제목·동일 연도) production_companies가
         있을 때만 KOBIS 상세조회로 배급사명을 비교해 가장 비슷한 후보를
         고른다 - 후보 수만큼 API 호출이 추가로 필요해서 정보가 없으면
         건너뛴다.
      4) 그래도 못 좁히면 첫 번째 후보를 쓰되, 반환값의 두 번째 항목을
         True로 표시해 호출부가 오매칭 가능성을 알 수 있게 한다.
    """
    candidates = await _kobis_search_list(api, key, title, store)
    if not candidates:
        return None, False

    exact = [m for m in candidates if m.get("movieNm") == title]
    pool = exact or candidates
    if len(pool) == 1:
        return pool[0].get("movieCd"), False

    if release_year is not None:
        year_matched = [
            m for m in pool
            if m.get("prdtYear") and abs(int(m["prdtYear"]) - release_year) <= 1
        ]
        if len(year_matched) == 1:
            return year_matched[0].get("movieCd"), False
        if year_matched:
            pool = year_matched  # 여전히 여럿이면 다음 단계(배급사)로 좁혀본다

    if production_companies and len(pool) > 1:
        best_code, best_score = None, 0.0
        for m in pool:
            code = m.get("movieCd")
            if not code:
                continue
            info = await _kobis_fetch_info(api, key, code, store)
            companies = [c.get("companyNm", "") for c in info.get("companys", [])]
            score = _best_company_similarity(production_companies, companies)
            if score > best_score:
                best_code, best_score = code, score
        if best_code and best_score >= 0.6:
            return best_code, False

    # 못 좁혔으면 첫 후보로 폴백 (오매칭 가능성 있음 - low_confidence=True로 알린다)
    return pool[0].get("movieCd"), True


async def enrich_certifications(store: JsonStore, movies: list[Movie] | None = None) -> list[Movie]:
    """기존에 수집된 영화(보통 TMDB 결과)에 KOBIS 관람등급을 병합한다.

    포팅 전 collect_kobis()는 KOBIS 목록/상세를 raw jsonl로 덤프만 하고
    movies.json에는 전혀 반영하지 않았다 - 그 결과 Movie.certification이
    항상 None으로 남아, recommender.py의 certifications 선호 필터(hard
    exclusion)가 조용히 아무 효과도 없는 상태였다. 이 함수가 그 실제
    병합을 수행하고, 동명 영화 오매칭은 _find_kobis_match()로 방지한다.
    """
    key = settings.require_kobis()
    target_movies = movies if movies is not None else store.load_movies(use_fixture=False)
    low_confidence: list[str] = []
    async with httpx.AsyncClient(base_url=settings.kobis_base_url) as http:
        api = ApiClient(http)
        for movie in target_movies:
            title = movie.title_ko or movie.title
            if not title:
                continue
            release_year = None
            if movie.release_date:
                try:
                    release_year = int(movie.release_date[:4])
                except ValueError:
                    release_year = None
            try:
                code, is_low_confidence = await _find_kobis_match(
                    api, key, store, title, release_year,
                    movie.production_companies or None,
                )
            except RuntimeError:
                # KOBIS 요청이 재시도 끝에 실패해도 나머지 영화 처리는 계속한다.
                continue
            if not code:
                continue
            info = await _kobis_fetch_info(api, key, code, store)
            audits = info.get("audits", [])
            certification = audits[0].get("watchGradeNm") if audits else None
            if certification:
                movie.certification = certification
                movie.kobis_code = code
                if "KOBIS" not in movie.data_sources:
                    movie.data_sources.append("KOBIS")
                if is_low_confidence:
                    low_confidence.append(movie.internal_id)
    if low_confidence:
        store.append_jsonl(
            store.state / "kobis_low_confidence_matches.jsonl",
            {
                "movie_ids": low_confidence,
                "collected_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    store.save_movies(target_movies)
    return target_movies


async def collect_kobis(store: JsonStore, pages: int = 1) -> list[Movie]:
    """KOBIS 관람등급을 store에 이미 저장된 영화들과 동명 영화 오매칭 없이 병합한다.

    `pages`는 /v1/collections의 collect_tmdb 호출부와 시그니처를 맞추기
    위해 남아 있지만 더는 쓰이지 않는다 - KOBIS 자체 목록을 curPage로
    맹목적으로 페이징하며 통째로 긁어오던 예전 방식은 TMDB 카탈로그와
    전혀 연결되지 않아 certification이 채워지지 않는 원인이었다. 대신
    이미 수집된 각 영화의 제목으로 검색해서 매칭하는 편이 API 호출도
    훨씬 적게 들고, _find_kobis_match()의 연도/배급사 단계 덕에 훨씬
    정확하다.
    """
    del pages  # 호출부 시그니처 호환용 - collect_tmdb와 달리 페이징하지 않는다.
    return await enrich_certifications(store)
