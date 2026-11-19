import { useState } from "react";
import { api, ApiError, type CacheStats } from "../api";
import { formatMs, median, speedup } from "../stats";
import { ZapIcon } from "../Icons";

interface Row {
  label: string;
  cached: boolean;
  clientMs: number;
  serverMs: number;
}

const SAMPLE = "computer cpu ram hardware motherboard";
const HIT_REPEATS = 5;

export default function CacheLab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api.clearCache(); // bắt đầu từ cache rỗng để lần đầu chắc chắn là COLD
      const collected: Row[] = [];
      for (let i = 0; i <= HIT_REPEATS; i++) {
        const r = await api.predict(SAMPLE);
        collected.push({
          label: i === 0 ? "Lần 1 (cold)" : `Lần ${i + 1}`,
          cached: r.data.cached,
          clientMs: r.clientMs,
          serverMs: r.serverMs,
        });
      }
      setRows(collected);
      setStats((await api.cacheStats()).data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  const cold = rows.find((r) => !r.cached);
  const hits = rows.filter((r) => r.cached);
  const coldServer = cold?.serverMs ?? NaN;
  const hitServer = median(hits.map((r) => r.serverMs));
  const maxServer = Math.max(...rows.map((r) => r.serverMs), 0.001);
  const su = speedup(coldServer, hitServer);
  const isPositive = Number.isFinite(su) && su >= 1;

  return (
    <section className="card">
      <h2>Cache Lab: cold inference vs cache hit</h2>
      <p className="muted">
        Xoá cache, rồi gửi cùng một văn bản {HIT_REPEATS + 1} lần. Thời gian server lấy từ header{" "}
        <code>X-Process-Time-Ms</code>; thời gian trình duyệt gồm cả mạng cục bộ và proxy. Con số thay
        đổi theo máy và mỗi lần chạy.
      </p>

      <button
        className={`primary${busy ? " busy" : ""}`}
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Đang đo…" : "Chạy thí nghiệm"}
      </button>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lần gọi</th>
                  <th>Trạng thái</th>
                  <th>Server</th>
                  <th>Trình duyệt</th>
                  <th>Server (biểu đồ)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>
                      <span className={r.cached ? "tag hit" : "tag cold"}>
                        {r.cached ? (
                          <>
                            <ZapIcon size={12} />
                            <span>HIT</span>
                          </>
                        ) : (
                          <span>COLD</span>
                        )}
                      </span>
                    </td>
                    <td>{formatMs(r.serverMs)}</td>
                    <td>{formatMs(r.clientMs)}</td>
                    <td>
                      <span className="bar-track small">
                        <span
                          className={r.cached ? "bar-fill hit" : "bar-fill cold"}
                          style={{ width: `${Math.max(2, (r.serverMs / maxServer) * 100)}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`summary ${isPositive ? "positive" : "warning"}`}>
            Server: cold {formatMs(coldServer)} → hit (trung vị) {formatMs(hitServer)}, nhanh hơn{" "}
            <strong>
              {Number.isFinite(su) ? `${su.toFixed(1)}×` : "–"}
            </strong>
            .
            {stats && (
              <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                · Cache server: {stats.hits} hit, {stats.misses} miss,
                tỉ lệ {(stats.hit_rate * 100).toFixed(0)}%,
                {stats.size}/{stats.max_size} mục.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
