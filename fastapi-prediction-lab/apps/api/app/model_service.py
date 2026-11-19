"""Dịch vụ model: nạp một lần, dự đoán, cache LRU trong RAM có đếm hit/miss chính xác."""

import hashlib
import threading
import warnings
from collections import OrderedDict
from pathlib import Path

warnings.filterwarnings("ignore")

import joblib
from sklearn.pipeline import Pipeline

from .config import CACHE_SIZE
from .schemas import CacheStats, PredictionOutput, ScoredCategory

Ranked = tuple[tuple[str, float], ...]  # (nhãn, xác suất) giảm dần, bất biến nên an toàn để cache


class LruCache:
    """LRU an toàn đa luồng. Không dùng functools.lru_cache vì cần biết chính xác
    từng lần gọi là hit hay miss khi nhiều thread chạy song song."""

    def __init__(self, max_size: int) -> None:
        self._max_size = max_size
        self._data: OrderedDict[str, Ranked] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Ranked | None:
        with self._lock:
            value = self._data.get(key)
            if value is None:
                self.misses += 1
                return None
            self._data.move_to_end(key)
            self.hits += 1
            return value

    def put(self, key: str, value: Ranked) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self._max_size:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self.hits = self.misses = 0

    def stats(self) -> CacheStats:
        with self._lock:
            total = self.hits + self.misses
            return CacheStats(
                size=len(self._data),
                max_size=self._max_size,
                hits=self.hits,
                misses=self.misses,
                hit_rate=round(self.hits / total, 4) if total else 0.0,
            )


class NewsgroupsModel:
    def __init__(self, cache_size: int = CACHE_SIZE) -> None:
        self.model: Pipeline | None = None
        self.targets: list[str] = []
        self.metadata: dict = {}
        self.cache = LruCache(cache_size)

    def load(self, path: Path) -> None:
        loaded = joblib.load(path)
        # Backward-compat: support both 2-tuple and 3-tuple
        if len(loaded) == 3:
            self.model, self.targets, self.metadata = loaded
        else:
            self.model, self.targets = loaded
            self.metadata = {}

    @property
    def ready(self) -> bool:
        return self.model is not None

    def _rank(self, proba_row) -> Ranked:
        order = proba_row.argsort()[::-1]
        return tuple((self.targets[i], float(proba_row[i])) for i in order)

    @staticmethod
    def _output(ranked: Ranked, cached: bool, top_k: int = 3) -> PredictionOutput:
        top = [ScoredCategory(category=c, probability=round(p, 4)) for c, p in ranked[:top_k]]
        return PredictionOutput(
            category=top[0].category, confidence=top[0].probability, top=top, cached=cached
        )

    @staticmethod
    def _cache_key(text: str) -> str:
        """SHA256 hash của văn bản đã strip — tiết kiệm RAM với văn bản dài."""
        return hashlib.sha256(text.strip().encode()).hexdigest()

    def predict(self, text: str) -> PredictionOutput:
        if self.model is None:
            raise RuntimeError("Model chưa được nạp")
        key = self._cache_key(text)
        ranked = self.cache.get(key)
        if ranked is not None:
            return self._output(ranked, cached=True)
        ranked = self._rank(self.model.predict_proba([text.strip()])[0])
        self.cache.put(key, ranked)
        return self._output(ranked, cached=False)

    def predict_batch(self, texts: list[str]) -> list[PredictionOutput]:
        """Batch predict: check cache trước, chỉ gọi model với những văn bản chưa có, merge kết quả lại."""
        if self.model is None:
            raise RuntimeError("Model chưa được nạp")

        stripped = [t.strip() for t in texts]
        keys = [self._cache_key(t) for t in stripped]

        # Tách những văn bản cần gọi model (chưa có trong cache)
        miss_indices: list[int] = []
        miss_texts: list[str] = []
        results: list[Ranked | None] = []

        for i, (key, text) in enumerate(zip(keys, stripped)):
            cached = self.cache.get(key)
            results.append(cached)
            if cached is None:
                miss_indices.append(i)
                miss_texts.append(text)

        # Gọi model một lần cho tất cả miss
        if miss_texts:
            probas = self.model.predict_proba(miss_texts)
            for idx, proba_row in zip(miss_indices, probas):
                ranked = self._rank(proba_row)
                self.cache.put(keys[idx], ranked)
                results[idx] = ranked

        return [
            self._output(ranked, cached=(i not in miss_indices))
            for i, ranked in enumerate(results)
        ]
