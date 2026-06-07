import { randomUUID } from "crypto";

export function newCorrelationId(): string {
  return randomUUID();
}

export function newEventId(): string {
  return randomUUID();
}

export function buildBaseEvent(
  tenantId: string,
  sourceSystem: "operator" | "auditor" | "scheduler" | "api" | "system",
  correlationId?: string,
  causationId?: string
) {
  return {
    eventId: newEventId(),
    correlationId: correlationId ?? newCorrelationId(),
    ...(causationId !== undefined ? { causationId } : {}),
    tenantId,
    sourceSystem,
    occurredAt: new Date().toISOString(),
  };
}
