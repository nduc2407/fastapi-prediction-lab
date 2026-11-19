import { useState, useCallback } from "react";
import {
  api, ApiError,
  type PredictionOutput, type Timed, type HistoryEntry,
  loadHistory, saveHistory, addToHistory, clearHistory,
} from "../api";
import { formatMs } from "../stats";
import { toast } from "../Toast";

const PRESETS = [
  "computer cpu memory ram motherboard",
  "god church bible faith religion",
  "encryption key cipher algorithm",
  "baseball pitcher home run innings",
  "stock market investor shares dividend",
  "space telescope galaxy orbit planets",
  "medicine vaccine clinical trial dosage",
];

function confidenceColor(c: number): string {
  if (c >= 0.8) return "var(--mint)";
  if (c >= 0.5) return "var(--amber)";
  return "var(--red)";
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Panel hiển thị 1 kết quả predict */
function ResultPanel({
  result,
  label,
  onExport,
}: {
  result: Timed<PredictionOutput>;
  label?: string;
  onExport?: () => void;
}) {
  const conf = result.data.confidence;
  return (
    <div className="result" aria-live="polite">
      {label && <p className="compare-label">{label}</p>}
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
          <div className="result-confidence" style={{ color: confidenceColor(conf) }}>
            {(conf * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            độ tin cậy
          </div>
        </div>
      </div>

      <ul className="bars">
        {result.data.top.map((t) => {
          const pct = (t.probability * 100).toFixed(1);
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
              <span className="bar-value">{pct}%</span>
            </li>
          );
        })}
      </ul>

      <div className="result-footer">
        <p className="muted" style={{ margin: 0 }}>
          Trình duyệt {formatMs(result.clientMs)} · Server {formatMs(result.serverMs)}
        </p>
        {onExport && (
          <button className="btn-ghost" onClick={onExport} title="Tải kết quả JSON">
            📤 Export JSON
          </button>
        )}
      </div>
    </div>
  );
}

export default function PredictLab() {
  const [text, setText] = useState(PRESETS[0]!);
  const [compareText, setCompareText] = useState(PRESETS[1]!);
  const [result, setResult] = useState<Timed<PredictionOutput> | null>(null);
  const [compareResult, setCompareResult] = useState<Timed<PredictionOutput> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (compareMode) {
        const [r1, r2] = await Promise.all([
          api.predict(text),
          api.predict(compareText),
        ]);
        setResult(r1);
        setCompareResult(r2);
        toast(`So sánh xong: ${r1.data.category} vs ${r2.data.category}`, "success");
        const updated = addToHistory(history, {
          text, category: r1.data.category,
          confidence: r1.data.confidence,
          cached: r1.data.cached,
          clientMs: r1.clientMs,
          timestamp: Date.now(),
        });
        setHistory(updated);
        saveHistory(updated);
      } else {
        const r = await api.predict(text);
        setResult(r);
        setCompareResult(null);
        const hitLabel = r.data.cached ? "CACHE HIT ⚡" : "COLD";
        toast(`${r.data.category} · ${(r.data.confidence * 100).toFixed(1)}% · ${hitLabel}`, "success");
        const updated = addToHistory(history, {
          text, category: r.data.category,
          confidence: r.data.confidence,
          cached: r.data.cached,
          clientMs: r.clientMs,
          timestamp: Date.now(),
        });
        setHistory(updated);
        saveHistory(updated);
      }
    } catch (e) {
      setResult(null);
      setCompareResult(null);
      const msg = e instanceof ApiError ? e.message : "Lỗi không xác định";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }, [text, compareText, compareMode, history]);

  function handleExport(r: Timed<PredictionOutput>, label: string) {
    downloadJson({ text, label, ...r.data, clientMs: r.clientMs, serverMs: r.serverMs, timestamp: new Date().toISOString() }, `predict-${label}-${Date.now()}.json`);
    toast("Đã tải file JSON", "info");
  }

  function handleLoadHistory(entry: HistoryEntry) {
    setText(entry.text);
    setShowHistory(false);
    toast(`Đã load: "${entry.text.slice(0, 30)}…"`, "info");
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast("Đã xóa lịch sử", "info");
  }

  const charCount = text.length;
  const charOver = charCount > 10000;

  return (
    <section className="card">
      <div className="lab-header">
        <div>
          <h2>Dự đoán văn bản</h2>
          <p className="muted">
            Gọi <code>POST /api/prediction</code>. Gửi cùng văn bản lần hai sẽ thấy cờ CACHE HIT.
          </p>
        </div>
        <div className="lab-actions">
          <button
            className={`btn-toggle${compareMode ? " active" : ""}`}
            onClick={() => { setCompareMode((v) => !v); setCompareResult(null); }}
            title="So sánh 2 văn bản"
          >
            🔍 So sánh
          </button>
          <button
            className={`btn-toggle${showHistory ? " active" : ""}`}
            onClick={() => setShowHistory((v) => !v)}
            title="Lịch sử dự đoán"
          >
            📜 Lịch sử {history.length > 0 && <span className="history-badge">{history.length}</span>}
          </button>
        </div>
      </div>

      {/* Lịch sử */}
      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Lịch sử ({history.length}/10)</span>
            {history.length > 0 && (
              <button className="btn-ghost" onClick={handleClearHistory}>🗑 Xóa tất cả</button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="muted" style={{ padding: "8px 0", margin: 0 }}>Chưa có lịch sử nào.</p>
          ) : (
            <ul className="history-list">
              {history.map((entry) => (
                <li key={entry.id} className="history-item" onClick={() => handleLoadHistory(entry)}>
                  <span className="history-text">{entry.text.slice(0, 50)}{entry.text.length > 50 ? "…" : ""}</span>
                  <span className="history-meta">
                    <span className={entry.cached ? "tag hit" : "tag cold"} style={{ fontSize: "0.68rem" }}>
                      {entry.cached ? "HIT" : "COLD"}
                    </span>
                    <span style={{ color: confidenceColor(entry.confidence), fontWeight: 600, fontSize: "0.8rem" }}>
                      {(entry.confidence * 100).toFixed(0)}%
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{entry.category}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Preset chips */}
      <div className="chips">
        {PRESETS.slice(0, 5).map((p) => (
          <button
            key={p}
            className={`chip${text === p ? " active" : ""}`}
            onClick={() => setText(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {compareMode ? (
        <div className="compare-grid">
          <div>
            <label className="label">Văn bản A</label>
            <textarea
              rows={4}
              value={text}
              maxLength={10000}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="char-counter">{text.length} / 10 000</div>
          </div>
          <div>
            <label className="label">Văn bản B</label>
            <textarea
              rows={4}
              value={compareText}
              maxLength={10000}
              onChange={(e) => setCompareText(e.target.value)}
            />
            <div className="char-counter">{compareText.length} / 10 000</div>
          </div>
        </div>
      ) : (
        <>
          <label htmlFor="text" className="label">
            Văn bản tiếng Anh (1–10 000 ký tự)
          </label>
          <textarea
            id="text"
            rows={4}
            value={text}
            maxLength={10000}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={`char-counter${charOver ? " over" : ""}`}>
            {charCount.toLocaleString("vi-VN")} / 10 000
          </div>
        </>
      )}

      <button
        className={`primary${busy ? " busy" : ""}`}
        disabled={busy || text.trim().length === 0}
        onClick={() => void run()}
      >
        {busy ? "Đang dự đoán…" : compareMode ? "🔍 So sánh cả hai" : "Dự đoán"}
      </button>

      {error && (
        <p className="alert" role="alert">{error}</p>
      )}

      {compareMode && result && compareResult ? (
        <div className="compare-results">
          <ResultPanel
            result={result}
            label="Văn bản A"
            onExport={() => handleExport(result, "A")}
          />
          <ResultPanel
            result={compareResult}
            label="Văn bản B"
            onExport={() => handleExport(compareResult, "B")}
          />
        </div>
      ) : result ? (
        <ResultPanel result={result} onExport={() => handleExport(result, "result")} />
      ) : null}
    </section>
  );
}
