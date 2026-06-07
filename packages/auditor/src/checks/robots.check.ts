import type { AuditCheck } from "./index.js";

export const robotsCheck: AuditCheck = {
  name: "robots",
  async run(url, html) {
    const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] ?? "";
    const noindex = /noindex/i.test(robotsMeta);
    const nofollow = /nofollow/i.test(robotsMeta);
    const passed = !noindex;

    return {
      checkName: "robots",
      passed,
      severity: noindex ? "error" : "info",
      score: noindex ? 0 : nofollow ? 70 : 100,
      details: { robotsMeta, noindex, nofollow },
    };
  },
};
