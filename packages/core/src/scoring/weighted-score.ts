import type { CheckResult, RiskFactor } from "../types/risk.js";

const WEIGHTS: Record<string, number> = {
  "meta-tags": 0.20,
  canonical: 0.15,
  robots: 0.10,
  "structured-data": 0.15,
  performance: 0.10,
  "heading-hierarchy": 0.10,
  "open-graph": 0.05,
  sitemap: 0.05,
  "twitter-card": 0.03,
  "image-alt": 0.04,
  "page-speed-hints": 0.02,
  "internal-links": 0.01,
};

const DEFAULT_WEIGHT = 0.01;

export interface WeightedScoreResult {
  score: number;    // 0–100 SEO health (high = good)
  riskScore: number; // 0–100 inverted (high = bad)
  factors: RiskFactor[];
}

export function computeWeightedScore(checkResults: CheckResult[]): WeightedScoreResult {
  if (checkResults.length === 0) {
    return { score: 0, riskScore: 100, factors: [] };
  }

  let totalWeight = 0;
  const rawWeights: Record<string, number> = {};

  for (const r of checkResults) {
    const w = WEIGHTS[r.checkName] ?? DEFAULT_WEIGHT;
    rawWeights[r.checkName] = w;
    totalWeight += w;
  }

  const factors: RiskFactor[] = [];
  let weightedSum = 0;

  for (const r of checkResults) {
    const raw = rawWeights[r.checkName] ?? DEFAULT_WEIGHT;
    const norm = totalWeight > 0 ? raw / totalWeight : 1 / checkResults.length;
    const contribution = (100 - r.score) * norm;
    weightedSum += contribution;
    factors.push({ factor: r.checkName, weight: norm, value: r.score, contribution });
  }

  const riskScore = Math.min(100, Math.max(0, weightedSum));
  return { score: 100 - riskScore, riskScore, factors };
}
