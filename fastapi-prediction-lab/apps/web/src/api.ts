/** Lớp gọi API. Mọi số đo thời gian lấy từ thực tế: trình duyệt (performance.now) và header server. */

export interface ScoredCategory {
  category: string;
  probability: number;
}

export interface PredictionOutput {
  category: string;
  confidence: number;
  top: ScoredCategory[];
  cached: boolean;
}

export interface CacheStats {
  size: number;
  max_size: number;
  hits: number;
  misses: number;
  hit_rate: number;
}

export interface EndpointMetrics {
  endpoint: string;
  count: number;
  mean_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface MetricsOutput {
  metrics: EndpointMetrics[];
}

export interface Timed<T> {
  data: T;
  /** Thời gian khứ hồi đo ở trình duyệt, ms. */
  clientMs: number;
  /** Thời gian xử lý ở server (header X-Process-Time-Ms), NaN nếu không có. */
  serverMs: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<Timed<T>> {
  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError("Không kết nối được tới API. Hãy chắc chắn backend đang chạy ở cổng 8000.");
  }
  const clientMs = performance.now() - start;
  if (!response.ok) {
    throw new ApiError(`API trả lỗi ${response.status}`, response.status);
  }
  const serverMs = Number(response.headers.get("X-Process-Time-Ms") ?? NaN);
  const data = (response.status === 204 ? undefined : await response.json()) as T;
  return { data, clientMs, serverMs };
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<{ status: string; categories: string[] }>("/api/health"),
  predict: (text: string) => request<PredictionOutput>("/api/prediction", json({ text })),
  predictBatch: (texts: string[]) =>
    request<{ predictions: PredictionOutput[] }>("/api/prediction/batch", json({ texts })),
  cacheStats: () => request<CacheStats>("/api/cache/stats"),
  clearCache: () => request<void>("/api/cache", { method: "DELETE" }),
  slow: (kind: "async" | "sync", sleep: number) =>
    request<{ endpoint: string; slept: number }>(`/api/lab/slow-${kind}?sleep=${sleep}`),
  metrics: () => request<MetricsOutput>("/api/metrics"),
};

/** Lưu lịch sử predict vào localStorage */
export interface HistoryEntry {
  id: number;
  text: string;
  category: string;
  confidence: number;
  cached: boolean;
  clientMs: number;
  timestamp: number;
}

const HISTORY_KEY = "predict_history";
const MAX_HISTORY = 10;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function addToHistory(
  entries: HistoryEntry[],
  entry: Omit<HistoryEntry, "id">,
): HistoryEntry[] {
  const id = Date.now();
  return [{ id, ...entry }, ...entries].slice(0, MAX_HISTORY);
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
