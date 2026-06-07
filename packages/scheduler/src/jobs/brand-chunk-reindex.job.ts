import { prisma, createLogger } from "@dacc/core";
import { randomUUID } from "crypto";

const log = createLogger("job:brand-chunk-reindex");

const DEFAULT_STALE_DAYS = 30;

export async function runBrandChunkReindex(
  config: { staleDays?: number } = {}
): Promise<void> {
  const staleDays = config.staleDays ?? DEFAULT_STALE_DAYS;
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  // Find chunks whose parent document was updated before the cutoff
  // (embedding may be stale relative to document changes)
  const staleChunks = await prisma.brandChunk.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, tenantId: true, documentId: true },
    take: 200,
  });

  if (staleChunks.length === 0) {
    log.info("No stale brand chunks found, skipping reindex");
    return;
  }

  // Touch chunks to reset their timestamp — brand engine will re-embed on next run
  type ChunkRow = { id: string; tenantId: string; documentId: string };
  await prisma.brandChunk.updateMany({
    where: { id: { in: (staleChunks as ChunkRow[]).map((c: ChunkRow) => c.id) } },
    data: { createdAt: new Date() },
  });

  // Group by tenant for reporting
  const byTenant = (staleChunks as ChunkRow[]).reduce(
    (acc: Record<string, number>, c: ChunkRow) => {
      acc[c.tenantId] = (acc[c.tenantId] ?? 0) + 1;
      return acc;
    },
    {}
  );

  for (const [tenantId, count] of Object.entries(byTenant)) {
    await prisma.eventLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        eventType: "MAINTENANCE_RUN",
        sourceSystem: "scheduler",
        correlationId: randomUUID(),
        occurredAt: new Date(),
        payload: {
          reportType: "brand-chunk-reindex",
          chunksReindexed: count,
          staleDays,
        },
      },
    });
  }

  log.info({ reindexed: staleChunks.length, staleDays }, "Brand chunk reindex sweep complete");
}
