import type { FastifyPluginAsync } from "fastify";
import { QUEUE_NAMES, createRedisClient, env } from "@dacc/core";
import { Queue, type ConnectionOptions } from "bullmq";
import { requireScope } from "../../plugins/auth.plugin.js";

interface LogStreamQuery {
  tenantId?: string;
  limit?: number;
}

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.get("/queues", {
    preHandler: [app.authenticate, requireScope("admin")],
  }, async (_req, reply) => {
    const redis = createRedisClient(env.REDIS_URL);
    const result: Record<string, Record<string, number>> = {};

    try {
      for (const [name, queueName] of Object.entries(QUEUE_NAMES)) {
        const q = new Queue(queueName, { connection: redis as unknown as ConnectionOptions });
        result[name] = await q.getJobCounts("waiting", "active", "failed", "completed");
        await q.close();
      }
    } finally {
      await redis.quit();
    }

    return reply.send({ queues: result });
  });

  app.get<{ Querystring: LogStreamQuery }>("/logs/stream", {
    preHandler: [app.authenticate, requireScope("admin")],
  }, async (req, reply) => {
    const tenantId = req.query.tenantId ?? req.principal.tenantId;
    const limit = Number(req.query.limit ?? 100);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Initial batch
    const initial = await app.db.eventLog.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    initial.reverse().forEach((row: unknown) => send(row));

    let lastId = initial[initial.length - 1]?.id ?? "";

    const timer = setInterval(async () => {
      try {
        const rows = await app.db.eventLog.findMany({
          where: {
            tenantId,
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          orderBy: { occurredAt: "asc" },
          take: 50,
        });

        for (const row of rows) {
          send(row);
          lastId = row.id;
        }
      } catch {
        // ignore poll errors — client may have disconnected
      }
    }, 2000);

    reply.raw.on("close", () => {
      clearInterval(timer);
    });

    // Keep connection open (Fastify needs a promise)
    await new Promise<void>((resolve) => {
      reply.raw.on("close", resolve);
    });
  });
};
