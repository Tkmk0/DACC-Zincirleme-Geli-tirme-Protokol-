import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  prisma,
  createLogger,
  buildBaseEvent,
  type AuditTriggeredEvent,
  type AuditCompletedEvent,
  type RiskScoredEvent,
  type AlertRaisedEvent,
  scoreToLevel,
  createProducer,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { CHECK_REGISTRY, ALL_CHECK_NAMES } from "../checks/index.js";
import { computeWeightedScore } from "@dacc/core";
import { randomUUID } from "crypto";

const log = createLogger("audit.worker");

export function startAuditWorker() {
  const connection = createRedisClient(env.REDIS_URL);
  const riskProducer = createProducer(QUEUE_NAMES.RISK_SCORING, createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions);
  const alertProducer = createProducer(QUEUE_NAMES.ALERT, createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions);
  const logProducer = createProducer(QUEUE_NAMES.EVENT_LOG_PERSIST, createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions);

  return createConsumer<AuditTriggeredEvent>(
    QUEUE_NAMES.AUDIT_TRIGGER,
    async (job) => {
      const event = job.data;
      const { auditEventId, assetId, checksToRun, triggeredBy } = event.payload;
      const { tenantId, correlationId } = event;

      await prisma.auditEvent.update({
        where: { id: auditEventId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      const asset = await prisma.digitalAsset.findUniqueOrThrow({
        where: { id: assetId },
      });

      const start = Date.now();
      let html = "";

      try {
        const res = await fetch(asset.url, { signal: AbortSignal.timeout(15000) });
        html = await res.text();
      } catch (err) {
        await prisma.auditEvent.update({
          where: { id: auditEventId },
          data: { status: "FAILED", completedAt: new Date(), durationMs: Date.now() - start },
        });
        throw err;
      }

      // Run requested checks; default to all registered checks if none specified
      const toRun = checksToRun.length > 0 ? checksToRun : ALL_CHECK_NAMES;

      const checkResults = await Promise.all(
        toRun
          .filter((name) => CHECK_REGISTRY[name])
          .map((name) => CHECK_REGISTRY[name]!.run(asset.url, html))
      );

      const { riskScore, factors } = computeWeightedScore(checkResults);
      const level = scoreToLevel(riskScore);

      const summary = {
        totalChecks: checkResults.length,
        passed: checkResults.filter((r) => r.passed).length,
        failed: checkResults.filter((r) => !r.passed && r.severity === "error").length,
        warnings: checkResults.filter((r) => r.severity === "warning").length,
      };

      const durationMs = Date.now() - start;

      await prisma.auditEvent.update({
        where: { id: auditEventId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          durationMs,
          checkResults: checkResults as unknown as object,
          summary,
        },
      });

      // Invalidate previous risk score (set validUntil)
      await prisma.riskScore.updateMany({
        where: { assetId, tenantId, validUntil: null },
        data: { validUntil: new Date() },
      });

      const riskRecord = await prisma.riskScore.create({
        data: {
          tenantId,
          assetId,
          auditEventId,
          score: riskScore,
          level,
          factors: factors as unknown as object,
        },
      });

      // Publish events
      const completedEvent: AuditCompletedEvent = {
        ...buildBaseEvent(tenantId, "auditor", correlationId, event.eventId),
        type: "AUDIT_COMPLETED",
        payload: { auditEventId, assetId, status: "COMPLETED", durationMs, summary },
      };
      await logProducer.publish(completedEvent);

      const riskEvent: RiskScoredEvent = {
        ...buildBaseEvent(tenantId, "auditor", correlationId, event.eventId),
        type: "RISK_SCORED",
        payload: {
          riskScoreId: riskRecord.id,
          assetId,
          auditEventId,
          score: riskScore,
          level,
        },
      };
      await riskProducer.publish(riskEvent);

      if (level === "HIGH" || level === "CRITICAL") {
        const alertEvent: AlertRaisedEvent = {
          ...buildBaseEvent(tenantId, "auditor", correlationId, event.eventId),
          type: "ALERT_RAISED",
          payload: {
            alertId: randomUUID(),
            severity: level === "CRITICAL" ? "CRITICAL" : "ERROR",
            title: `${level} risk detected`,
            message: `Asset ${asset.url} scored ${riskScore.toFixed(1)} risk`,
            assetId,
            auditEventId,
            riskScoreId: riskRecord.id,
            requiresAck: level === "CRITICAL",
          },
        };
        await alertProducer.publish(alertEvent);
      }

      log.info({ auditEventId, assetId, level, score: riskScore }, "Audit completed");
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 3 }
  );
}
