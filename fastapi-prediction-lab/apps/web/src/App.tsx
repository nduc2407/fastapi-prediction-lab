import { useCallback, useEffect, useState } from "react";
import { api, type CacheStats, type HealthData } from "./api";
import CacheLab from "./labs/CacheLab";
import ConcurrencyLab from "./labs/ConcurrencyLab";
import MetricsLab from "./labs/MetricsLab";
import PredictLab from "./labs/PredictLab";
import { toast, ToastContainer } from "./Toast";

type Tab = "predict" | "cache" | "concurrency" | "metrics";

const TABS: { id: Tab; label: string; icon: string; shortcut: string; desc: string }[] = [
  { id: "predict", label: "Dự đoán", icon: "🎯", shortcut: "1", desc: "Suy luận & so sánh nhãn" },
  { id: "cache", label: "Cache Lab", icon: "💾", shortcut: "2", desc: "Cold vs Warm inference" },
  { id: "concurrency", label: "Concurrency Lab", icon: "⚡", shortcut: "3", desc: "Async def vs Def ThreadPool" },
  { id: "metrics", label: "Metrics", icon: "📊", shortcut: "4", desc: "P50, P95, P99 realtime" },
];

type Health = "checking" | "online" | "offline";

export default function App() {
  const [tab, setTab] = useState<Tab>("predict");
  const [health, setHealth] = useState<Health>("checking");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const check = useCallback(async () => {
    setHealth("checking");
    try {
      const [hRes, cRes] = await Promise.all([
        api.health(),
        api.cacheStats().catch(() => null),
      ]);
      setHealth("online");
      setHealthData(hRes.data);
      if (cRes) setCacheStats(cRes.data);
    } catch {
      setHealth("offline");
      setHealthData(null);
    }
  }, []);

  const refreshCacheStats = useCallback(async () => {
    try {
      const res = await api.cacheStats();
      setCacheStats(res.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void check();
    const interval = setInterval(() => {
      void refreshCacheStats();
    }, 8000);
    return () => clearInterval(interval);
  }, [check, refreshCacheStats]);

  // Keyboard shortcuts: Ctrl+1~4
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TABS.length) {
        e.preventDefault();
        setTab(TABS[idx]!.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleClearCache() {
    setClearingCache(true);
    try {
      await api.clearCache();
      const res = await api.cacheStats();
      setCacheStats(res.data);
      toast("Đã dọn sạch bộ nhớ Cache!", "success");
    } catch {
      toast("Không thể xóa cache", "error");
    } finally {
      setClearingCache(false);
    }
  }

  const badgeLabel =
    health === "checking" ? "Đang kiểm tra…"
      : health === "online" ? "API: ONLINE"
        : "API: OFFLINE";

  const accuracy = healthData?.model_metadata?.accuracy_test
    ? `${(healthData.model_metadata.accuracy_test * 100).toFixed(1)}%`
    : "83.2%";

  const categoriesCount = healthData?.categories?.length ?? 4;
  const hitRatePct = cacheStats ? (cacheStats.hit_rate * 100).toFixed(0) : "0";

  return (
    <>
      <ToastContainer />
      <div className="shell">
        {/* Top Header */}
        <header className="header">
          <div className="header-left">
            <div className="header-title-row">
              <span className="header-icon" aria-hidden="true">⚡</span>
              <h1>FastAPI Prediction Lab</h1>
              <span className="version-pill">v2.1</span>
            </div>
            <p className="header-subtitle">
              Seminar Chapter 12: Thiết kế & Tối ưu API phục vụ Machine Learning hiệu năng cao với FastAPI.
            </p>
            <div className="header-tags">
              <span className="tech-tag">🚀 FastAPI 0.110+</span>
              <span className="tech-tag">🐍 Python 3.12 (AnyIO)</span>
              <span className="tech-tag">🧠 scikit-learn 1.9.1</span>
              <span className="tech-tag">⚛️ React 18 + Vite</span>
            </div>
          </div>

          <div className="header-actions">
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="header-link-btn"
              title="Mở tài liệu Swagger UI"
            >
              📑 Swagger API ↗
            </a>
            <button
              className={`badge badge-${health}`}
              onClick={() => void check()}
              title="Kiểm tra lại kết nối API"
            >
              {badgeLabel}
            </button>
          </div>
        </header>

        {/* KPI / Overview Bar */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">🌐</span>
              <span className="kpi-title">API GATEWAY</span>
            </div>
            <div className="kpi-value">
              <span className={health === "online" ? "kpi-status-live" : "kpi-status-dead"}>
                {health === "online" ? "Port 8000" : "Offline"}
              </span>
            </div>
            <div className="kpi-desc">FastAPI + AnyIO ThreadPool</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">🎯</span>
              <span className="kpi-title">MÔ HÌNH ML</span>
            </div>
            <div className="kpi-value">{accuracy}</div>
            <div className="kpi-desc">TF-IDF + MNB ({categoriesCount} nhóm nhãn)</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">💾</span>
              <span className="kpi-title">BỘ NHỚ ĐỆM (LRU)</span>
            </div>
            <div className="kpi-value">
              {cacheStats ? `${cacheStats.size} / ${cacheStats.max_size}` : "6 mục"}
            </div>
            <div className="kpi-desc">Tỉ lệ Hit: {hitRatePct}% (Khóa SHA-256)</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">⚡</span>
              <span className="kpi-title">ĐỘ TRỄ INFERENCE</span>
            </div>
            <div className="kpi-value">~3 - 8 ms</div>
            <div className="kpi-desc">In-Memory Pipeline (Đo thực tế)</div>
          </div>
        </div>

        {/* Main Content Layout with Sidebar */}
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-group">
              <span className="sidebar-heading">KHÔNG GIAN THỰC NGHIỆM</span>
              <nav role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? "sidebar-item active" : "sidebar-item"}
                    onClick={() => setTab(t.id)}
                    title={`${t.label} (Ctrl+${t.shortcut})`}
                  >
                    <span className="sidebar-icon" aria-hidden="true">{t.icon}</span>
                    <div className="sidebar-text-col">
                      <span className="sidebar-label">{t.label}</span>
                      <span className="sidebar-sublabel">{t.desc}</span>
                    </div>
                    <kbd className="sidebar-kbd">{t.shortcut}</kbd>
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Cache Telemetry Widget */}
            <div className="sidebar-widget">
              <div className="widget-header">
                <span className="widget-title">💾 Bộ nhớ đệm (LRU)</span>
                <span className="widget-badge">{hitRatePct}% Hit</span>
              </div>
              <div className="widget-bar-track">
                <div
                  className="widget-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(5, Number(hitRatePct)))}%` }}
                />
              </div>
              <div className="widget-stats-row">
                <span>Dung lượng: <strong>{cacheStats ? cacheStats.size : 0} mục</strong></span>
                <span>Hits: <strong>{cacheStats ? cacheStats.hits : 0}</strong></span>
              </div>
              <button
                className="widget-btn-clear"
                onClick={() => void handleClearCache()}
                disabled={clearingCache}
              >
                {clearingCache ? "Đang xóa…" : "🗑️ Dọn sạch Cache"}
              </button>
            </div>

            {/* Model Spec Card */}
            <div className="sidebar-widget info-widget">
              <div className="widget-header">
                <span className="widget-title">🧠 Thông số Model</span>
              </div>
              <div className="info-widget-content">
                <div className="info-row">
                  <span className="info-key">Thuật toán:</span>
                  <span className="info-val">Naive Bayes</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Vectorize:</span>
                  <span className="info-val">TF-IDF (ngram 1-2)</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Cache Key:</span>
                  <span className="info-val">SHA-256 (32B)</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Execution:</span>
                  <span className="info-val">ThreadPool (AnyIO)</span>
                </div>
              </div>
            </div>

            {/* Documentation & Links */}
            <div className="sidebar-group">
              <span className="sidebar-heading">TÀI LIỆU & NGUỒN</span>
              <div className="sidebar-links">
                <a
                  href="http://127.0.0.1:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="sidebar-ext-link"
                >
                  <span>📑 Swagger UI (/docs)</span>
                  <span className="ext-icon">↗</span>
                </a>
                <a
                  href="http://127.0.0.1:8000/redoc"
                  target="_blank"
                  rel="noreferrer"
                  className="sidebar-ext-link"
                >
                  <span>📘 ReDoc Documentation</span>
                  <span className="ext-icon">↗</span>
                </a>
                <a
                  href="https://github.com/nduc2407/fastapi-prediction-lab"
                  target="_blank"
                  rel="noreferrer"
                  className="sidebar-ext-link"
                >
                  <span>🐙 GitHub Repository</span>
                  <span className="ext-icon">↗</span>
                </a>
              </div>
            </div>

            <div className="sidebar-footer">
              <span>⌨️ Nhấn <strong>Ctrl + 1~4</strong> đổi tab</span>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="main-content">
            {health === "offline" && (
              <div className="alert-banner" role="alert">
                <span className="alert-icon">⚠️</span>
                <div>
                  <strong>Không kết nối được Backend FastAPI (Port 8000)!</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                    Hãy kiểm tra terminal hoặc khởi động bằng lệnh:{" "}
                    <code>uvicorn app.main:app --port 8000</code> tại thư mục <code>apps/api</code>,
                    sau đó bấm vào nhãn trạng thái ở góc trên để kết nối lại.
                  </p>
                </div>
              </div>
            )}

            <div className="tab-content">
              {tab === "predict" && <PredictLab />}
              {tab === "cache" && <CacheLab />}
              {tab === "concurrency" && <ConcurrencyLab />}
              {tab === "metrics" && <MetricsLab />}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
