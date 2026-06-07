import {
  prisma,
  createProducer,
  createRedisClient,
  QUEUE_NAMES,
  buildBaseEvent,
  env,
  createLogger,
  type AuditTriggeredEvent,
} from "@dacc/core";
import { randomUUID } from "crypto";

const log = createLogger("job:audit-sweep");

export async function runAuditSweep(config: { batchSize?: number } = {}): Promise<void> {
  const batchSize = config.batchSize ?? 50;
  const producer = createProducer(QUEUE_NAMES.AUDIT_TRIGGER, createRedisClient(env.REDIS_URL) as object);

  const assets = await prisma.digitalAsset.findMany({
    where: { status: "ACTIVE" },
    take: batchSize,
    orderBy: { lastSeenAt: "asc" },
    include: { tenant: { select: { id: true } } },
  });

  let queued = 0;
  for (const asset of assets) {
    const audit = await prisma.auditEvent.create({
      data: {
        tenantId: asset.tenantId,
        assetId: asset.id,
        triggeredBy: "scheduler:audit-sweep",
        status: "QUEUED",
      },
    });

    const event: AuditTriggeredEvent = {
      ...buildBaseEvent(asset.tenantId, "scheduler", randomUUID()),
      type: "AUDIT_TRIGGERED",
      payload: {
        auditEventId: audit.id,
        assetId: asset.id,
        triggeredBy: "scheduler:audit-sweep",
        checksToRun: ["meta-tags", "canonical", "robots", "sitemap", "performance"],
        priority: "low",
      },
    };
    await producer.publish(event, { priority: 10 });
    queued++;
  }

  await producer.close();
  log.info({ queued }, "Audit sweep dispatched");
}
