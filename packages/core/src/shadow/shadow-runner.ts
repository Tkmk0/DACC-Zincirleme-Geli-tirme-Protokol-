import type { CheckResult } from "../types/risk.js";

export interface ShadowAuditRequest {
  tenantId: string;
  assetId: string;
  auditEventId: string;
  checksToRun: string[];
}

export interface ShadowAuditResult {
  tenantId: string;
  assetId: string;
  auditEventId: string;
  checkResults: CheckResult[];
  score: number;
  completedAt: string;
}

export interface ShadowRunnerConfig {
  concurrency?: number;
  timeoutMs?: number;
}

export interface ShadowRunner {
  run(request: ShadowAuditRequest): Promise<ShadowAuditResult>;
  config: ShadowRunnerConfig;
}

export function createShadowRunner(config: ShadowRunnerConfig = {}): ShadowRunner {
  return {
    config,
    async run(request: ShadowAuditRequest): Promise<ShadowAuditResult> {
      return {
        tenantId: request.tenantId,
        assetId: request.assetId,
        auditEventId: request.auditEventId,
        checkResults: [],
        score: 0,
        completedAt: new Date().toISOString(),
      };
    },
  };
}
