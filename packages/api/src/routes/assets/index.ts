import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, createProducer, createRedisClient, QUEUE_NAMES, buildBaseEvent, env, type AuditTriggeredEvent } from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { randomUUID } from "crypto";

interface AssetListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

interface AssetCreateBody {
  url: string;
  type?: "URL" | "PAGE" | "DOMAIN";
}

interface ScanBody {
  priority?: "low" | "normal" | "high";
  checksToRun?: string[];
}

export const assetsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: AssetListQuery }>("/", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { status, limit = 20, offset = 0 } = req.query;

    const [assets, total] = await Promise.all([
      app.db.digitalAsset.findMany({
        where: {
          tenantId,
          ...(status !== undefined ? { status: status as never } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      app.db.digitalAsset.count({
        where: {
          tenantId,
          ...(status !== undefined ? { status: status as never } : {}),
        },
      }),
    ]);

    return reply.send({ assets, total });
  });

  app.post<{ Body: AssetCreateBody }>("/", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { url, type = "URL" } = req.body;

    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: "Invalid URL" });
    }

    const domain = new URL(url).hostname;
    const asset = await app.db.digitalAsset.upsert({
      where: { tenantId_url: { tenantId, url } },
      create: { tenantId, type, url, domain, status: "PENDING" },
      update: { lastSeenAt: new Date() },
    });

    return reply.status(201).send({ asset });
  });

  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { id } = req.params;

    const asset = await app.db.digitalAsset.findFirst({
      where: { id, tenantId },
    });
    if (!asset) throw new NotFoundError("Asset not found");

    const riskScore = await app.db.riskScore.findFirst({
      where: { assetId: id, tenantId, validUntil: null },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ asset, riskScore });
  });

  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { id } = req.params;

    const asset = await app.db.digitalAsset.findFirst({ where: { id, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    await app.db.digitalAsset.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return reply.status(204).send();
  });

  app.post<{ Params: { id: string }; Body: ScanBody }>("/:id/scan", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { id } = req.params;
    const { priority = "normal", checksToRun = [] } = req.body ?? {};

    const asset = await app.db.digitalAsset.findFirst({ where: { id, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    const auditEvent = await app.db.auditEvent.create({
      data: {
        tenantId,
        assetId: id,
        triggeredBy: `api:${tenantId}`,
        status: "QUEUED",
      },
    });

    const correlationId = randomUUID();
    const producer = createProducer(
      QUEUE_NAMES.AUDIT_TRIGGER,
      createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions
    );

    const event: AuditTriggeredEvent = {
      ...buildBaseEvent(tenantId, "api", correlationId),
      type: "AUDIT_TRIGGERED",
      payload: {
        auditEventId: auditEvent.id,
        assetId: id,
        triggeredBy: `api:${tenantId}`,
        checksToRun,
        priority,
      },
    };

    await producer.publish(event, {
      priority: priority === "high" ? 1 : priority === "normal" ? 5 : 10,
    });

    return reply.status(202).send({ auditEventId: auditEvent.id });
  });
};
