import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const internalLinksCheck: AuditCheck = {
  name: "internal-links",
  async run(url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];

    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return {
        checkName: "internal-links",
        passed: false,
        severity: "error",
        score: 0,
        details: { issues: ["Invalid base URL"] },
      };
    }

    const allLinks = $("a[href]");
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];

    allLinks.each((_i, el) => {
      const href = $(el).attr("href")?.trim() ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const resolved = new URL(href, url);
        if (resolved.origin === origin) {
          internalLinks.push(resolved.pathname);
        } else {
          externalLinks.push(resolved.href);
        }
      } catch {
        // relative or malformed — treat as internal
        internalLinks.push(href);
      }
    });

    const total = allLinks.length;

    if (total === 0) {
      issues.push("No links found on page");
    } else if (internalLinks.length < 3) {
      issues.push(`Low internal link count: ${internalLinks.length} (recommend ≥3)`);
    }

    const passed = issues.length === 0;
    const score = Math.max(0, Math.min(100, internalLinks.length * 10 + (issues.length === 0 ? 40 : 0)));

    return {
      checkName: "internal-links",
      passed,
      severity: passed ? "info" : "warning",
      score,
      details: {
        total,
        internal: internalLinks.length,
        external: externalLinks.length,
        issues,
      },
    };
  },
};
