import { useEffect, useState, useCallback } from "react";
import { CheckCircleIcon, AlertCircleIcon, InfoIcon } from "./Icons";

export interface ToastMessage {
  id: number;
  text: string;
  kind: "success" | "error" | "info";
}

let _id = 0;
type Listener = (msg: ToastMessage) => void;
const listeners: Set<Listener> = new Set();

export function toast(text: string, kind: ToastMessage["kind"] = "info") {
  const msg: ToastMessage = { id: ++_id, text, kind };
  listeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const listener: Listener = (msg) => {
      setToasts((prev) => [...prev.slice(-4), msg]);
      setTimeout(() => remove(msg.id), 3000);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [remove]);

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-icon">
            {t.kind === "success" ? <CheckCircleIcon size={16} /> : t.kind === "error" ? <AlertCircleIcon size={16} /> : <InfoIcon size={16} />}
          </span>
          <span>{t.text}</span>
          <button className="toast-close" onClick={() => remove(t.id)} aria-label="Đóng">×</button>
        </div>
      ))}
    </div>
  );
}
