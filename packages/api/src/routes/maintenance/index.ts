import type { FastifyPluginAsync } from "fastify";
import {
  NotFoundError,
  QUEUE_NAMES,
  createProducer,
  createRedisClient,
  buildBaseEvent,
  env,
  type MaintenanceRunEvent,
} from "@dacc/core";

interface PatchJobBody {
  cronExpr?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export const maintenanceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/jobs", {
    preHandler: [app.authenticate],
  }, async (_req, reply) => {
    const jobs = await app.db.maintenanceJob.findMany({
      orderBy: { name: "asc" },
    });
    return reply.send({ jobs });
  });

  app.patch<{ Params: { id: string }; Body: PatchJobBody }>("/jobs/:id", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { id } = req.params;
    const { cronExpr, enabled, config } = req.body ?? {};

    const job = await app.db.maintenanceJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Maintenance job not found");

    const updated = await app.db.maintenanceJob.update({
      where: { id },
      data: {
        ...(cronExpr !== undefined ? { cronExpr } : {}),
        ...(enabled !== undefined ? { status: enabled ? "ENABLED" : "DISABLED" } : {}),
        ...(config !== undefined ? { config: config as unknown as object } : {}),
      },
    });

    return reply.send({ job: updated });
  });

  app.post<{ Params: { id: string } }>("/jobs/:id/run", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { id } = req.params;

    const job = await app.db.maintenanceJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Maintenance job not found");

    const producer = createProducer(
      QUEUE_NAMES.MAINTENANCE,
      createRedisClient(env.REDIS_URL) as object
    );

    const event: MaintenanceRunEvent = {
      ...buildBaseEvent(tenantId, "api"),
      type: "MAINTENANCE_RUN",
      payload: {
        jobId: job.id,
        jobName: job.name,
        handler: job.handler,
        triggeredBy: "manual",
        status: "started",
      },
    };
    await producer.publish(event);
    await producer.close();

    return reply.status(202).send({ accepted: true, jobId: job.id, handler: job.handler });
  });

  app.get("/history", {
    preHandler: [app.authenticate],
  }, async (_req, reply) => {
    const history = await app.db.eventLog.findMany({
      where: { eventType: "MAINTENANCE_RUN" },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });
    return reply.send({ history });
  });
};
