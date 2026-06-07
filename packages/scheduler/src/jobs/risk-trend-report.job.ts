import { prisma, createLogger } from "@dacc/core";
import { randomUUID } from "crypto";

const log = createLogger("job:risk-trend-report");

export async function runRiskTrendReport(
  _config: Record<string, unknown> = {}
): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
  });

  for (const tenant of tenants) {
    const [total, high, critical] = await Promise.all([
      prisma.riskScore.count({ where: { tenantId: tenant.id, validUntil: null } }),
      prisma.riskScore.count({ where: { tenantId: tenant.id, validUntil: null, level: "HIGH" } }),
      prisma.riskScore.count({ where: { tenantId: tenant.id, validUntil: null, level: "CRITICAL" } }),
    ]);

    // 7-day average score
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await prisma.riskScore.findMany({
      where: { tenantId: tenant.id, createdAt: { gte: since7d } },
      select: { score: true },
    });
    const avgScore =
      recent.length > 0
        ? recent.reduce((s: number, r: { score: number }) => s + r.score, 0) / recent.length
        : 0;

    await prisma.eventLog.create({
      data: {
        id: randomUUID(),
        tenantId: tenant.id,
        eventType: "MAINTENANCE_RUN",
        sourceSystem: "scheduler",
        correlationId: randomUUID(),
        occurredAt: new Date(),
        payload: {
          reportType: "weekly-risk-trend",
          tenantSlug: tenant.slug,
          totalActiveScores: total,
          highRiskCount: high,
          criticalRiskCount: critical,
          avgRiskScore7d: Math.round(avgScore * 10) / 10,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  }

  log.info({ tenantCount: tenants.length }, "Weekly risk trend report written to event log");
}
