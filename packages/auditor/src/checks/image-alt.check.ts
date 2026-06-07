import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const imageAltCheck: AuditCheck = {
  name: "image-alt",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];

    const images = $("img");
    const total = images.length;
    let missing = 0;
    let empty = 0;

    images.each((_i, el) => {
      const alt = $(el).attr("alt");
      if (alt === undefined) {
        missing++;
      } else if (alt.trim() === "") {
        // Empty alt is valid for decorative images — only flag if >20% are empty
        empty++;
      }
    });

    if (total === 0) {
      // No images — neutral
    } else {
      if (missing > 0) {
        issues.push(`${missing}/${total} images missing alt attribute`);
      }
      const emptyRatio = empty / total;
      if (emptyRatio > 0.2) {
        issues.push(`${empty}/${total} images have empty alt (>${Math.round(emptyRatio * 100)}%)`);
      }
    }

    const coverage = total === 0 ? 100 : Math.round(((total - missing) / total) * 100);
    const passed = issues.length === 0;
    const score = Math.max(0, coverage - (missing > 0 ? 20 : 0));

    return {
      checkName: "image-alt",
      passed,
      severity: passed ? "info" : missing > total * 0.5 ? "error" : "warning",
      score,
      details: { total, missing, empty, coverage, issues },
    };
  },
};
