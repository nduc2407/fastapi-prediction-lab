"""Ứng dụng FastAPI. Chạy: uvicorn app.main:app --app-dir apps/api --port 8000"""

import contextlib
import logging
import statistics
import threading
import time
import uuid
from collections import defaultdict

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Security, status
from fastapi.security import APIKeyHeader
from pythonjsonlogger import json as jsonlogger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import API_KEY, MAX_LAB_SLEEP, MAX_TEXT_LENGTH, MODEL_FILE, RATE_LIMIT
from .model_service import NewsgroupsModel
from .schemas import (
    BatchPredictionInput,
    BatchPredictionOutput,
    CacheStats,
    HealthOutput,
    MetricsOutput,
    MetricsSummary,
    ModelMetadata,
    PredictionInput,
    PredictionOutput,
)

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
_handler = logging.StreamHandler()
_handler.setFormatter(
    jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
)
logging.getLogger().addHandler(_handler)
logging.getLogger().setLevel(logging.INFO)
logger = logging.getLogger("pvl")

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# In-memory metrics
# ---------------------------------------------------------------------------
_metrics: dict[str, list[float]] = defaultdict(list)
_metrics_lock = threading.Lock()


def _record_metric(path: str, ms: float) -> None:
    with _metrics_lock:
        buf = _metrics[path]
        buf.append(ms)
        if len(buf) > 10_000:  # giới hạn RAM
            del buf[:1000]


# ---------------------------------------------------------------------------
# Optional API key auth
# ---------------------------------------------------------------------------
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _check_api_key(key: str | None = Security(_api_key_header)) -> None:
    if API_KEY and key != API_KEY:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API key không hợp lệ hoặc thiếu")


# ---------------------------------------------------------------------------
# Model service
# ---------------------------------------------------------------------------
service = NewsgroupsModel()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    service.load(MODEL_FILE)  # nạp đúng một lần khi khởi động
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FastAPI Prediction Lab",
    description="Phân loại Newsgroups bằng TF-IDF + Naive Bayes, kèm endpoint thí nghiệm hiệu năng",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# Middleware: logging + metrics
# ---------------------------------------------------------------------------
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(elapsed_ms, 2),
        },
    )
    _record_metric(request.url.path, elapsed_ms)
    return response


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
# Dùng `def` (không phải `async def`) vì predict là CPU-bound đồng bộ:
# FastAPI chạy trong ThreadPool nên nhiều request không chặn Event Loop.
@app.post("/api/prediction", response_model=PredictionOutput, dependencies=[Depends(_check_api_key)])
@limiter.limit(RATE_LIMIT)
def prediction(request: Request, payload: PredictionInput) -> PredictionOutput:
    return service.predict(payload.text)


@app.post(
    "/api/prediction/batch",
    response_model=BatchPredictionOutput,
    dependencies=[Depends(_check_api_key)],
)
@limiter.limit(RATE_LIMIT)
def prediction_batch(request: Request, payload: BatchPredictionInput) -> BatchPredictionOutput:
    if any(not t.strip() or len(t) > MAX_TEXT_LENGTH for t in payload.texts):
        raise HTTPException(
            422,
            f"Mỗi văn bản phải không rỗng và tối đa {MAX_TEXT_LENGTH} ký tự",
        )
    return BatchPredictionOutput(predictions=service.predict_batch(payload.texts))


@app.get("/api/health", response_model=HealthOutput)
def health() -> HealthOutput:
    if not service.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Model chưa sẵn sàng")
    meta = None
    if service.metadata:
        meta = ModelMetadata(**service.metadata)
    return HealthOutput(status="ok", categories=service.targets, model_metadata=meta)


@app.get("/api/cache/stats", response_model=CacheStats)
def cache_stats() -> CacheStats:
    return service.cache.stats()


@app.delete("/api/cache", status_code=status.HTTP_204_NO_CONTENT)
def delete_cache() -> None:
    service.cache.clear()


@app.get("/api/metrics", response_model=MetricsOutput)
def get_metrics() -> MetricsOutput:
    with _metrics_lock:
        snapshot = {k: list(v) for k, v in _metrics.items()}
    summaries = []
    for path, times in snapshot.items():
        if not times:
            continue
        s = sorted(times)
        n = len(s)
        summaries.append(
            MetricsSummary(
                endpoint=path,
                count=n,
                p50_ms=round(s[int(n * 0.50)], 2),
                p95_ms=round(s[int(n * 0.95)], 2),
                p99_ms=round(s[min(int(n * 0.99), n - 1)], 2),
                mean_ms=round(statistics.mean(s), 2),
            )
        )
    return MetricsOutput(metrics=sorted(summaries, key=lambda x: x.endpoint))


# ---- Endpoint thí nghiệm: cùng một thao tác chặn (time.sleep) nhưng khai báo khác nhau ----
@app.get("/api/lab/fast")
async def lab_fast() -> dict:
    return {"endpoint": "fast"}


@app.get("/api/lab/slow-async")
async def lab_slow_async(sleep: float = Query(1.0, gt=0, le=MAX_LAB_SLEEP)) -> dict:
    """async def + time.sleep: CHẶN Event Loop, các request khác phải xếp hàng."""
    time.sleep(sleep)
    return {"endpoint": "slow-async", "slept": sleep}


@app.get("/api/lab/slow-sync")
def lab_slow_sync(sleep: float = Query(1.0, gt=0, le=MAX_LAB_SLEEP)) -> dict:
    """def + time.sleep: chạy trong ThreadPool, các request chạy song song."""
    time.sleep(sleep)
    return {"endpoint": "slow-sync", "slept": sleep}
