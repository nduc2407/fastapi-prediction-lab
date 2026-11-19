"""Kiểm thử API bằng model thật trong apps/api/models (không gọi mạng)."""

import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import app

TEXT = "computer cpu memory ram"


@pytest.fixture()
def client():
    with TestClient(app) as c:  # chạy lifespan: nạp model
        c.delete("/api/cache")
        yield c


def test_health_lists_four_categories(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert len(body["categories"]) == 4


def test_prediction_returns_label_confidence_and_top3(client):
    r = client.post("/api/prediction", json={"text": TEXT})
    assert r.status_code == 200
    body = r.json()
    assert body["category"] == "comp.sys.mac.hardware"
    assert len(body["top"]) == 3
    assert body["top"][0]["probability"] == body["confidence"]
    assert "X-Process-Time-Ms" in r.headers


def test_second_identical_call_is_cache_hit_and_stats_match(client):
    first = client.post("/api/prediction", json={"text": TEXT}).json()
    second = client.post("/api/prediction", json={"text": f"  {TEXT}  "}).json()  # khác khoảng trắng
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["category"] == first["category"]
    stats = client.get("/api/cache/stats").json()
    assert (stats["hits"], stats["misses"], stats["size"]) == (1, 1, 1)


def test_delete_cache_resets_stats(client):
    client.post("/api/prediction", json={"text": TEXT})
    assert client.delete("/api/cache").status_code == 204
    assert client.get("/api/cache/stats").json()["size"] == 0


@pytest.mark.parametrize("payload", [{"text": ""}, {}, {"text": "x" * 10_001}])
def test_prediction_rejects_invalid_input(client, payload):
    assert client.post("/api/prediction", json=payload).status_code == 422


def test_batch_matches_single_predictions(client):
    texts = ["god church bible", "encryption key cipher", TEXT]
    batch = client.post("/api/prediction/batch", json={"texts": texts}).json()["predictions"]
    singles = [client.post("/api/prediction", json={"text": t}).json() for t in texts]
    assert [b["category"] for b in batch] == [s["category"] for s in singles]


def test_batch_rejects_blank_item_and_oversized_batch(client):
    assert client.post("/api/prediction/batch", json={"texts": ["ok", "   "]}).status_code == 422
    assert client.post("/api/prediction/batch", json={"texts": ["a"] * 65}).status_code == 422


def test_lab_sleep_is_bounded(client):
    assert client.get("/api/lab/slow-sync?sleep=60").status_code == 422
    assert client.get("/api/lab/slow-sync?sleep=0").status_code == 422


def test_sync_endpoint_runs_requests_in_parallel(client):
    """def -> ThreadPool: 3 request x 0.3s phải xong rõ ràng nhanh hơn 0.9s tuần tự."""
    start = time.perf_counter()
    with ThreadPoolExecutor(3) as pool:
        results = list(pool.map(lambda _: client.get("/api/lab/slow-sync?sleep=0.3"), range(3)))
    elapsed = time.perf_counter() - start
    assert all(r.status_code == 200 for r in results)
    assert elapsed < 0.8, f"mong đợi chạy song song, thực tế {elapsed:.2f}s"
