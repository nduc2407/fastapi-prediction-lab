import { useState } from "react";
import { api, ApiError } from "../api";
import { classifyConcurrency, formatSeconds, speedup, type ConcurrencyVerdict } from "../stats";

interface Span {
  startS: number;
  endS: number;
}

interface Run {
  kind: "async" | "sync";
  spans: Span[];
  totalS: number;
  verdict: ConcurrencyVerdict;
}

// Trình duyệt giới hạn khoảng 6 kết nối đồng thời tới một host (HTTP/1.1), nên tối đa 6 request.
const MAX_REQUESTS = 6;

const VERDICT_TEXT: Record<ConcurrencyVerdict, string> = {
  sequential: "XẾP HÀNG: request sau phải chờ request trước",
  parallel:   "SONG SONG: các request chạy cùng lúc",
  mixed:      "MỘT PHẦN SONG SONG",
};

const VERDICT_ICON: Record<ConcurrencyVerdict, string> = {
  sequential: "⚠️",
  parallel:   "✅",
  mixed:      "🔀",
};

async function fire(kind: "async" | "sync", n: number, sleep: number): Promise<Run> {
  const origin = performance.now();
  const spans = await Promise.all(
    Array.from({ length: n }, async () => {
      const startS = (performance.now() - origin) / 1000;
      await api.slow(kind, sleep);
      return { startS, endS: (performance.now() - origin) / 1000 };
    }),
  );
  const totalS = Math.max(...spans.map((s) => s.endS));
  return { kind, spans, totalS, verdict: classifyConcurrency(totalS, n, sleep) };
}

export default function ConcurrencyLab() {
  const [n, setN] = useState(3);
  const [sleep, setSleep] = useState(1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      // Tuần tự giữa hai thí nghiệm để chúng không ảnh hưởng nhau.
      const asyncRun = await fire("async", n, sleep);
      const syncRun = await fire("sync", n, sleep);
      setRuns([asyncRun, syncRun]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  const [asyncRun, syncRun] = runs;
  const axis = Math.max(...runs.map((r) => r.totalS), sleep);

  const ENDPOINT_LABEL: Record<"async" | "sync", string> = {
    async: "⚡ /slow-async (async def)",
    sync:  "🔧 /slow-sync (def)",
  };

  return (
    <section className="card">
      <h2>Concurrency Lab: async def vs def</h2>
      <p className="muted">
        Cùng một thao tác chặn <code>time.sleep</code>, nhưng <code>/slow-async</code> khai báo{" "}
        <code>async def</code> (chặn Event Loop) còn <code>/slow-sync</code> khai báo <code>def</code> (chạy
        trong ThreadPool). Trình duyệt bắn đồng thời {n} request vào mỗi endpoint.
      </p>

      <div className="controls">
        <label>
          Số request: <strong>{n}</strong>
          <input
            type="range"
            min={2}
            max={MAX_REQUESTS}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
          />
        </label>
        <label>
          Thời gian mỗi request: <strong>{sleep} s</strong>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.5}
            value={sleep}
            onChange={(e) => setSleep(Number(e.target.value))}
          />
        </label>
        <button
          className={`primary${busy ? " busy" : ""}`}
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? "Đang chạy…" : "Chạy thí nghiệm"}
        </button>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="timeline">
        {runs.map((r) => (
          <div key={r.kind}>
            <h3>
              {ENDPOINT_LABEL[r.kind]} · tổng {formatSeconds(r.totalS)}
            </h3>
            <p className={`verdict ${r.verdict}`}>
              <span aria-hidden="true">{VERDICT_ICON[r.verdict]}</span>
              {VERDICT_TEXT[r.verdict]}
            </p>
            <ol>
              {r.spans
                .slice()
                .sort((a, b) => a.endS - b.endS)
                .map((s, i) => (
                  <li key={i}>
                    <span className="bar-label">Request {i + 1}</span>
                    <span className="bar-track">
                      <span
                        className={`bar-fill ${r.kind}`}
                        style={{
                          marginLeft: `${(s.startS / axis) * 100}%`,
                          width: `${Math.max(1, ((s.endS - s.startS) / axis) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="bar-value">{formatSeconds(s.endS)}</span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>

      {asyncRun && syncRun && (
        <div className={`summary ${syncRun.verdict === "parallel" ? "positive" : "warning"}`}>
          Tổng thời gian: async def {formatSeconds(asyncRun.totalS)} · def{" "}
          {formatSeconds(syncRun.totalS)}, tức{" "}
          <strong>{speedup(asyncRun.totalS, syncRun.totalS).toFixed(1)}×</strong> nhanh hơn khi dùng{" "}
          <code>def</code>. Thanh bên trái là lúc request bắt đầu, độ dài thanh là thời gian chờ phản hồi.
        </div>
      )}
    </section>
  );
}
