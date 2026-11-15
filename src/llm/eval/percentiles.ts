/**
 * Empirical percentile with linear interpolation (inclusive method).
 * Empty sample → null. Single sample → that value for any p in [0,100].
 */
export function percentile(sortedAscending: number[], p: number): number | null {
  if (sortedAscending.length === 0) {
    return null;
  }
  if (p <= 0) {
    return sortedAscending[0] ?? null;
  }
  if (p >= 100) {
    return sortedAscending[sortedAscending.length - 1] ?? null;
  }
  const n = sortedAscending.length;
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const a = sortedAscending[lo];
  const b = sortedAscending[hi];
  if (a === undefined || b === undefined) {
    return null;
  }
  if (lo === hi) {
    return a;
  }
  const w = rank - lo;
  return a * (1 - w) + b * w;
}

export type LatencySummary = {
  sampleSize: number;
  method: 'linear_interpolation_inclusive';
  p50Ms: number | null;
  p95Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
  meanMs: number | null;
};

export function summarizeLatencies(samplesMs: readonly number[]): LatencySummary {
  const sorted = [...samplesMs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const sampleSize = sorted.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      method: 'linear_interpolation_inclusive',
      p50Ms: null,
      p95Ms: null,
      minMs: null,
      maxMs: null,
      meanMs: null,
    };
  }
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    sampleSize,
    method: 'linear_interpolation_inclusive',
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    minMs: sorted[0] ?? null,
    maxMs: sorted[sampleSize - 1] ?? null,
    meanMs: sum / sampleSize,
  };
}
