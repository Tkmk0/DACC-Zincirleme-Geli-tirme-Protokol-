export interface RiskFactor {
  factor: string;
  weight: number; // 0–1
  value: number; // raw metric value
  contribution: number; // weight * normalized_value
}

export interface CheckResult {
  checkName: string;
  passed: boolean;
  severity: "info" | "warning" | "error" | "critical";
  score: number; // 0–100
  details: unknown;
}

export interface RiskCalculationInput {
  assetId: string;
  tenantId: string;
  auditEventId: string;
  checkResults: CheckResult[];
}

export interface RiskCalculationOutput {
  score: number; // 0.0–100.0
  level: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  calculatorVersion: string;
}

export function scoreToLevel(
  score: number
): RiskCalculationOutput["level"] {
  if (score === 0) return "NONE";
  if (score < 25) return "LOW";
  if (score < 50) return "MEDIUM";
  if (score < 75) return "HIGH";
  return "CRITICAL";
}
