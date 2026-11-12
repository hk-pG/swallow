/** @param {number[]} values */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** @param {number[]} values */
export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mean = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  const variance =
    sorted.length > 1
      ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (sorted.length - 1)
      : 0;
  return {
    runsMs: sorted,
    medianMs: med,
    meanMs: mean,
    stdevMs: Math.sqrt(variance),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}
