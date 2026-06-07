import { prisma, createLogger } from "@dacc/core";

const log = createLogger("job:asset-health-check");

const PING_TIMEOUT_MS = 10_000;

export async function runAssetHealthCheck(
  config: { batchSize?: number } = {}
): Promise<void> {
  const batchSize = config.batchSize ?? 100;

  const assets = await prisma.digitalAsset.findMany({
    where: { status: { in: ["ACTIVE", "UNREACHABLE"] } },
    take: batchSize,
    orderBy: { lastSeenAt: "asc" },
    select: { id: true, url: true, tenantId: true, status: true },
  });

  let reachable = 0;
  let unreachable = 0;

  type AssetRow = { id: string; url: string; tenantId: string; status: string };
  await Promise.allSettled(
    assets.map(async (asset: AssetRow) => {
      try {
        const res = await fetch(asset.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(PING_TIMEOUT_MS),
          redirect: "follow",
        });

        if (res.ok || res.status < 500) {
          await prisma.digitalAsset.update({
            where: { id: asset.id },
            data: { status: "ACTIVE", lastSeenAt: new Date() },
          });
          reachable++;
        } else {
          await prisma.digitalAsset.update({
            where: { id: asset.id },
            data: { status: "UNREACHABLE" },
          });
          unreachable++;
        }
      } catch {
        await prisma.digitalAsset.update({
          where: { id: asset.id },
          data: { status: "UNREACHABLE" },
        });
        unreachable++;
      }
    })
  );

  log.info({ checked: assets.length, reachable, unreachable }, "Asset health check complete");
}
