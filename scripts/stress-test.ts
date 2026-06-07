import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const API_URL = process.env["API_URL"] ?? "http://localhost:3000";
const API_KEY = process.env["STRESS_API_KEY"] ?? "";
const BATCH_SIZE = parseInt(process.env["BATCH_SIZE"] ?? "20", 10);
const CONCURRENCY = parseInt(process.env["CONCURRENCY"] ?? "5", 10);

const TEST_URLS = [
  "https://example.com",
  "https://www.google.com",
  "https://github.com",
  "https://stackoverflow.com",
  "https://developer.mozilla.org",
];

interface ScanResult {
  url: string;
  auditEventId?: string;
  durationMs: number;
  error?: string;
}

async function triggerScan(url: string, tenantId: string): Promise<ScanResult> {
  const start = Date.now();
  const correlationId = randomUUID();

  try {
    // Create asset first
    const assetRes = await fetch(`${API_URL}/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Correlation-Id": correlationId,
      },
      body: JSON.stringify({ url, type: "URL" }),
      signal: AbortSignal.timeout(10000),
    });

    if (!assetRes.ok) {
      return { url, durationMs: Date.now() - start, error: `Asset create failed: ${assetRes.status}` };
    }

    const { asset } = (await assetRes.json()) as { asset: { id: string } };

    // Trigger scan
    const scanRes = await fetch(`${API_URL}/assets/${asset.id}/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({ priority: "normal" }),
      signal: AbortSignal.timeout(10000),
    });

    if (!scanRes.ok) {
      return { url, durationMs: Date.now() - start, error: `Scan failed: ${scanRes.status}` };
    }

    const { auditEventId } = (await scanRes.json()) as { auditEventId: string };
    return { url, auditEventId, durationMs: Date.now() - start };
  } catch (err) {
    return { url, durationMs: Date.now() - start, error: String(err) };
  }
}

async function runBatch(urls: string[], tenantId: string): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  // Process in chunks of CONCURRENCY
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((url) => triggerScan(url, tenantId)));
    results.push(...chunkResults);
    process.stdout.write(`\r  Progress: ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length}`);
  }
  console.log("");
  return results;
}

function computePercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function main() {
  console.log("DACC Stress Test");
  console.log("================");
  console.log(`  Target: ${API_URL}`);
  console.log(`  Batch:  ${BATCH_SIZE} scans, ${CONCURRENCY} concurrent`);
  console.log("");

  if (!API_KEY) {
    console.error("STRESS_API_KEY env var required. Set it to a valid API key.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const tenantId = randomUUID();

  // Build URL list (cycle through test URLs)
  const urls: string[] = Array.from({ length: BATCH_SIZE }, (_, i) => {
    const base = TEST_URLS[i % TEST_URLS.length]!;
    return `${base}?stress=${randomUUID().slice(0, 8)}`;
  });

  console.log("Running scans...");
  const overall = Date.now();
  const results = await runBatch(urls, tenantId);
  const totalDuration = Date.now() - overall;

  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const durations = successful.map((r) => r.durationMs);

  const p50 = computePercentile(durations, 50);
  const p95 = computePercentile(durations, 95);
  const p99 = computePercentile(durations, 99);
  const errorRate = (failed.length / results.length) * 100;

  console.log("Results");
  console.log("-------");
  console.log(`  Total scans:   ${results.length}`);
  console.log(`  Successful:    ${successful.length}`);
  console.log(`  Failed:        ${failed.length}`);
  console.log(`  Error rate:    ${errorRate.toFixed(1)}%`);
  console.log(`  Total time:    ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  p50 latency:   ${p50}ms`);
  console.log(`  p95 latency:   ${p95}ms`);
  console.log(`  p99 latency:   ${p99}ms`);
  console.log("");

  // Target: p95 < 5000ms, errorRate < 1%
  const p95Pass = p95 < 5000;
  const errorPass = errorRate < 1;

  console.log("Thresholds");
  console.log("----------");
  console.log(`  p95 < 5000ms:   ${p95Pass ? "PASS ✓" : `FAIL ✗ (${p95}ms)`}`);
  console.log(`  Error rate < 1%: ${errorPass ? "PASS ✓" : `FAIL ✗ (${errorRate.toFixed(1)}%)`}`);

  if (failed.length > 0) {
    console.log("\nSample failures:");
    failed.slice(0, 3).forEach((f) => console.log(`  - ${f.url}: ${f.error}`));
  }

  await prisma.$disconnect();
  process.exit(p95Pass && errorPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Stress test error:", err);
  process.exit(1);
});
