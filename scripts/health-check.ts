import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

const DB_URL = process.env["DATABASE_URL"] ?? "postgresql://dacc:dacc@localhost:5432/dacc";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const API_URL = process.env["API_URL"] ?? "http://localhost:3000";

interface CheckResult {
  name: string;
  status: "ok" | "fail";
  detail?: string;
  latencyMs?: number;
}

async function checkDatabase(): Promise<CheckResult> {
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenantCount = await prisma.tenant.count();
    return { name: "PostgreSQL", status: "ok", detail: `${tenantCount} tenants`, latencyMs: Date.now() - start };
  } catch (err) {
    return { name: "PostgreSQL", status: "fail", detail: String(err) };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkRedis(): Promise<CheckResult> {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });
  const start = Date.now();
  try {
    await redis.connect();
    const pong = await redis.ping();
    return { name: "Redis", status: pong === "PONG" ? "ok" : "fail", detail: pong, latencyMs: Date.now() - start };
  } catch (err) {
    return { name: "Redis", status: "fail", detail: String(err) };
  } finally {
    redis.disconnect();
  }
}

async function checkApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json()) as { status: string };
    return {
      name: "API",
      status: res.ok && body.status === "ok" ? "ok" : "fail",
      detail: `HTTP ${res.status}`,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return { name: "API", status: "fail", detail: String(err) };
  }
}

async function main() {
  console.log("DACC System Health Check");
  console.log("========================");

  const results = await Promise.all([checkDatabase(), checkRedis(), checkApi()]);

  let allOk = true;
  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : "✗";
    const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : "";
    console.log(`  ${icon} ${r.name.padEnd(15)} ${r.status.toUpperCase()}${latency}${r.detail ? ` — ${r.detail}` : ""}`);
    if (r.status !== "ok") allOk = false;
  }

  console.log("");
  console.log(`Overall: ${allOk ? "HEALTHY ✓" : "DEGRADED ✗"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Health check error:", err);
  process.exit(1);
});
