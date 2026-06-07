export interface TrendResult {
  trend: "improving" | "degrading" | "stable";
  rollingAvg7d: number;
  sampleCount: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STABLE_THRESHOLD = 5;

export function analyzeTrend(
  scores: { score: number; calculatedAt: Date }[]
): TrendResult {
  if (scores.length === 0) {
    return { trend: "stable", rollingAvg7d: 0, sampleCount: 0 };
  }

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const recent = scores.filter((s) => s.calculatedAt >= cutoff);

  const sampleCount = recent.length;
  const rollingAvg7d =
    sampleCount > 0
      ? recent.reduce((sum, s) => sum + s.score, 0) / sampleCount
      : scores[0]!.score;

  if (sampleCount < 2) {
    return { trend: "stable", rollingAvg7d, sampleCount };
  }

  // Sort ascending by time to compare oldest vs newest within window
  const sorted = [...recent].sort(
    (a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime()
  );
  const oldest = sorted[0]!.score;
  const newest = sorted[sorted.length - 1]!.score;
  const delta = newest - oldest;

  let trend: "improving" | "degrading" | "stable";
  if (delta < -STABLE_THRESHOLD) {
    // Risk score went down → site improved
    trend = "improving";
  } else if (delta > STABLE_THRESHOLD) {
    // Risk score went up → site degraded
    trend = "degrading";
  } else {
    trend = "stable";
  }

  return { trend, rollingAvg7d, sampleCount };
}
