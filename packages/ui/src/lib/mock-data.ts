export const DEMO_KEY = "dacc-demo-2025";

const MOCK_ASSET_DEFAULT = { id: "a1", url: "https://example.com", status: "ACTIVE", createdAt: "2025-01-10T10:00:00Z", riskScore: { level: "LOW", score: 22 } };

const MOCK_ASSETS = [
  MOCK_ASSET_DEFAULT,
  { id: "a2", url: "https://shop.example.com", status: "ACTIVE", createdAt: "2025-02-14T08:30:00Z", riskScore: { level: "MEDIUM", score: 55 } },
  { id: "a3", url: "https://blog.example.com", status: "ACTIVE", createdAt: "2025-03-01T12:00:00Z", riskScore: { level: "HIGH", score: 73 } },
  { id: "a4", url: "https://docs.example.com", status: "PENDING", createdAt: "2025-04-05T09:00:00Z", riskScore: null },
  { id: "a5", url: "https://api.example.com", status: "ACTIVE", createdAt: "2025-05-20T15:00:00Z", riskScore: { level: "CRITICAL", score: 91 } },
];

const MOCK_AUDIT_DEFAULT = {
  id: "au1",
  assetId: "a1",
  status: "COMPLETED",
  startedAt: "2025-06-01T10:00:00Z",
  completedAt: "2025-06-01T10:00:45Z",
  score: 78,
  checkResults: [
    { checkId: "meta-tags", score: 90, passed: true, details: "Title and description present" },
    { checkId: "canonical", score: 100, passed: true, details: "Canonical URL set correctly" },
    { checkId: "robots", score: 80, passed: true, details: "robots.txt accessible" },
    { checkId: "structured-data", score: 60, passed: false, details: "Missing Organization schema" },
    { checkId: "open-graph", score: 70, passed: false, details: "og:image missing" },
    { checkId: "heading-hierarchy", score: 85, passed: true, details: "H1 unique, hierarchy valid" },
  ],
};

const MOCK_AUDITS = [MOCK_AUDIT_DEFAULT];

function mockDelay<T>(val: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(val), 300));
}

export function mockFetch(path: string): Promise<unknown> {
  if (path.startsWith("/tenants/me/stats")) {
    return mockDelay({ assetCount: 5, auditCount: 42, activeRiskScores: 4 });
  }
  // Most specific first: scan endpoint
  if (path.match(/\/assets\/\w+\/scan/)) {
    return mockDelay({ auditEventId: "demo-audit-" + Math.random().toString(36).slice(2, 8) });
  }
  // Single asset
  if (path.match(/\/assets\/\w+/)) {
    const id = path.split("/")[2];
    const asset = MOCK_ASSETS.find((a) => a.id === id) ?? MOCK_ASSET_DEFAULT;
    return mockDelay({ asset });
  }
  // Asset list — catches /assets and /assets?limit=5 etc.
  if (path.startsWith("/assets")) {
    return mockDelay({ assets: MOCK_ASSETS, total: MOCK_ASSETS.length });
  }
  if (path.startsWith("/audits") && path.includes("/report")) {
    return mockDelay({
      report: {
        score: 78,
        grade: "C",
        checkResults: MOCK_AUDIT_DEFAULT.checkResults,
        recommendations: [
          { priority: "high", message: "Add structured data (JSON-LD) for better rich results." },
          { priority: "medium", message: "Include og:image for social media sharing." },
          { priority: "low", message: "Consider adding Twitter Card meta tags." },
        ],
        generatedAt: new Date().toISOString(),
      },
    });
  }
  if (path.startsWith("/audits")) {
    return mockDelay({ audits: MOCK_AUDITS, total: MOCK_AUDITS.length });
  }
  if (path.startsWith("/debug/queues")) {
    return mockDelay({
      queues: {
        "dacc:audit:trigger": { waiting: 3, active: 1, failed: 0, completed: 128 },
        "dacc:risk:scoring": { waiting: 0, active: 0, failed: 0, completed: 97 },
        "dacc:alert:raised": { waiting: 0, active: 0, failed: 2, completed: 45 },
        "dacc:eventlog:persist": { waiting: 1, active: 0, failed: 0, completed: 512 },
      },
    });
  }
  if (path.startsWith("/tenants/me")) {
    return mockDelay({ tenant: { id: "demo-tenant", slug: "demo", planTier: "PRO" } });
  }
  return mockDelay({});
}

export function isDemo(): boolean {
  return localStorage.getItem("dacc_demo") === "1";
}
