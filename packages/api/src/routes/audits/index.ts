import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, generateAuditReport, type CheckResult } from "@dacc/core";

interface AuditListQuery {
  assetId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const auditsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: AuditListQuery }>("/", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { assetId, status, limit = 20, offset = 0 } = req.query;

    const [audits, total] = await Promise.all([
      app.db.auditEvent.findMany({
        where: {
          tenantId,
          ...(assetId !== undefined ? { assetId } : {}),
          ...(status !== undefined ? { status: status as never } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      app.db.auditEvent.count({
        where: {
          tenantId,
          ...(assetId !== undefined ? { assetId } : {}),
          ...(status !== undefined ? { status: status as never } : {}),
        },
      }),
    ]);

    return reply.send({ audits, total });
  });

  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const audit = await app.db.auditEvent.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!audit) throw new NotFoundError("Audit not found");
    return reply.send({ audit });
  });

  app.get<{ Params: { id: string } }>("/:id/report", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const audit = await app.db.auditEvent.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!audit) throw new NotFoundError("Audit not found");

    const checkResults = (audit.checkResults ?? []) as unknown as CheckResult[];
    const report = generateAuditReport(checkResults);

    return reply.send({ report });
  });
};
