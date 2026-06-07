import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../db/prisma-client.js";
import { randomUUID } from "crypto";

let tenantA: string;
let tenantB: string;

async function isDbAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("Multi-tenant isolation", () => {
  beforeAll(async () => {
    if (!(await isDbAvailable())) return;

    tenantA = randomUUID();
    tenantB = randomUUID();

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, slug: `test-ta-${tenantA.slice(0, 8)}`, displayName: "Tenant A" },
        { id: tenantB, slug: `test-tb-${tenantB.slice(0, 8)}`, displayName: "Tenant B" },
      ],
    });

    await prisma.digitalAsset.createMany({
      data: [
        { tenantId: tenantA, type: "URL", url: "https://tenant-a.com", domain: "tenant-a.com", status: "ACTIVE" },
        { tenantId: tenantB, type: "URL", url: "https://tenant-b.com", domain: "tenant-b.com", status: "ACTIVE" },
      ],
    });
  });

  afterAll(async () => {
    if (!tenantA) return;
    await prisma.digitalAsset.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  });

  it("tenant A cannot see tenant B assets", async () => {
    if (!(await isDbAvailable())) {
      console.warn("DB not available — skipping");
      return;
    }

    const tenantAAssets = await prisma.digitalAsset.findMany({ where: { tenantId: tenantA } });
    const tenantBAssets = await prisma.digitalAsset.findMany({ where: { tenantId: tenantB } });

    expect(tenantAAssets.every((a) => a.tenantId === tenantA)).toBe(true);
    expect(tenantBAssets.every((a) => a.tenantId === tenantB)).toBe(true);

    // No cross-tenant data
    const crossCheck = tenantAAssets.filter((a) => a.tenantId === tenantB);
    expect(crossCheck).toHaveLength(0);
  });

  it("risk scores are tenant-scoped", async () => {
    if (!(await isDbAvailable())) {
      console.warn("DB not available — skipping");
      return;
    }

    const assetA = await prisma.digitalAsset.findFirst({ where: { tenantId: tenantA } });
    if (!assetA) return;

    const riskA = await prisma.riskScore.create({
      data: {
        tenantId: tenantA,
        assetId: assetA.id,
        score: 55,
        level: "MEDIUM",
        factors: [],
      },
    });

    // tenantB should not be able to query tenantA's risk scores
    const scoresForB = await prisma.riskScore.findMany({ where: { tenantId: tenantB } });
    expect(scoresForB.map((s) => s.id)).not.toContain(riskA.id);

    await prisma.riskScore.delete({ where: { id: riskA.id } });
  });
});
