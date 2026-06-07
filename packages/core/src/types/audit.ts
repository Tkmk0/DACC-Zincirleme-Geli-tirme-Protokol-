export interface AuditSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
}

export interface AuditCheckResult {
  checkName: string;
  passed: boolean;
  severity: "info" | "warning" | "error" | "critical";
  score: number;
  details: unknown;
}
