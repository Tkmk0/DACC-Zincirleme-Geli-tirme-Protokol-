import type { AuditCheck } from "./index.js";

export const sitemapCheck: AuditCheck = {
  name: "sitemap",
  async run(url, _html) {
    try {
      const base = new URL(url).origin;
      const res = await fetch(`${base}/sitemap.xml`, {
        signal: AbortSignal.timeout(5000),
      });
      const passed = res.ok;
      return {
        checkName: "sitemap",
        passed,
        severity: passed ? "info" : "warning",
        score: passed ? 100 : 60,
        details: { sitemapUrl: `${base}/sitemap.xml`, httpStatus: res.status },
      };
    } catch {
      return {
        checkName: "sitemap",
        passed: false,
        severity: "warning",
        score: 50,
        details: { error: "sitemap.xml unreachable" },
      };
    }
  },
};
