import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type MetricsOutput } from "../api";
import { formatMs } from "../stats";
import { RefreshCwIcon } from "../Icons";

const REFRESH_INTERVAL_MS = 5000;

export default function MetricsLab() {
  const [metrics, setMetrics] = useState<MetricsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.metrics();
      setMetrics(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 5 seconds while tab is active
  useEffect(() => {
    void fetchMetrics();
    intervalRef.current = setInterval(() => {
      void fetchMetrics();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchMetrics]);

  const endpoints = metrics ? metrics.metrics : [];

  return (
    <section className="card">
      <h2>Metrics — hiệu năng endpoint</h2>
      <p className="muted">
        Gọi <code>GET /api/metrics</code>. Hiển thị P50 / P95 / P99 / trung bình / số lượng cho từng
        endpoint. Tự động làm mới mỗi {REFRESH_INTERVAL_MS / 1000} giây khi tab đang active.
      </p>

      <div className="metrics-refresh">
        <span
          className={`refresh-dot${loading ? "" : ""}`}
          title="Đang tự động làm mới"
          aria-hidden="true"
        />
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {loading
            ? "Đang tải…"
            : lastUpdated
            ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString("vi-VN")}`
            : "Chưa tải"}
        </span>
        <button
          className={`primary${loading ? " busy" : ""}`}
          style={{ padding: "6px 14px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}
          disabled={loading}
          onClick={() => void fetchMetrics()}
        >
          <RefreshCwIcon size={13} />
          <span>{loading ? "Đang tải…" : "Làm mới"}</span>
        </button>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {endpoints.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Số lượng</th>
                <th>Trung bình</th>
                <th>P50</th>
                <th>P95</th>
                <th>P99</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((m) => (
                <tr key={m.endpoint}>
                  <td>
                    <code>{m.endpoint}</code>
                  </td>
                  <td>{m.count.toLocaleString("vi-VN")}</td>
                  <td>{formatMs(m.mean_ms)}</td>
                  <td>{formatMs(m.p50_ms)}</td>
                  <td
                    style={{
                      color: m.p95_ms > 500 ? "var(--amber)" : "inherit",
                    }}
                  >
                    {formatMs(m.p95_ms)}
                  </td>
                  <td
                    style={{
                      color: m.p99_ms > 1000 ? "var(--red)" : m.p99_ms > 500 ? "var(--amber)" : "inherit",
                      fontWeight: m.p99_ms > 500 ? 600 : undefined,
                    }}
                  >
                    {formatMs(m.p99_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Chưa có dữ liệu — hãy gọi một vài API trước, rồi quay lại đây.
        </p>
      ) : null}
    </section>
  );
}
