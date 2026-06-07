// Local type mirrors of Prisma enums (avoid Prisma client dependency before generate)
export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AuditStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

// ─── Base ──────────────────────────────────────────────────────────────────

export interface BaseEvent {
  eventId: string;
  correlationId: string;
  causationId?: string;
  tenantId: string;
  sourceSystem: "operator" | "auditor" | "scheduler" | "api" | "system";
  occurredAt: string; // ISO 8601
}

// ─── ASSET_DISCOVERED ──────────────────────────────────────────────────────

export interface AssetDiscoveredEvent extends BaseEvent {
  type: "ASSET_DISCOVERED";
  payload: {
    assetId: string;
    url: string;
    domain: string;
    assetType: "URL" | "DOMAIN" | "SITEMAP" | "PAGE";
    discoverySource: "operator" | "crawler" | "sitemap" | "manual";
  };
}

// ─── AUDIT_TRIGGERED ───────────────────────────────────────────────────────

export interface AuditTriggeredEvent extends BaseEvent {
  type: "AUDIT_TRIGGERED";
  payload: {
    auditEventId: string;
    assetId: string;
    triggeredBy: string;
    checksToRun: string[];
    priority: "low" | "normal" | "high";
  };
}

// ─── AUDIT_COMPLETED ───────────────────────────────────────────────────────

export interface AuditCompletedEvent extends BaseEvent {
  type: "AUDIT_COMPLETED";
  payload: {
    auditEventId: string;
    assetId: string;
    status: AuditStatus;
    durationMs: number;
    summary: {
      totalChecks: number;
      passed: number;
      failed: number;
      warnings: number;
    };
  };
}

// ─── RISK_SCORED ───────────────────────────────────────────────────────────

export interface RiskScoredEvent extends BaseEvent {
  type: "RISK_SCORED";
  payload: {
    riskScoreId: string;
    assetId: string;
    auditEventId?: string;
    score: number;
    level: RiskLevel;
    previousScore?: number;
    delta?: number;
  };
}

// ─── OPERATOR_ACTION ───────────────────────────────────────────────────────

export interface OperatorActionEvent extends BaseEvent {
  type: "OPERATOR_ACTION";
  payload: {
    sessionId: string;
    operatorId: string;
    operatorType: "api_key" | "user" | "service";
    actionType: string;
    targetType?: string;
    targetId?: string;
    outcome: "queued" | "success" | "failure";
    metadata?: Record<string, unknown>;
  };
}

// ─── MAINTENANCE_RUN ───────────────────────────────────────────────────────

export interface MaintenanceRunEvent extends BaseEvent {
  type: "MAINTENANCE_RUN";
  payload: {
    jobId: string;
    jobName: string;
    handler: string;
    triggeredBy: "cron" | "manual";
    status: "started" | "completed" | "failed";
    durationMs?: number;
    error?: string;
  };
}

// ─── ALERT_RAISED ──────────────────────────────────────────────────────────

export interface AlertRaisedEvent extends BaseEvent {
  type: "ALERT_RAISED";
  payload: {
    alertId: string;
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    title: string;
    message: string;
    assetId?: string;
    auditEventId?: string;
    riskScoreId?: string;
    requiresAck: boolean;
  };
}

// ─── Union ─────────────────────────────────────────────────────────────────

export type DaccEvent =
  | AssetDiscoveredEvent
  | AuditTriggeredEvent
  | AuditCompletedEvent
  | RiskScoredEvent
  | OperatorActionEvent
  | MaintenanceRunEvent
  | AlertRaisedEvent;

export type EventPayload<T extends DaccEvent> = T["payload"];
