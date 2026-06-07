import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "@dacc/core";

interface HistoryQuery {
  limit?: number;
}

interface ApproveBody {
  note?: string;
}

interface SuppressBody {
  hours: number;
}

interface RiskFactor {
  factorName?: string;
  approvedAt?: string;
  suppressedUntil?: string;
  [key: string]: unknown;
}

interface HighRiskEntry {
  id: string;
  assetId: string;
  tenantId: string;
  score: number;
  level: string;
  createdAt: Date;
  validUntil: Date | null;
  factors: unknown;
  asset: { url: string };
}

function getFactors(raw: unknown): RiskFactor[] {
  return Array.isArray(raw) ? (raw as RiskFactor[]) : [];
}

function isApprovedWithin24h(factors: RiskFactor[]): boolean {
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  return factors.some(
    (f) =>
      f.factorName === "approval" &&
      typeof f.approvedAt === "string" &&
      new Date(f.approvedAt).getTime() >= since24h
  );
}

function isSuppressed(factors: RiskFactor[]): boolean {
  return factors.some(
    (f) =>
      f.factorName === "suppression" &&
      typeof f.suppressedUntil === "string" &&
      new Date(f.suppressedUntil).getTime() > Date.now()
  );
}

export const riskRoutes: FastifyPluginAsync = async (app) => {
  // GET /risk/pending-approval — registered before /:assetId to avoid route conflict
  app.get("/pending-approval", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;

    const highRiskScores = (await app.db.riskScore.findMany({
      where: {
        tenantId,
        validUntil: null,
        level: { in: ["HIGH", "CRITICAL"] },
      },
      include: { asset: { select: { url: true } } },
      orderBy: { createdAt: "desc" },
    })) as HighRiskEntry[];

    const pending = highRiskScores
      .filter((rs: HighRiskEntry) => {
        const factors = getFactors(rs.factors);
        return !isApprovedWithin24h(factors) && !isSuppressed(factors);
      })
      .map((rs: HighRiskEntry) => ({
        assetId: rs.assetId,
        url: rs.asset.url,
        score: rs.score,
        level: rs.level,
        createdAt: rs.createdAt,
      }));

    return reply.send({ assets: pending });
  });

  app.get<{ Params: { assetId: string } }>("/:assetId", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { assetId } = req.params;

    const asset = await app.db.digitalAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    const riskScore = await app.db.riskScore.findFirst({
      where: { assetId, tenantId, validUntil: null },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ riskScore });
  });

  app.get<{ Params: { assetId: string }; Querystring: HistoryQuery }>("/:assetId/history", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { assetId } = req.params;
    const limit = Number(req.query.limit ?? 20);

    const asset = await app.db.digitalAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    const history = await app.db.riskScore.findMany({
      where: { assetId, tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return reply.send({ history });
  });

  app.post<{ Params: { assetId: string }; Body: ApproveBody }>("/:assetId/approve", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { assetId } = req.params;
    const note = req.body?.note;

    const asset = await app.db.digitalAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    const currentScore = await app.db.riskScore.findFirst({
      where: { assetId, tenantId, validUntil: null },
    });

    if (currentScore) {
      const factors = getFactors(currentScore.factors);
      const updated: RiskFactor[] = [
        ...factors,
        {
          factorName: "approval",
          approvedAt: new Date().toISOString(),
          approvedBy: tenantId,
          note: note ?? null,
        },
      ];
      await app.db.riskScore.update({
        where: { id: currentScore.id },
        data: { factors: updated as unknown as object },
      });
    }

    return reply.send({ approved: true });
  });

  app.post<{ Params: { assetId: string }; Body: SuppressBody }>("/:assetId/suppress", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { assetId } = req.params;
    const hours = Math.min(72, Math.max(1, Number(req.body?.hours ?? 24)));

    const asset = await app.db.digitalAsset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundError("Asset not found");

    const currentScore = await app.db.riskScore.findFirst({
      where: { assetId, tenantId, validUntil: null },
    });

    if (!currentScore) {
      return reply.status(404).send({ error: "No active risk score found" });
    }

    const suppressedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    const factors = getFactors(currentScore.factors);
    const updated: RiskFactor[] = [
      ...factors,
      { factorName: "suppression", suppressedUntil: suppressedUntil.toISOString() },
    ];

    await app.db.riskScore.update({
      where: { id: currentScore.id },
      data: { factors: updated as unknown as object },
    });

    return reply.send({ suppressedUntil });
  });
};
