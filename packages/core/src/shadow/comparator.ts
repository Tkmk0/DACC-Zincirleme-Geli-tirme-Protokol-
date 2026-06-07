import type { CheckResult } from "../types/risk.js";

export interface CheckResultEntry {
  checkName: string;
  score: number;
  passed: boolean;
}

export interface DivergentCheck {
  checkName: string;
  baseline: CheckResultEntry;
  shadow: CheckResultEntry;
  scoreDelta: number;
}

export interface ComparisonSummary {
  totalChecks: number;
  identical: number;
  divergent: number;
  convergenceRate: number;
}

export interface ComparisonOptions {
  threshold?: number;
}

export interface ComparisonResult {
  divergentChecks: DivergentCheck[];
  summary: ComparisonSummary;
}

export function compareAuditResults(
  baseline: CheckResult[],
  shadow: CheckResult[],
  _options: ComparisonOptions = {}
): ComparisonResult {
  const baselineMap = new Map(baseline.map((c) => [c.checkName, c]));
  const shadowMap = new Map(shadow.map((c) => [c.checkName, c]));
  const allNames = new Set([...baselineMap.keys(), ...shadowMap.keys()]);

  const divergentChecks: DivergentCheck[] = [];

  for (const name of allNames) {
    const b = baselineMap.get(name);
    const s = shadowMap.get(name);
    if (!b || !s) continue;
    if (b.score !== s.score || b.passed !== s.passed) {
      divergentChecks.push({
        checkName: name,
        baseline: { checkName: name, score: b.score, passed: b.passed },
        shadow: { checkName: name, score: s.score, passed: s.passed },
        scoreDelta: s.score - b.score,
      });
    }
  }

  const total = allNames.size;
  const divergent = divergentChecks.length;
  return {
    divergentChecks,
    summary: {
      totalChecks: total,
      identical: total - divergent,
      divergent,
      convergenceRate: total > 0 ? (total - divergent) / total : 1,
    },
  };
}
