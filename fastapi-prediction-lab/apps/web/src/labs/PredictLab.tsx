import { useState } from "react";
import { api, ApiError, type PredictionOutput, type Timed } from "../api";
import { formatMs } from "../stats";

const PRESETS = [
  "computer cpu memory ram motherboard",
  "god church bible faith religion",
  "encryption key cipher algorithm",
];

export default function PredictLab() {
  const [text, setText] = useState(PRESETS[0]!);
  const [result, setResult] = useState<Timed<PredictionOutput> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.predict(text));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Dự đoán một văn bản</h2>
      <p className="muted">
        Gọi <code>POST /api/prediction</code>. Gửi cùng một văn bản lần hai sẽ thấy cờ CACHE HIT.
      </p>

      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p}
            className={`chip${text === p ? " active" : ""}`}
            onClick={() => setText(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <label htmlFor="text" className="label">
        Văn bản tiếng Anh (1–10.000 ký tự)
      </label>
      <textarea
        id="text"
        rows={4}
        value={text}
        maxLength={10000}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className={`primary${busy ? " busy" : ""}`}
        disabled={busy || text.trim().length === 0}
        onClick={() => void run()}
      >
        {busy ? "Đang dự đoán…" : "Dự đoán"}
      </button>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="result" aria-live="polite">
          <div className="result-header">
            <div>
              <p className="result-category">{result.data.category}</p>
              <div className="result-meta">
                <span
                  className={result.data.cached ? "tag hit" : "tag cold"}
                  title={result.data.cached ? "Lấy từ cache" : "Tính toán mới"}
                >
                  {result.data.cached ? "✓ CACHE HIT" : "↓ COLD"}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="result-confidence">
                {(result.data.confidence * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                độ tin cậy
              </div>
            </div>
          </div>

          <ul className="bars">
            {result.data.top.map((t) => {
              const pct = (t.probability * 100).toFixed(1);
              const widthNum = t.probability * 100;
              return (
                <li key={t.category}>
                  <span className="bar-label">{t.category}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${pct}%` }}
                      title={`${pct}%`}
                    />
                  </span>
                  <span className="bar-value">
                    {widthNum >= 1 ? `${pct}%` : `${pct}%`}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="muted">
            Thời gian: trình duyệt {formatMs(result.clientMs)} · server {formatMs(result.serverMs)}.
            Xác suất của Naive Bayes chỉ để tham khảo, không phải độ chắc chắn tuyệt đối.
          </p>
        </div>
      )}
    </section>
  );
}
