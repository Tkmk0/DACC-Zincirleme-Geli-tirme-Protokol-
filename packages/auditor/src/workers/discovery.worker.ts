import {
  createConsumer,
  createProducer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  prisma,
  buildBaseEvent,
  createLogger,
  type AssetDiscoveredEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import * as cheerio from "cheerio";

const log = createLogger("discovery.worker");

export function startDiscoveryWorker() {
  const connection = createRedisClient(env.REDIS_URL);
  const discoveryProducer = createProducer(
    QUEUE_NAMES.ASSET_DISCOVERY,
    createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions
  );

  return createConsumer<AssetDiscoveredEvent>(
    QUEUE_NAMES.ASSET_DISCOVERY,
    async (job) => {
      const event = job.data;
      const { assetId, url, assetType } = event.payload;
      const { tenantId, correlationId } = event;

      if (assetType !== "URL" && assetType !== "PAGE") return;

      let html: string;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        html = await res.text();
      } catch {
        log.warn({ url }, "Discovery: page unreachable");
        return;
      }

      const $ = cheerio.load(html);
      const baseOrigin = new URL(url).origin;
      const discovered = new Set<string>();

      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href") ?? "";
        try {
          const resolved = new URL(href, url);
          if (resolved.origin === baseOrigin) {
            discovered.add(resolved.href);
          }
        } catch {
          // invalid href
        }
      });

      const existing = await prisma.digitalAsset.findMany({
        where: { tenantId, url: { in: [...discovered] } },
        select: { url: true },
      });
      const existingUrls = new Set(existing.map((a: { url: string }) => a.url));

      for (const newUrl of discovered) {
        if (existingUrls.has(newUrl)) continue;

        const newAsset = await prisma.digitalAsset.create({
          data: {
            tenantId,
            type: "PAGE",
            url: newUrl,
            domain: new URL(newUrl).hostname,
            status: "PENDING",
          },
        });

        const childEvent: AssetDiscoveredEvent = {
          ...buildBaseEvent(tenantId, "auditor", correlationId, event.eventId),
          type: "ASSET_DISCOVERED",
          payload: {
            assetId: newAsset.id,
            url: newUrl,
            domain: new URL(newUrl).hostname,
            assetType: "PAGE",
            discoverySource: "crawler",
          },
        };
        await discoveryProducer.publish(childEvent);
      }

      log.debug(
        { parentAssetId: assetId, discovered: discovered.size, newlyQueued: discovered.size - existingUrls.size },
        "Discovery complete"
      );
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 5 }
  );
}
