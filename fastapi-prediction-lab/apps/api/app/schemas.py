"""Schema Pydantic: validate input/output và sinh tài liệu /docs."""

from pydantic import BaseModel, Field

from .config import MAX_BATCH_SIZE, MAX_TEXT_LENGTH


class PredictionInput(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)


class BatchPredictionInput(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=MAX_BATCH_SIZE)


class ScoredCategory(BaseModel):
    category: str
    probability: float


class PredictionOutput(BaseModel):
    category: str
    confidence: float
    top: list[ScoredCategory]
    cached: bool = False


class BatchPredictionOutput(BaseModel):
    predictions: list[PredictionOutput]


class CacheStats(BaseModel):
    size: int
    max_size: int
    hits: int
    misses: int
    hit_rate: float


class ModelMetadata(BaseModel):
    sklearn_version: str
    trained_at: str
    accuracy_test: float
    categories: list[str]


class HealthOutput(BaseModel):
    status: str
    categories: list[str]
    model_metadata: ModelMetadata | None = None  # thêm field mới, backward compat


class MetricsSummary(BaseModel):
    endpoint: str
    count: int
    p50_ms: float
    p95_ms: float
    p99_ms: float
    mean_ms: float


class MetricsOutput(BaseModel):
    metrics: list[MetricsSummary]
