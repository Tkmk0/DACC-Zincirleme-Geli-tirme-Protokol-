import type { AuditCheck } from "./index.js";

export const performanceCheck: AuditCheck = {
  name: "performance",
  async run(url, _html) {
    const start = Date.now();
    try {
      await fetch(url, { signal: AbortSignal.timeout(10000) });
      const ttfb = Date.now() - start;
      const passed = ttfb < 800;
      const score = Math.max(0, 100 - Math.floor(ttfb / 20));

      return {
        checkName: "performance",
        passed,
        severity: ttfb > 2000 ? "error" : ttfb > 800 ? "warning" : "info",
        score,
        details: { ttfbMs: ttfb },
      };
    } catch {
      return {
        checkName: "performance",
        passed: false,
        severity: "error",
        score: 0,
        details: { error: "Page unreachable" },
      };
    }
  },
};
