import { prisma, createLogger } from "@dacc/core";

const log = createLogger("job:cleanup");

export async function runCleanup(config: { retentionDays?: number } = {}): Promise<void> {
  const retentionDays = config.retentionDays ?? 90;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.eventLog.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  });

  log.info(
    { deleted: result.count, olderThanDays: retentionDays },
    "Event log cleanup complete"
  );
}
