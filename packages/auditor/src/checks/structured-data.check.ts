import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const structuredDataCheck: AuditCheck = {
  name: "structured-data",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]');
    const issues: string[] = [];

    if (scripts.length === 0) {
      issues.push("No JSON-LD structured data found");
    } else {
      scripts.each((_i, el) => {
        try {
          const raw = $(el).html() ?? "";
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (!parsed["@type"]) issues.push("JSON-LD block missing @type");
          if (!parsed["@context"]) issues.push("JSON-LD block missing @context");
        } catch {
          issues.push("Invalid JSON-LD: parse error");
        }
      });
    }

    const passed = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 30);

    return {
      checkName: "structured-data",
      passed,
      severity: passed ? "info" : scripts.length === 0 ? "warning" : "error",
      score,
      details: { blockCount: scripts.length, issues },
    };
  },
};
