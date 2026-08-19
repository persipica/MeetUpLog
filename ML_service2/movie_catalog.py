"""
MeetupLog AI Service - 영화 카탈로그
==================================
TMDB에서 영화 메타데이터(장르, 줄거리, 평점, 인기도, 상영시간)를 가져오고,
KOFIC(KOBIS)에서 국내 관람등급을 보강한다.

기획서 9장 "영화 DB와 장르·분위기 벡터는 서버 시작 또는 데이터 갱신 시
미리 계산한다" 원칙에 따라, 이 모듈은 배치/서버-기동 시 1회 실행되어
MovieCatalog 캐시를 구성하는 용도로 설계했다.
"""

from __future__ import annotations

import time
from difflib import SequenceMatcher
from typing import Dict, List, Optional

import requests

import config
from config import KOFIC_BASE_URL, TMDB_BASE_URL, TMDB_LANGUAGE, TMDB_REGION, require_key
from models import MovieCandidate

# ---------------------------------------------------------------------------
# TMDB 공식 장르 taxonomy (movie, ko-KR) - /genre/movie/list 응답을 그대로 옮긴 참조값
# ---------------------------------------------------------------------------
# TMDB가 실제로 제공하는 19개 영화 장르. GENRE_KEYWORDS(nlp_pipeline.py)의
# 카테고리 이름은 여기 있는 이름과 최대한 일치시켜야 movie.genres(TMDB 원본)와
# user.genres(채팅에서 추출한 선호)가 문자열로 정확히 매칭된다.
# 참고: 코퍼스 마이닝으로 추가했던 "재난"/"무협" 등은 이 목록에 없는
# TMDB 비공식 카테고리라 장르로는 절대 매칭되지 않는다 - 대신 아래
# KEYWORD_TAG_ALIASES로 TMDB "키워드"(움직씨: 재난, 무협 같은 세부 태그) API를
# 통해 보강한다.
TMDB_GENRE_NAMES_KO = frozenset({
    "액션", "모험", "애니메이션", "코미디", "범죄", "다큐멘터리", "드라마",
    "가족", "판타지", "역사", "공포", "음악", "미스터리", "로맨스", "SF",
    "TV 영화", "스릴러", "전쟁", "서부",
})


def is_tmdb_native_genre(name: str) -> bool:
    """이 이름이 TMDB 공식 장르 목록에 있는지 - GENRE_KEYWORDS 카테고리를
    새로 추가할 때 이 함수로 미리 확인하면 taxonomy 불일치를 예방할 수 있다."""
    return name in TMDB_GENRE_NAMES_KO


# ---------------------------------------------------------------------------
# TMDB 키워드(movie/{id}/keywords) -> 장르 아닌 세부 태그 보강
# ---------------------------------------------------------------------------
# "재난", "무협", "히어로" 같은 카테고리는 TMDB 장르 목록에 없어서 movie.genres로는
# 절대 못 잡는다. 대신 TMDB가 영화별로 붙여두는 영어 키워드(append_to_response=
# keywords로 조회 가능)를 우리 쪽 한글 태그로 정규화해 movie.genres에 "얹어서"
# 넣는다 - recommendation_engine 쪽은 movie.genres만 보면 되므로 수정이
# 필요 없다(태그 보강은 movie_catalog.py 안에서 전부 끝난다).
#
# ⚠️ TMDB 키워드 API는 언어 파라미터를 지원하지 않아 항상 영어로 온다.
# 이 표는 자주 쓰이는 키워드 위주라 완전하지 않으니, 매칭이 안 되는
# 케이스를 발견하면 추가할 것.
KEYWORD_TAG_ALIASES: Dict[str, str] = {
    "disaster": "재난",
    "disaster film": "재난",
    "natural disaster": "재난",
    "survival": "재난",
    "epidemic": "재난",
    "pandemic": "재난",
    "shipwreck": "재난",
    "earthquake": "재난",
    "tsunami": "재난",
    "volcano": "재난",
    "plane crash": "재난",
    "nuclear war": "재난",
    "martial arts": "무협",
    "kung fu": "무협",
    "wuxia": "무협",
    "sword fighting": "무협",
    "swordsman": "무협",
    "samurai": "무협",
    "sword and sorcery": "무협",
    "martial arts tournament": "무협",
    "superhero": "히어로",
    "based on comic": "히어로",
    "marvel comic": "히어로",
    "dc comics": "히어로",
    "superhero team": "히어로",
    "supervillain": "히어로",
    "vigilante": "히어로",
    "anti hero": "히어로",
}

# ---------------------------------------------------------------------------
# 무드(분위기) 사전
# ---------------------------------------------------------------------------
# TMDB는 "가벼운/잔잔한/무서운" 같은 무드 태그를 직접 제공하지 않으므로,
# 장르 조합 + 줄거리 키워드로 근사 태깅한다. (기획서 09장 "장르·분위기 벡터")
GENRE_TO_MOOD = {
    "코미디": ["가벼운"],
    "가족": ["가벼운", "잔잔한"],
    "애니메이션": ["가벼운"],
    "로맨스": ["잔잔한"],
    "드라마": ["잔잔한"],
    "공포": ["무서운"],
    "스릴러": ["긴장감있는", "무서운"],
    "범죄": ["긴장감있는"],
    "액션": ["박진감있는"],
    "SF": ["박진감있는"],
    "다큐멘터리": ["잔잔한"],
    "재난": ["긴장감있는", "박진감있는"],
    "무협": ["박진감있는"],
    "히어로": ["박진감있는"],
}

MOOD_KEYWORDS = {
    "가벼운": ["유쾌", "코믹", "웃음", "경쾌", "코미디"],
    "잔잔한": ["잔잔", "감동", "치유", "일상", "따뜻"],
    "무서운": ["공포", "오싹", "소름", "괴담", "귀신"],
    "긴장감있는": ["스릴", "긴장", "추격", "반전"],
    "박진감있는": ["액션", "폭발", "전투", "질주"],
}


def derive_moods(genres: List[str], overview: str) -> List[str]:
    """장르 매핑 + 줄거리 키워드 매칭으로 무드 태그 목록을 만든다."""
    moods = set()
    for g in genres:
        for m in GENRE_TO_MOOD.get(g, []):
            moods.add(m)
    for mood, keywords in MOOD_KEYWORDS.items():
        if any(kw in overview for kw in keywords):
            moods.add(mood)
    return sorted(moods)


# ---------------------------------------------------------------------------
# TMDB 연동
# ---------------------------------------------------------------------------

class TMDBClient:
    def __init__(self, api_key: Optional[str] = None, session: Optional[requests.Session] = None):
        # 기본값을 함수 시그니처에 직접 박아두면 import 시점에 config가 평가돼
        # .env 로드 순서에 취약해진다. None으로 받고 실제 호출 직전에
        # require_key()로 지연 검증한다 (키 없이도 이 클래스 자체는 생성 가능).
        self.api_key = api_key or config.TMDB_API_KEY
        self.session = session or requests.Session()
        self._genre_map: Optional[Dict[int, str]] = None

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        params = dict(params or {})
        params.update({
            "api_key": require_key("TMDB_API_KEY", self.api_key),
            "language": TMDB_LANGUAGE,
            "region": TMDB_REGION,
        })
        resp = self.session.get(f"{TMDB_BASE_URL}{path}", params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def genre_map(self) -> Dict[int, str]:
        """genre_id -> 한글 장르명"""
        if self._genre_map is None:
            data = self._get("/genre/movie/list")
            self._genre_map = {g["id"]: g["name"] for g in data.get("genres", [])}
        return self._genre_map

    def fetch_popular(self, pages: int = 3) -> List[MovieCandidate]:
        """초기 카탈로그 구성용. 인기 영화 N페이지(페이지당 20편) 수집."""
        genre_map = self.genre_map()
        results: List[MovieCandidate] = []
        for page in range(1, pages + 1):
            data = self._get("/movie/popular", {"page": page})
            for item in data.get("results", []):
                results.append(self._to_candidate(item, genre_map))
            time.sleep(0.1)  # 레이트리밋 여유
        return results

    def fetch_detail(self, movie_id: str) -> MovieCandidate:
        """상영시간(runtime) 등 상세 정보가 필요할 때 개별 조회.
        KOFIC 등급 매칭용 production_companies와, 장르 taxonomy에 없는
        재난/무협/히어로 등을 채우는 TMDB 키워드도 이 엔드포인트에서만
        얻을 수 있다(목록/검색 API에는 없음) - append_to_response=keywords."""
        genre_map = self.genre_map()
        data = self._get(f"/movie/{movie_id}", {"append_to_response": "keywords"})
        item = {
            **data,
            "genre_ids": [g["id"] for g in data.get("genres", [])],
        }
        keyword_names = [
            k.get("name", "") for k in data.get("keywords", {}).get("keywords", [])
        ]
        return self._to_candidate(item, genre_map, runtime=data.get("runtime"), keywords=keyword_names)

    def search(self, title: str) -> List[MovieCandidate]:
        """채팅 속 영화 제목 인식(FR-AI-04)에서 후보 매칭용."""
        genre_map = self.genre_map()
        data = self._get("/search/movie", {"query": title})
        return [self._to_candidate(item, genre_map) for item in data.get("results", [])]

    def _to_candidate(
        self,
        item: dict,
        genre_map: Dict[int, str],
        runtime: Optional[int] = None,
        keywords: Optional[List[str]] = None,
    ) -> MovieCandidate:
        genre_names = [genre_map.get(gid, "") for gid in item.get("genre_ids", [])]
        genre_names = [g for g in genre_names if g]

        # TMDB 장르 taxonomy에 없는 세부 태그(재난/무협/히어로 등)를
        # 키워드에서 찾아 genre_names에 "얹는다" - recommendation_engine은
        # movie.genres만 보므로 이 한 곳만 고치면 하위 로직 변경이 필요 없다.
        for kw in (keywords or []):
            tag = KEYWORD_TAG_ALIASES.get(kw.strip().lower())
            if tag and tag not in genre_names:
                genre_names.append(tag)

        overview = item.get("overview", "") or ""

        release_date = item.get("release_date") or ""
        release_year = None
        if len(release_date) >= 4 and release_date[:4].isdigit():
            release_year = int(release_date[:4])

        production_companies = [
            c["name"] for c in item.get("production_companies", []) if c.get("name")
        ]

        return MovieCandidate(
            movie_id=str(item["id"]),
            title=item.get("title") or item.get("original_title", ""),
            overview=overview,
            genres=genre_names,
            moods=derive_moods(genre_names, overview),
            runtime=runtime,
            popularity=float(item.get("popularity", 0.0)),
            vote_average=float(item.get("vote_average", 0.0)),
            is_adult=bool(item.get("adult", False)),
            poster_path=item.get("poster_path"),
            release_year=release_year,
            production_companies=production_companies,
        )


# ---------------------------------------------------------------------------
# KOFIC(KOBIS) 연동 - 국내 관람등급 보강
# ---------------------------------------------------------------------------

class KoficClient:
    def __init__(self, api_key: Optional[str] = None, session: Optional[requests.Session] = None):
        self.api_key = api_key or config.KOFIC_API_KEY
        self.session = session or requests.Session()

    def search_movie_list(self, title: str, item_per_page: int = 10) -> List[dict]:
        """제목으로 KOFIC 후보 목록 조회. searchMovieList.json 사용.
        반환되는 각 dict에는 movieCd, movieNm, prdtYear 등이 들어있다."""
        params = {
            "key": require_key("KOFIC_API_KEY", self.api_key),
            "movieNm": title,
            "itemPerPage": item_per_page,
        }
        resp = self.session.get(
            f"{KOFIC_BASE_URL}/movie/searchMovieList.json", params=params, timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("movieListResult", {}).get("movieList", [])

    def find_movie_code(
        self,
        title: str,
        release_year: Optional[int] = None,
        production_companies: Optional[List[str]] = None,
    ) -> Optional[str]:
        """제목(+가능하면 개봉연도/배급사)으로 KOFIC movieCd를 찾는다.

        기존에는 "제목이 정확히 같은 첫 결과"만 썼는데, 동명 영화(리메이크,
        같은 제목의 다른 작품 등)가 있으면 엉뚱한 movieCd가 뽑혀 관람등급이
        잘못 붙을 수 있었다. 이제는 다음 순서로 후보를 좁힌다:

          1) 제목이 정확히 일치하는 후보만 남긴다.
          2) 후보가 여럿이면 release_year와 KOFIC의 prdtYear(제작연도)가
             일치(또는 ±1년 이내, 국내 개봉이 제작연도 다음해인 경우가 흔함)
             하는 후보를 우선한다.
          3) 그래도 여러 개면(동일 제목·동일 연도) production_companies를
             넘겨받았을 때만 KOFIC 상세조회로 배급사명을 비교해 가장 비슷한
             후보를 고른다 — 이 단계는 API 호출이 후보 수만큼 추가로
             필요해서, 정보가 없으면 건너뛴다.
          4) 그래도 못 좁히면 첫 번째 후보를 쓰되, 이 경우
             `AgeRatingMatch.confidence`를 "LOW"로 표시해 오매칭 가능성을
             호출부가 알 수 있게 한다.
        """
        candidates = self.search_movie_list(title)
        if not candidates:
            return None

        exact = [m for m in candidates if m.get("movieNm") == title]
        pool = exact or candidates
        if len(pool) == 1:
            return pool[0].get("movieCd")

        if release_year is not None:
            year_matched = [
                m for m in pool
                if m.get("prdtYear") and abs(int(m["prdtYear"]) - release_year) <= 1
            ]
            if len(year_matched) == 1:
                return year_matched[0].get("movieCd")
            if year_matched:
                pool = year_matched  # 여전히 여럿이면 다음 단계(배급사)로 좁혀본다

        if production_companies and len(pool) > 1:
            best_code, best_score = None, 0.0
            for m in pool:
                code = m.get("movieCd")
                if not code:
                    continue
                info = self._safe_fetch_info(code)
                companies = [
                    c.get("companyNm", "") for c in info.get("companys", [])
                ]
                score = _best_company_similarity(production_companies, companies)
                if score > best_score:
                    best_code, best_score = code, score
            if best_code and best_score >= 0.6:
                return best_code

        # 못 좁혔으면 첫 후보로 폴백 (오매칭 가능성 있음 - enrich_age_rating의
        # AgeRatingMatch.confidence로 호출부에 알린다)
        return pool[0].get("movieCd")

    def _safe_fetch_info(self, movie_code: str) -> dict:
        try:
            params = {"key": require_key("KOFIC_API_KEY", self.api_key), "movieCd": movie_code}
            resp = self.session.get(
                f"{KOFIC_BASE_URL}/movie/searchMovieInfo.json", params=params, timeout=10
            )
            resp.raise_for_status()
            return resp.json().get("movieInfoResult", {}).get("movieInfo", {})
        except requests.RequestException:
            return {}

    def fetch_age_rating(self, movie_code: str) -> Optional[str]:
        """movieCd로 상세정보 조회 후 관람등급(watchGradeNm)을 추출.
        searchMovieInfo.json의 audits[].watchGradeNm 필드를 사용한다."""
        info = self._safe_fetch_info(movie_code)
        audits = info.get("audits", [])
        if audits:
            return audits[0].get("watchGradeNm")
        return None

    def enrich_age_rating(self, movie: MovieCandidate) -> MovieCandidate:
        """실패해도 서비스 흐름을 막지 않도록 예외를 흡수한다 (NFR-09).
        release_year/production_companies가 MovieCandidate에 있으면 자동으로
        동명 영화 오매칭 방지에 활용한다(movie_catalog.MovieCatalog.bootstrap을
        pages 늘려서 쓰거나 fetch_detail로 채운 경우에만 production_companies가
        채워진다 - 없어도 release_year만으로 상당수 케이스가 해결된다)."""
        try:
            code = self.find_movie_code(
                movie.title,
                release_year=movie.release_year,
                production_companies=movie.production_companies or None,
            )
            if code:
                movie.age_rating = self.fetch_age_rating(code)
        except requests.RequestException:
            movie.age_rating = None
        return movie


def _best_company_similarity(tmdb_companies: List[str], kofic_companies: List[str]) -> float:
    """TMDB 제작/배급사명과 KOFIC 배급사명 목록 중 가장 비슷한 쌍의 유사도.

    ⚠️ 단순 문자열 유사도만으로는 "CJ ENM"(TMDB, 로마자)과 "씨제이이엔엠"
    (KOFIC, 한글 표기) 같은 경우를 전혀 못 잡는다 — 실제로 이 케이스로
    테스트해보고서야 발견한 버그다. 그래서 국내 주요 배급/제작사에 한해
    로마자<->한글 별칭 테이블(MAJOR_DISTRIBUTOR_ALIASES)로 먼저 정규화한
    뒤 비교하고, 표에 없는 회사는 (둘 다 로마자거나 둘 다 한글 표기가
    비슷한 경우에 한해) 문자열 유사도로 느슨하게 비교한다.

    이 표는 메이저 배급사 위주라 완전하지 않다 — 표에 없는 중소/독립
    배급사 조합은 여전히 놓칠 수 있으니, 실제로 자주 틀리는 조합을
    발견하면 이 표에 추가할 것.
    """
    if not tmdb_companies or not kofic_companies:
        return 0.0

    def normalize(name: str) -> str:
        key = name.strip().lower()
        return MAJOR_DISTRIBUTOR_ALIASES.get(key, name).lower()

    best = 0.0
    for a in tmdb_companies:
        for b in kofic_companies:
            score = SequenceMatcher(None, normalize(a), normalize(b)).ratio()
            best = max(best, score)
    return best


# 로마자(TMDB 표기, 소문자 키) -> 한글(KOFIC 표기) 별칭.
# KOFIC 쪽은 이미 한글이라 그대로 두고, TMDB 쪽만 한글로 정규화해서 비교한다.
MAJOR_DISTRIBUTOR_ALIASES: Dict[str, str] = {
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
    # --- 확장: 중소/독립 배급·투자·제작사 (오매칭이 관찰되기 쉬운 조합 위주) ---
    # NEW(뉴)는 CJ ENM/쇼박스/롯데엔터테인먼트와 함께 4~5대 메이저로
    # 꼽히지만 기존 표에는 없었다. Plus M(플러스엠)도 준 메이저급이라 추가.
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


# ---------------------------------------------------------------------------
# 제목 매칭 (오타 보정 포함) - FR-AI-04
# ---------------------------------------------------------------------------

def match_title(query: str, catalog: List[MovieCandidate], confidence_threshold: float = 0.72):
    """카탈로그 제목들과 문자열 유사도를 비교해 가장 가까운 영화를 찾는다.
    확신도가 threshold 미만이면 None(UNKNOWN_TITLE 처리)을 반환한다.
    """
    best_movie, best_score = None, 0.0
    for movie in catalog:
        score = SequenceMatcher(None, query, movie.title).ratio()
        if score > best_score:
            best_movie, best_score = movie, score
    if best_score >= confidence_threshold:
        return best_movie, best_score
    return None, best_score


class MovieCatalog:
    """서버 기동 시 1회 구성하는 인메모리 카탈로그.
    실제 서비스에서는 DB(캐시 테이블)로 교체하되 인터페이스는 동일하게 유지한다.
    """

    def __init__(self, movies: Optional[List[MovieCandidate]] = None):
        self._movies: Dict[str, MovieCandidate] = {m.movie_id: m for m in (movies or [])}

    @classmethod
    def bootstrap(
        cls,
        pages: int = 3,
        enrich_kofic: bool = False,
        enrich_keywords: bool = False,
    ) -> "MovieCatalog":
        """카탈로그를 구성한다.

        enrich_keywords=True로 켜면 각 영화마다 fetch_detail()을 추가로
        호출해 TMDB 키워드(재난/무협/히어로 태그 보강용)와
        production_companies(KOFIC 배급사 매칭용)를 채운다 - 인기영화
        페이지당 20편씩 추가 API 호출이 나가므로 pages를 늘릴수록 비용이
        커진다. 꺼두면 /movie/popular 응답만으로 빠르게 카탈로그를 만들고,
        재난/무협/히어로 태그와 production_companies는 비어있는 채로 남는다
        (해당 영화가 채팅에서 언급되어도 그 카테고리들만 매칭이 안 될 뿐,
        나머지 장르 매칭·추천 흐름은 그대로 동작한다).
        """
        tmdb = TMDBClient()
        movies = tmdb.fetch_popular(pages=pages)
        if enrich_keywords:
            movies = [tmdb.fetch_detail(m.movie_id) for m in movies]
        if enrich_kofic:
            kofic = KoficClient()
            movies = [kofic.enrich_age_rating(m) for m in movies]
        return cls(movies)

    def all(self) -> List[MovieCandidate]:
        return list(self._movies.values())

    def get(self, movie_id: str) -> Optional[MovieCandidate]:
        return self._movies.get(movie_id)

    def add(self, movie: MovieCandidate) -> None:
        self._movies[movie.movie_id] = movie

    def find_by_title(self, title: str):
        return match_title(title, self.all())
