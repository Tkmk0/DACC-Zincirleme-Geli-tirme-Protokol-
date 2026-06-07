import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  prisma,
  createLogger,
  buildBaseEvent,
  createProducer,
  computeWeightedScore,
  scoreToLevel,
  type AuditTriggeredEvent,
  type RiskScoredEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { CHECK_REGISTRY, ALL_CHECK_NAMES } from "../checks/index.js";

const log = createLogger("shadow-audit.worker");

export function startShadowAuditWorker() {
  const connection = createRedisClient(env.REDIS_URL);
  const logProducer = createProducer(
    QUEUE_NAMES.EVENT_LOG_PERSIST,
    createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions
  );

  return createConsumer<AuditTriggeredEvent>(
    QUEUE_NAMES.SHADOW_AUDIT_TRIGGER,
    async (job) => {
      const event = job.data;
      const { auditEventId, assetId, checksToRun } = event.payload;
      const { tenantId, correlationId } = event;

      log.info({ auditEventId, assetId }, "Shadow audit started");

      const asset = await prisma.digitalAsset.findFirst({
        where: { id: assetId, tenantId },
      });

      if (!asset) {
        log.warn({ assetId, tenantId }, "Asset not found for shadow audit, skipping");
        return;
      }

      // Create shadow AuditEvent (isShadow = true)
      const shadowAudit = await prisma.auditEvent.create({
        data: {
          tenantId,
          assetId,
          triggeredBy: `shadow:${correlationId}`,
          status: "RUNNING",
          startedAt: new Date(),
          isShadow: true,
        },
      });

      const start = Date.now();
      let html = "";

      try {
        const res = await fetch(asset.url, { signal: AbortSignal.timeout(15000) });
        html = await res.text();
      } catch (err) {
        await prisma.auditEvent.update({
          where: { id: shadowAudit.id },
          data: { status: "FAILED", completedAt: new Date(), durationMs: Date.now() - start },
        });
        log.warn({ assetId, error: String(err) }, "Shadow audit fetch failed");
        return;
      }

      const toRun = checksToRun.length > 0 ? checksToRun : ALL_CHECK_NAMES;

      const checkResults = await Promise.all(
        toRun
          .filter((name) => CHECK_REGISTRY[name])
          .map((name) => CHECK_REGISTRY[name]!.run(asset.url, html))
      );

      const { riskScore, factors } = computeWeightedScore(checkResults);
      const level = scoreToLevel(riskScore);
      const durationMs = Date.now() - start;

      const summary = {
        totalChecks: checkResults.length,
        passed: checkResults.filter((r) => r.passed).length,
        failed: checkResults.filter((r) => !r.passed && r.severity === "error").length,
        warnings: checkResults.filter((r) => r.severity === "warning").length,
      };

      await prisma.auditEvent.update({
        where: { id: shadowAudit.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          durationMs,
          checkResults: checkResults as unknown as object,
          summary,
        },
      });

      // Write shadow RiskScore (isShadow = true — does NOT invalidate real scores)
      const shadowRiskRecord = await prisma.riskScore.create({
        data: {
          tenantId,
          assetId,
          auditEventId: shadowAudit.id,
          score: riskScore,
          level,
          factors: factors as unknown as object,
          isShadow: true,
        },
      });

      // Publish to SHADOW_AUDIT_RESULT for downstream comparison
      const resultEvent: RiskScoredEvent = {
        ...buildBaseEvent(tenantId, "auditor", correlationId, event.eventId),
        type: "RISK_SCORED",
        payload: {
          riskScoreId: shadowRiskRecord.id,
          assetId,
          auditEventId: shadowAudit.id,
          score: riskScore,
          level,
        },
      };
      await logProducer.publish(resultEvent);

      log.info(
        { shadowAuditId: shadowAudit.id, assetId, level, score: riskScore, durationMs },
        "Shadow audit completed"
      );
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 2 }
  );
}
