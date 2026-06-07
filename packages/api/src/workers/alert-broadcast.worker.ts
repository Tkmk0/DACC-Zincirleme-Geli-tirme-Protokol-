import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  createLogger,
  type AlertRaisedEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { broadcastToTenant } from "../routes/ws/live-events.js";

const log = createLogger("alert-broadcast-worker");

export function startAlertBroadcastWorker() {
  const connection = createRedisClient(env.REDIS_URL);

  const worker = createConsumer<AlertRaisedEvent>(
    QUEUE_NAMES.ALERT,
    async (job) => {
      const event = job.data;
      log.info(
        { tenantId: event.tenantId, alertId: event.payload.alertId, severity: event.payload.severity },
        "Broadcasting alert to WebSocket clients"
      );
      broadcastToTenant(event.tenantId, {
        type: "ALERT_RAISED",
        ...event.payload,
        occurredAt: event.occurredAt,
      });
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 20 }
  );

  return worker;
}
