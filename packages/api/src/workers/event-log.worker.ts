import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  prisma,
  createLogger,
  type DaccEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";

const log = createLogger("event-log-worker");

export function startEventLogWorker() {
  const connection = createRedisClient(env.REDIS_URL);

  return createConsumer<DaccEvent>(
    QUEUE_NAMES.EVENT_LOG_PERSIST,
    async (job) => {
      const event = job.data;

      const existing = await prisma.eventLog.findFirst({
        where: { correlationId: event.correlationId, targetId: event.eventId },
      });
      if (existing) return;

      await prisma.eventLog.create({
        data: {
          tenantId: event.tenantId === "system" ? null : event.tenantId,
          eventType: event.type as never,
          sourceSystem: event.sourceSystem,
          targetType: "event",
          targetId: event.eventId,
          correlationId: event.correlationId,
          causationId: event.causationId ?? null,
          payload: event.payload as never,
          meta: {},
          occurredAt: new Date(event.occurredAt),
        },
      });

      log.debug({ eventId: event.eventId, type: event.type }, "Event persisted to log");
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 20 }
  );
}
