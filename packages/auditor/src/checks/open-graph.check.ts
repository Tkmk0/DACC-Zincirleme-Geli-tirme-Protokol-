import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

const REQUIRED_OG = ["og:title", "og:description", "og:image"];
const OPTIONAL_OG = ["og:url", "og:type", "og:site_name"];

export const openGraphCheck: AuditCheck = {
  name: "open-graph",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];
    const found: Record<string, string> = {};

    for (const prop of [...REQUIRED_OG, ...OPTIONAL_OG]) {
      const val = $(`meta[property="${prop}"]`).attr("content")?.trim();
      if (val) found[prop] = val;
    }

    for (const prop of REQUIRED_OG) {
      if (!found[prop]) issues.push(`Missing ${prop}`);
    }

    if (found["og:image"] && !found["og:image"].startsWith("http")) {
      issues.push("og:image should be an absolute URL");
    }

    const passed = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 25);

    return {
      checkName: "open-graph",
      passed,
      severity: passed ? "info" : "warning",
      score,
      details: { found, issues },
    };
  },
};
