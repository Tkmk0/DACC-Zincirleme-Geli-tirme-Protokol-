// Database
export { prisma } from "./db/prisma-client.js";

// Events
export { createProducer, createConsumer } from "./events/event-bus.js";
export { QUEUE_NAMES } from "./events/queue-names.js";
export type { QueueName } from "./events/queue-names.js";
export type {
  DaccEvent,
  BaseEvent,
  AssetDiscoveredEvent,
  AuditTriggeredEvent,
  AuditCompletedEvent,
  RiskScoredEvent,
  OperatorActionEvent,
  MaintenanceRunEvent,
  AlertRaisedEvent,
  EventPayload,
} from "./events/event-types.js";

// Types
export type { TenantContext } from "./types/tenant.js";
export type {
  JwtPayload,
  ApiKeyPayload,
  AuthPrincipal,
} from "./types/auth.js";
export { isJwtPayload, isApiKeyPayload } from "./types/auth.js";
export type {
  RiskFactor,
  CheckResult,
  RiskCalculationInput,
  RiskCalculationOutput,
} from "./types/risk.js";
export { scoreToLevel } from "./types/risk.js";
export type { AssetMetadata } from "./types/asset.js";
export type { AuditSummary, AuditCheckResult } from "./types/audit.js";
export type { OperatorAction } from "./types/operator.js";

// Scoring & Reports
export { computeWeightedScore } from "./scoring/weighted-score.js";
export type { WeightedScoreResult } from "./scoring/weighted-score.js";
export { generateAuditReport } from "./reports/audit-report.js";
export type { AuditReport, AuditGrade, AuditRecommendation } from "./reports/audit-report.js";

// Config
export { env } from "./config/env.js";

// Utils
export { createLogger, rootLogger } from "./utils/logger.js";
export { createRedisClient } from "./utils/redis-client.js";
export {
  newCorrelationId,
  newEventId,
  buildBaseEvent,
} from "./utils/correlation.js";
export {
  DaccError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from "./utils/errors.js";

// Sandbox — Snapshot & Rollback Engine (Phase 9)
export {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  pruneSnapshots,
} from "./sandbox/snapshot-engine.js";
export type {
  Snapshot,
  SnapshotState,
  CreateSnapshotOptions,
} from "./sandbox/snapshot-engine.js";
export {
  rollbackToSnapshot,
  validateRollbackTarget,
} from "./sandbox/rollback-manager.js";
export type {
  RollbackResult,
  RollbackOptions,
} from "./sandbox/rollback-manager.js";
export { createSandboxLifecycle } from "./sandbox/sandbox-lifecycle.js";
export type {
  SandboxLifecycle,
  SandboxPhase,
  SandboxStatus,
  LifecycleConfig,
} from "./sandbox/sandbox-lifecycle.js";

// Shadow — Testing & Validation Suite (Phase 10)
export { createShadowRunner } from "./shadow/shadow-runner.js";
export type {
  ShadowRunner,
  ShadowAuditRequest,
  ShadowAuditResult,
  ShadowRunnerConfig,
} from "./shadow/shadow-runner.js";
export {
  compareAuditResults,
} from "./shadow/comparator.js";
export type {
  ComparisonResult,
  ComparisonSummary,
  DivergentCheck,
  CheckResultEntry,
  ComparisonOptions,
} from "./shadow/comparator.js";
export {
  runValidationSuite,
  validateSinglePair,
} from "./shadow/validation-suite.js";
export type {
  ValidationReport,
  ValidationSuiteConfig,
} from "./shadow/validation-suite.js";

