"""
영화 카탈로그 - TMDB만 사용한다 (v2, 백지 재설계).

v1에는 KOFIC(영화진흥위원회) 등급 보강이 있었는데, 실제로 확인해보니
용도(동명 영화 등급 disambiguation)가 기획 문서에서 제안된 "박스오피스
인기도"와 달랐고, MVP 핵심 기능(관련성 판별→추천)에 필수도 아니어서
v2에서는 뺐다. 필요해지면 별도 모듈로 다시 추가할 것.
"""

from __future__ import annotations

import difflib
from typing import List, Optional

import requests

import config
from models import MovieCandidate


class MovieCatalog:
    def __init__(self, movies: List[MovieCandidate]):
        self._movies = movies
        self._by_id = {m.movie_id: m for m in movies}

    def all(self) -> List[MovieCandidate]:
        return list(self._movies)

    def get(self, movie_id: str) -> Optional[MovieCandidate]:
        return self._by_id.get(movie_id)

    def match_title(self, candidate_text: str) -> Optional[MovieCandidate]:
        """오타/약칭 제목을 카탈로그의 실제 제목과 매칭한다 (FR-AI-04).
        확신도가 임계값 미만이면 None(=UNKNOWN_TITLE 처리는 호출부 책임)."""
        if not candidate_text or not self._movies:
            return None
        best, best_ratio = None, 0.0
        for movie in self._movies:
            for title in (movie.title, movie.original_title):
                ratio = difflib.SequenceMatcher(None, candidate_text, title).ratio()
                if ratio > best_ratio:
                    best, best_ratio = movie, ratio
        if best_ratio >= config.TITLE_MATCH_CONFIDENCE_THRESHOLD:
            return best
        return None

    @classmethod
    def bootstrap(cls, pages: int = 5) -> "MovieCatalog":
        """서버 기동 시 TMDB 인기영화를 미리 수집해 인메모리 카탈로그를 구성한다.
        실 서비스에서는 배치로 DB/캐시에 적재하는 것을 권장 (README 참고)."""
        key = config.require_key("TMDB_API_KEY", config.TMDB_API_KEY)
        movies: List[MovieCandidate] = []
        genre_map = _fetch_genre_map(key)

        for page in range(1, pages + 1):
            resp = requests.get(
                f"{config.TMDB_BASE_URL}/movie/popular",
                params={
                    "api_key": key,
                    "language": config.TMDB_LANGUAGE,
                    "region": config.TMDB_REGION,
                    "page": page,
                },
                timeout=10,
            )
            resp.raise_for_status()
            for item in resp.json().get("results", []):
                movies.append(MovieCandidate(
                    movie_id=str(item["id"]),
                    title=item.get("title", ""),
                    original_title=item.get("original_title", ""),
                    genres=[genre_map.get(gid, "") for gid in item.get("genre_ids", [])],
                    overview=item.get("overview", ""),
                    popularity=float(item.get("popularity", 0.0)),
                    vote_average=float(item.get("vote_average", 0.0)),
                    runtime=None,  # 상세 조회 없이는 목록 API에 러닝타임이 없음
                    adult=bool(item.get("adult", False)),
                    poster_path=item.get("poster_path"),
                    release_date=item.get("release_date"),
                ))
        return cls(movies)


def _fetch_genre_map(api_key: str) -> dict:
    resp = requests.get(
        f"{config.TMDB_BASE_URL}/genre/movie/list",
        params={"api_key": api_key, "language": config.TMDB_LANGUAGE},
        timeout=10,
    )
    resp.raise_for_status()
    return {g["id"]: g["name"] for g in resp.json().get("genres", [])}
