import json
import hashlib
import time
from pathlib import Path
import joblib
import numpy as np
from sklearn.linear_model import SGDClassifier
from sklearn.metrics.pairwise import cosine_similarity
from .features import FeatureBuilder
from .schemas import Movie


class MultilingualEmbeddingModel:
    """Optional CPU-friendly multilingual semantic encoder.

    The model is loaded lazily so fixture tests and the TF-IDF baseline work
    without downloading a large artifact.
    """
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.encoder = None

    def encode(self, movies: list[Movie]) -> np.ndarray:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise RuntimeError("임베딩 모델 사용 시 `pip install -e .[embedding]`을 실행하세요.") from exc
        if self.encoder is None:
            self.encoder = SentenceTransformer(self.model_name, device="cpu")
        fields = [[m.overview, " ".join(m.keywords), " ".join(m.genres)] for m in movies]
        field_vectors = [self.encoder.encode([row[i] or "" for row in fields], normalize_embeddings=True) for i in range(3)]
        return .55 * field_vectors[0] + .25 * field_vectors[1] + .20 * field_vectors[2]


def relation_pairs(movies: list[Movie]) -> tuple[np.ndarray, np.ndarray]:
    by_tmdb = {m.tmdb_id: i for i, m in enumerate(movies)}
    positives = []
    for i, movie in enumerate(movies):
        for target in set(movie.recommendations + movie.similar):
            if target in by_tmdb and by_tmdb[target] != i:
                positives.append((i, by_tmdb[target]))

    # TMDB relations are not guaranteed to be symmetric. Treat either direction
    # as positive so a related movie pair is never sampled as a negative.
    positive_pairs = set(positives)
    positive_pairs.update((target, source) for source, target in positives)

    negatives = []
    rng = np.random.default_rng(42)
    for i, movie in enumerate(movies):
        candidates = [
            j
            for j, other in enumerate(movies)
            if j != i
            and (i, j) not in positive_pairs
            and not (set(movie.genres) & set(other.genres))
        ]
        if candidates:
            negatives.append((i, int(rng.choice(candidates))))
    return np.asarray(positives, dtype=int).reshape(-1, 2), np.asarray(negatives, dtype=int).reshape(-1, 2)


def split_relation_pairs(movies: list[Movie], test_ratio: float = .2) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Split positive edges by undirected movie pair and keep all negatives in train.

    Both directions of the same TMDB relationship always land in the same split,
    preventing the reverse edge from leaking into training.
    """
    positive, negative = relation_pairs(movies)
    train_positive, test_positive = [], []
    threshold = int(test_ratio * 10_000)
    for source, target in positive.tolist():
        left, right = sorted((movies[source].internal_id, movies[target].internal_id))
        bucket = int(hashlib.sha1(f"{left}|{right}".encode()).hexdigest()[:8], 16) % 10_000
        (test_positive if bucket < threshold else train_positive).append((source, target))
    return (np.asarray(train_positive, dtype=int).reshape(-1, 2),
            np.asarray(test_positive, dtype=int).reshape(-1, 2),
            negative)

def split_relation_pairs_temporal(
    movies: list[Movie],
    cutoff_date: str = "2024-01-01",
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """개봉일 기준으로 relation pair를 train/test로 분리한다.

    source/target 중 더 늦게 개봉한 영화의 날짜를 pair 시점으로 사용한다.
    cutoff 이전 pair는 train, cutoff 이후 pair는 test로 사용한다.
    날짜가 없거나 2026-08-12 이후의 미래 개봉작은 평가에서 제외한다.
    """
    positive, negative = relation_pairs(movies)

    train_positive: list[tuple[int, int]] = []
    test_positive: list[tuple[int, int]] = []

    current_date = "2026-08-12"

    for source, target in positive.tolist():
        source_date = movies[source].release_date
        target_date = movies[target].release_date

        if not source_date or not target_date:
            continue

        pair_date = max(source_date, target_date)

        if pair_date > current_date:
            continue

        if pair_date < cutoff_date:
            train_positive.append((source, target))
        else:
            test_positive.append((source, target))

    return (
        np.asarray(
            train_positive,
            dtype=int,
        ).reshape(-1, 2),
        np.asarray(
            test_positive,
            dtype=int,
        ).reshape(-1, 2),
        negative,
    )

class ModelBundle:
    version = "semantic-group-hybrid-0.4.0"

    def __init__(self, embedding_model_name: str | None = None):
        self.builder = FeatureBuilder()
        self.embedding_model_name = embedding_model_name
        self.embedding_backend = "tfidf"
        self.matrix: np.ndarray | None = None
        self.ranker: SGDClassifier | None = None
        self.relation_test_pairs: np.ndarray = np.empty((0, 2), dtype=int)

    def fit(self, movies: list[Movie]) -> dict:
        started = time.perf_counter()
        parts = self.builder.fit_transform(movies)
        self.matrix = self.builder.combine(parts)
        if self.embedding_model_name:
            try:
                dense = MultilingualEmbeddingModel(
                    self.embedding_model_name
                ).encode(movies).astype(np.float32, copy=False)
                self.matrix = np.hstack([
                    0.65 * self.matrix,
                    0.35 * dense,
                ]).astype(np.float32, copy=False)
                self.embedding_backend = self.embedding_model_name
            except (ImportError, RuntimeError, OSError):
                # Training must remain reproducible without network/model files.
                # The report exposes the fallback instead of inventing metrics.
                self.embedding_backend = "tfidf-fallback"
        positive, self.relation_test_pairs, negative = (
            split_relation_pairs_temporal(movies)
        )
        if len(positive) and len(negative):
            pairs = np.vstack([positive, negative])
            y = np.r_[np.ones(len(positive)), np.zeros(len(negative))]
            rng = np.random.default_rng(42)
            order = rng.permutation(len(pairs))
            class_weights = {
                1: len(pairs) / (2 * len(positive)),
                0: len(pairs) / (2 * len(negative)),
            }
            self.ranker = SGDClassifier(
                loss="log_loss", penalty="l2", alpha=1e-4,
                max_iter=1, tol=None, random_state=42, average=True,
            )
            batch_size = 256
            for start in range(0, len(order), batch_size):
                batch = order[start:start + batch_size]
                selected = pairs[batch]
                x = np.abs(self.matrix[selected[:, 0]] - self.matrix[selected[:, 1]])
                batch_y = y[batch]
                weights = np.asarray([class_weights[int(label)] for label in batch_y])
                self.ranker.partial_fit(x, batch_y, classes=np.asarray([0, 1]), sample_weight=weights)
        return {"model_version": self.version, "embedding_backend": self.embedding_backend,
                "movies": len(movies), "train_positive_pairs": len(positive),
                "test_positive_pairs": len(self.relation_test_pairs), "negative_pairs": len(negative),
                "train_seconds": round(time.perf_counter() - started, 4), "split_strategy": "temporal_release_date",
                "cutoff_date": "2024-01-01"}

    def similarity(self) -> np.ndarray:
        if self.matrix is None: raise RuntimeError("모델이 학습되지 않았습니다.")
        base = cosine_similarity(self.matrix)
        if self.ranker is None: return base
        result = base.copy()
        for i in range(len(result)):
            delta = np.abs(self.matrix - self.matrix[i])
            learned = self.ranker.predict_proba(delta)[:, 1]
            result[i] = .7 * base[i] + .3 * learned
        return result

    def scores_for_seeds(self, seed_indices: list[int]) -> np.ndarray:
        """Score every movie against a user's explicitly liked movie seeds."""
        if self.matrix is None:
            raise RuntimeError("모델이 학습되지 않았습니다.")
        if not seed_indices:
            return np.zeros(len(self.matrix), dtype=float)
        seed_vector = np.mean(self.matrix[seed_indices], axis=0, keepdims=True)
        content = cosine_similarity(seed_vector, self.matrix)[0]
        if self.ranker is None:
            return content
        delta = np.abs(self.matrix - seed_vector)
        learned = self.ranker.predict_proba(delta)[:, 1]
        return .7 * content + .3 * learned

    def scores_for_candidates(self, seed_index: int, candidate_indices: np.ndarray) -> np.ndarray:
        seed = self.matrix[seed_index:seed_index + 1]
        candidates = self.matrix[candidate_indices]
        content = cosine_similarity(seed, candidates)[0]
        if self.ranker is None:
            return content
        learned = self.ranker.predict_proba(np.abs(candidates - seed))[:, 1]
        return .7 * content + .3 * learned

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True); joblib.dump(self, path)


def evaluate(bundle: ModelBundle, movies: list[Movie], k: int = 3, max_queries: int = 200, candidate_pool: int = 250) -> dict:
    test_pairs = getattr(bundle, "relation_test_pairs", np.empty((0, 2), dtype=int))
    truth_by_source: dict[int, set[int]] = {}
    for source, target in test_pairs.tolist():
        truth_by_source.setdefault(source, set()).add(target)
    rng = np.random.default_rng(42)
    precision = []; recall = []; ndcg = []; rr = []
    sources = sorted(truth_by_source)[:max_queries]
    all_indices = np.arange(len(movies))
    for i in sources:
        truth = truth_by_source[i]
        excluded = truth | {i}
        negatives = np.asarray([index for index in all_indices if index not in excluded], dtype=int)
        sample_size = min(max(0, candidate_pool - len(truth)), len(negatives))
        sampled = rng.choice(negatives, size=sample_size, replace=False) if sample_size else np.empty(0, dtype=int)
        candidates = np.asarray(sorted(truth) + sampled.tolist(), dtype=int)
        scores = bundle.scores_for_candidates(i, candidates)
        order = candidates[np.argsort(-scores)][:k].tolist()
        hits = [int(x in truth) for x in order]
        precision.append(sum(hits) / k); recall.append(sum(hits) / len(truth))
        dcg = sum(hit / np.log2(position + 2) for position, hit in enumerate(hits))
        ideal_hits = min(k, len(truth))
        idcg = sum(1 / np.log2(position + 2) for position in range(ideal_hits))
        ndcg.append(float(dcg / idcg) if idcg else 0.0)
        rr.append(next((1/(p+1) for p, h in enumerate(hits) if h), 0))
    return {"precision_at_k": round(float(np.mean(precision or [0])), 4), "recall_at_k": round(float(np.mean(recall or [0])), 4),
            "ndcg_at_k": round(float(np.mean(ndcg or [0])), 4), "mrr": round(float(np.mean(rr or [0])), 4),
            "queries": len(precision), "test_pairs": len(test_pairs), "candidate_pool": candidate_pool, "k": k,
            "evaluation_scope": "temporal_heldout_relation_pairs"}
