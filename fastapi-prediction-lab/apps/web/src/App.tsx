import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import CacheLab from "./labs/CacheLab";
import ConcurrencyLab from "./labs/ConcurrencyLab";
import MetricsLab from "./labs/MetricsLab";
import PredictLab from "./labs/PredictLab";

type Tab = "predict" | "cache" | "concurrency" | "metrics";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "predict",     label: "Dự đoán",        icon: "🎯" },
  { id: "cache",       label: "Cache Lab",       icon: "💾" },
  { id: "concurrency", label: "Concurrency Lab", icon: "⚡" },
  { id: "metrics",     label: "Metrics",         icon: "📊" },
];

type Health = "checking" | "online" | "offline";

export default function App() {
  const [tab, setTab] = useState<Tab>("predict");
  const [health, setHealth] = useState<Health>("checking");

  const check = useCallback(async () => {
    setHealth("checking");
    try {
      await api.health();
      setHealth("online");
    } catch {
      setHealth("offline");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const badgeLabel =
    health === "checking" ? "Đang kiểm tra…"
    : health === "online"  ? "API: ONLINE"
    : "API: OFFLINE";

  return (
    <div className="shell">
      <header className="header">
        <div className="header-title-row">
          <span className="header-icon" aria-hidden="true">⚡</span>
          <h1>FastAPI Prediction Lab</h1>
        </div>
        <p className="header-subtitle">
          Seminar Chapter 12: tạo API dự đoán hiệu quả. Mọi số đo là kết quả thật từ backend cục bộ.
        </p>
        <button
          className={`badge badge-${health}`}
          onClick={() => void check()}
          title="Kiểm tra lại kết nối"
        >
          {badgeLabel}
        </button>
      </header>

      <div className="layout">
        <nav className="sidebar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "sidebar-item active" : "sidebar-item"}
              onClick={() => setTab(t.id)}
            >
              <span className="sidebar-icon" aria-hidden="true">{t.icon}</span>
              <span className="sidebar-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="main-content">
          {health === "offline" && (
            <p className="alert" role="alert">
              Không kết nối được backend. Khởi động bằng:{" "}
              <code>uvicorn app.main:app --port 8000</code> trong thư mục <code>apps/api</code>, rồi bấm vào
              nhãn trạng thái để kiểm tra lại.
            </p>
          )}
          <div className="tab-content">
            {tab === "predict"     && <PredictLab />}
            {tab === "cache"       && <CacheLab />}
            {tab === "concurrency" && <ConcurrencyLab />}
            {tab === "metrics"     && <MetricsLab />}
          </div>
        </main>
      </div>
    </div>
  );
}
