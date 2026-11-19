/** Hàm thống kê thuần túy, có unit test. Không gọi mạng. */

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Số lần nhanh hơn của `fast` so với `slow`. Trả NaN nếu không tính được. */
export function speedup(slow: number, fast: number): number {
  return fast > 0 && Number.isFinite(slow) && Number.isFinite(fast) ? slow / fast : NaN;
}

export type ConcurrencyVerdict = "sequential" | "parallel" | "mixed";

/**
 * Phân loại cách server xử lý n request, mỗi request chiếm `sleepSeconds`:
 * - sequential: tổng thời gian ≈ n × sleep (xếp hàng)
 * - parallel:   tổng thời gian ≈ 1 × sleep (song song)
 * - mixed:      nằm giữa hai mức trên
 */
export function classifyConcurrency(
  totalSeconds: number,
  n: number,
  sleepSeconds: number,
): ConcurrencyVerdict {
  if (n <= 1) return "parallel";
  const sequential = n * sleepSeconds;
  if (totalSeconds >= 0.85 * sequential) return "sequential";
  if (totalSeconds <= sleepSeconds * 1.5) return "parallel";
  return "mixed";
}

export function formatMs(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(value < 10 ? 2 : 1)} ms` : "–";
}

export function formatSeconds(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(2)} s` : "–";
}
