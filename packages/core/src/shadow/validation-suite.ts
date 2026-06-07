import { compareAuditResults, type ComparisonResult } from "./comparator.js";
import type { CheckResult } from "../types/risk.js";

export interface ValidationSuiteConfig {
  minConvergenceRate?: number;
  maxDivergentChecks?: number;
}

export interface ValidationReport {
  passed: boolean;
  convergenceRate: number;
  divergentChecks: number;
  failureReasons: string[];
  comparisonResult: ComparisonResult;
}

export function validateSinglePair(
  baseline: CheckResult[],
  shadow: CheckResult[],
  config: ValidationSuiteConfig = {}
): ValidationReport {
  const { minConvergenceRate = 0.95, maxDivergentChecks = 2 } = config;
  const result = compareAuditResults(baseline, shadow);
  const failureReasons: string[] = [];

  if (result.summary.convergenceRate < minConvergenceRate) {
    failureReasons.push(
      `Convergence rate ${result.summary.convergenceRate.toFixed(2)} < ${minConvergenceRate}`
    );
  }
  if (result.summary.divergent > maxDivergentChecks) {
    failureReasons.push(
      `${result.summary.divergent} divergent checks > max ${maxDivergentChecks}`
    );
  }

  return {
    passed: failureReasons.length === 0,
    convergenceRate: result.summary.convergenceRate,
    divergentChecks: result.summary.divergent,
    failureReasons,
    comparisonResult: result,
  };
}

export async function runValidationSuite(
  pairs: Array<{ baseline: CheckResult[]; shadow: CheckResult[] }>,
  config: ValidationSuiteConfig = {}
): Promise<ValidationReport[]> {
  return pairs.map((p) => validateSinglePair(p.baseline, p.shadow, config));
}
