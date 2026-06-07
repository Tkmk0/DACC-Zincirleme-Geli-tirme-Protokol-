import { prisma } from "./prisma-client.js";

async function main() {
  await prisma.maintenanceJob.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "audit-sweep",
        description: "Nightly full-site SEO audit sweep for all active tenants",
        cronExpr: "0 2 * * *",
        handler: "auditor:audit-sweep",
        config: { priority: "low", batchSize: 50 },
      },
      {
        name: "risk-recalc",
        description: "Recalculate stale risk scores for assets not updated in 24h",
        cronExpr: "0 4 * * *",
        handler: "auditor:risk-recalc",
        config: { stalenessHours: 24 },
      },
      {
        name: "event-log-cleanup",
        description: "Archive event_log rows older than 90 days",
        cronExpr: "0 3 * * 0",
        handler: "scheduler:cleanup",
        config: { retentionDays: 90 },
      },
      {
        name: "asset-health-check",
        description: "Ping all active/unreachable assets and update status",
        cronExpr: "0 */6 * * *",
        handler: "scheduler:asset-health-check",
        config: { batchSize: 100 },
      },
      {
        name: "risk-trend-report",
        description: "Write weekly risk trend summary to event log for all tenants",
        cronExpr: "0 8 * * 1",
        handler: "scheduler:risk-trend-report",
        config: {},
      },
      {
        name: "brand-chunk-reindex",
        description: "Mark stale brand chunks for re-embedding by the brand engine",
        cronExpr: "0 3 * * 0",
        handler: "scheduler:brand-chunk-reindex",
        config: { staleDays: 30 },
      },
    ],
  });

  console.log("Seed complete — system maintenance jobs registered.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
