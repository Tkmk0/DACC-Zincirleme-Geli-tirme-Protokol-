import type { FastifyPluginAsync } from "fastify";

interface TenantPatchBody {
  slug?: string;
  settings?: Record<string, unknown>;
}

export const tenantsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const tenant = await app.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return reply.send({ tenant });
  });

  app.patch<{ Body: TenantPatchBody }>("/me", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { slug, settings } = req.body ?? {};

    const tenant = await app.db.tenant.update({
      where: { id: tenantId },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(settings !== undefined ? { settings } : {}),
      },
    });

    return reply.send({ tenant });
  });

  app.get("/me/stats", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;

    const [assetCount, auditCount, activeRiskScores] = await Promise.all([
      app.db.digitalAsset.count({ where: { tenantId, status: { not: "ARCHIVED" } } }),
      app.db.auditEvent.count({ where: { tenantId } }),
      app.db.riskScore.count({ where: { tenantId, validUntil: null } }),
    ]);

    return reply.send({ assetCount, auditCount, activeRiskScores });
  });
};
