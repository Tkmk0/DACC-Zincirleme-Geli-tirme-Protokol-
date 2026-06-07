import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { AuditCheck } from "./index.js";

export const headingHierarchyCheck: AuditCheck = {
  name: "heading-hierarchy",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];

    const h1s = $("h1");
    const h1Count = h1s.length;

    if (h1Count === 0) {
      issues.push("No H1 found");
    } else if (h1Count > 1) {
      issues.push(`Multiple H1 tags found (${h1Count})`);
    }

    // Check for skipped heading levels (e.g. H1 → H3 with no H2)
    const headings: number[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
      const tag = (el as Element).tagName?.toLowerCase() ?? "";
      const level = parseInt(tag.replace("h", ""), 10);
      if (!isNaN(level)) headings.push(level);
    });

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1]!;
      const curr = headings[i]!;
      if (curr > prev + 1) {
        issues.push(`Heading level skipped: H${prev} → H${curr}`);
        break; // report once
      }
    }

    const passed = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 30);

    return {
      checkName: "heading-hierarchy",
      passed,
      severity: passed ? "info" : h1Count === 0 ? "error" : "warning",
      score,
      details: { h1Count, totalHeadings: headings.length, issues },
    };
  },
};
