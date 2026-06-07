export const QUEUE_NAMES = {
  ASSET_DISCOVERY: "dacc:asset:discovery",
  AUDIT_TRIGGER: "dacc:audit:trigger",
  AUDIT_RESULT: "dacc:audit:result",
  RISK_SCORING: "dacc:risk:scoring",
  OPERATOR_ACTION: "dacc:operator:action",
  MAINTENANCE: "dacc:maintenance:run",
  ALERT: "dacc:alert:raised",
  EVENT_LOG_PERSIST: "dacc:eventlog:persist",

  // Sandbox Engine
  SANDBOX_SNAPSHOT: "dacc:sandbox:snapshot",
  SANDBOX_ROLLBACK: "dacc:sandbox:rollback",

  // Shadow Testing
  SHADOW_AUDIT_TRIGGER: "dacc:shadow:audit:trigger",
  SHADOW_AUDIT_RESULT: "dacc:shadow:audit:result",
  SHADOW_RISK_SCORING: "dacc:shadow:risk:scoring",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
