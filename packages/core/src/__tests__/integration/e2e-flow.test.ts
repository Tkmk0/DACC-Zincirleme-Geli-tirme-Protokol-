import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../db/prisma-client.js";
import { scoreToLevel, computeWeightedScore } from "../../index.js";
import { randomUUID } from "crypto";

let tenantId: string;
let assetId: string;

async function isDbAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("E2E flow: Audit → Risk → Alert", () => {
  beforeAll(async () => {
    if (!(await isDbAvailable())) return;

    tenantId = randomUUID();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        slug: `test-e2e-${tenantId.slice(0, 8)}`,
        displayName: "E2E Test Tenant",
      },
    });

    const asset = await prisma.digitalAsset.create({
      data: {
        tenantId,
        type: "URL",
        url: "https://example.com",
        domain: "example.com",
        status: "ACTIVE",
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    if (!tenantId) return;
    await prisma.riskScore.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.digitalAsset.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("score thresholds map to correct risk levels", () => {
    expect(scoreToLevel(0)).toBe("NONE");
    expect(scoreToLevel(10)).toBe("LOW");
    expect(scoreToLevel(30)).toBe("MEDIUM");
    expect(scoreToLevel(60)).toBe("HIGH");
    expect(scoreToLevel(80)).toBe("CRITICAL");
  });

  it("computeWeightedScore returns normalized score and factors", () => {
    const checkResults = [
      { checkName: "meta-tags", passed: true, severity: "info" as const, score: 90, details: {} },
      { checkName: "canonical", passed: false, severity: "error" as const, score: 0, details: {} },
      { checkName: "robots", passed: true, severity: "info" as const, score: 80, details: {} },
    ];
    const { riskScore, factors } = computeWeightedScore(checkResults);
    expect(riskScore).toBeGreaterThanOrEqual(0);
    expect(riskScore).toBeLessThanOrEqual(100);
    expect(factors.length).toBeGreaterThan(0);
  });

  it("creates audit event and risk score in DB", async () => {
    if (!(await isDbAvailable())) {
      console.warn("DB not available — skipping DB assertion");
      return;
    }

    const auditEvent = await prisma.auditEvent.create({
      data: {
        tenantId,
        assetId,
        triggeredBy: "test:e2e",
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 500,
        checkResults: [],
        summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0 },
      },
    });
    expect(auditEvent.id).toBeDefined();

    const riskRecord = await prisma.riskScore.create({
      data: {
        tenantId,
        assetId,
        auditEventId: auditEvent.id,
        score: 65,
        level: "HIGH",
        factors: [],
      },
    });
    expect(riskRecord.level).toBe("HIGH");
    expect(riskRecord.isShadow).toBe(false);
  });
});
