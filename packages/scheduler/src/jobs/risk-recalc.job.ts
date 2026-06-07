import { prisma, createLogger } from "@dacc/core";

const log = createLogger("job:risk-recalc");

export async function runRiskRecalc(config: { stalenessHours?: number } = {}): Promise<void> {
  const stalenessHours = config.stalenessHours ?? 24;
  const cutoff = new Date(Date.now() - stalenessHours * 60 * 60 * 1000);

  const stale = await prisma.riskScore.findMany({
    where: { validFrom: { lt: cutoff }, validUntil: null },
    select: { id: true, assetId: true, tenantId: true },
    take: 200,
  });

  // Mark stale scores as expired — File 7 (Risk Engine) will recalculate
  await prisma.riskScore.updateMany({
    where: { id: { in: stale.map((s: { id: string }) => s.id) } },
    data: { validUntil: new Date() },
  });

  log.info({ expired: stale.length }, "Stale risk scores marked for recalculation");
}
