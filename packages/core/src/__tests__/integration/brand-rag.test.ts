import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../db/prisma-client.js";
import { generateAuditReport, computeWeightedScore } from "../../index.js";
import { randomUUID } from "crypto";

let tenantId: string;

async function isDbAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("Brand RAG: audit report generation and compliance scoring", () => {
  beforeAll(async () => {
    if (!(await isDbAvailable())) return;

    tenantId = randomUUID();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        slug: `test-brand-${tenantId.slice(0, 8)}`,
        displayName: "Brand RAG Test Tenant",
      },
    });
  });

  afterAll(async () => {
    if (!tenantId) return;
    await prisma.brandQuery.deleteMany({ where: { tenantId } });
    await prisma.brandDocument.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("generates audit report with grade from check results", () => {
    const checkResults = [
      { checkName: "meta-tags", passed: true, severity: "info" as const, score: 100, details: {} },
      { checkName: "canonical", passed: true, severity: "info" as const, score: 90, details: {} },
      { checkName: "robots", passed: false, severity: "warning" as const, score: 50, details: {} },
      { checkName: "structured-data", passed: false, severity: "error" as const, score: 0, details: {} },
    ];

    const report = generateAuditReport(checkResults);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it("weighted score factors reflect check outcomes", () => {
    const allPassed = [
      { checkName: "meta-tags", passed: true, severity: "info" as const, score: 100, details: {} },
      { checkName: "canonical", passed: true, severity: "info" as const, score: 100, details: {} },
    ];
    const allFailed = [
      { checkName: "meta-tags", passed: false, severity: "error" as const, score: 0, details: {} },
      { checkName: "canonical", passed: false, severity: "error" as const, score: 0, details: {} },
    ];

    const { riskScore: passedScore } = computeWeightedScore(allPassed);
    const { riskScore: failedScore } = computeWeightedScore(allFailed);

    // Failed checks should produce higher risk score
    expect(failedScore).toBeGreaterThan(passedScore);
  });

  it("creates brand document and query records in DB", async () => {
    if (!(await isDbAvailable())) {
      console.warn("DB not available — skipping DB assertion");
      return;
    }

    const doc = await prisma.brandDocument.create({
      data: {
        tenantId,
        type: "CONTENT_POLICY",
        title: "Test Brand Policy",
        content: "Our brand voice is professional, clear, and helpful.",
      },
    });
    expect(doc.id).toBeDefined();
    expect(doc.chunksGenerated).toBe(false);

    const query = await prisma.brandQuery.create({
      data: {
        tenantId,
        documentId: doc.id,
        queryText: "What is our brand voice?",
        retrievedChunkIds: [],
        status: "COMPLETED",
        response: "Professional, clear, and helpful.",
        isCompliant: true,
        complianceScore: 0.95,
      },
    });
    expect(query.isCompliant).toBe(true);
    expect(query.complianceScore).toBeCloseTo(0.95);
  });
});
