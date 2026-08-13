import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer, StandardScaler
from .schemas import Movie


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().casefold())


class FeatureBuilder:
    def fit_transform(self, movies: list[Movie]) -> dict[str, np.ndarray]:
        self.genre = MultiLabelBinarizer().fit([m.genres for m in movies])
        genre = self.genre.transform([m.genres for m in movies]).astype(float)
        overview_text = [normalize_text(" ".join(dict.fromkeys(filter(None, [m.overview_ko, m.overview_en, m.overview])))) for m in movies]
        self.overview = TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=12000).fit(overview_text)
        overview = self.overview.transform(overview_text).toarray()
        self.keyword = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b", max_features=4000).fit([" ".join(m.keywords) or "unknown" for m in movies])
        keyword = self.keyword.transform([" ".join(m.keywords) or "unknown" for m in movies]).toarray()
        self.people = TfidfVectorizer(token_pattern=r"(?u)[^|]+", max_features=4000).fit([" | ".join(m.directors + m.cast[:5]) or "unknown" for m in movies])
        people = self.people.transform([" | ".join(m.directors + m.cast[:5]) or "unknown" for m in movies]).toarray()
        numeric_raw = [[m.runtime or 0, int((m.release_date or "0")[:4] or 0), m.vote_average, np.log1p(m.vote_count), np.log1p(m.popularity)] for m in movies]
        numeric = StandardScaler().fit_transform(numeric_raw)
        return {"genre": genre, "overview": overview, "keyword": keyword, "people": people, "numeric": numeric}

    @staticmethod
    def combine(parts: dict[str, np.ndarray], weights: dict[str, float] | None = None) -> np.ndarray:
        weights = weights or {"genre": .24, "overview": .34, "keyword": .2, "people": .12, "numeric": .1}
        # float32 halves the resident model size and is sufficiently precise for
        # cosine similarity and the pairwise ranker.
        return np.hstack([parts[k] * weights[k] for k in weights]).astype(np.float32, copy=False)
