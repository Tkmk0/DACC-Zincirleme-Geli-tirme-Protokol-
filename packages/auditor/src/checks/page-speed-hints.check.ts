import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const pageSpeedHintsCheck: AuditCheck = {
  name: "page-speed-hints",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];

    // Render-blocking resources
    const blockingStyles = $('link[rel="stylesheet"]').not('[media="print"]').length;
    const blockingScripts = $('script[src]').not('[async]').not('[defer]').not('[type="module"]').length;

    if (blockingStyles > 3) {
      issues.push(`${blockingStyles} render-blocking stylesheets (>3)`);
    }
    if (blockingScripts > 2) {
      issues.push(`${blockingScripts} render-blocking scripts (>2)`);
    }

    // Inline styles — too many is a signal of unoptimized HTML
    const inlineStyles = $("[style]").length;
    if (inlineStyles > 10) {
      issues.push(`${inlineStyles} elements with inline styles`);
    }

    // Missing viewport meta
    const viewport = $('meta[name="viewport"]').attr("content");
    if (!viewport) {
      issues.push("Missing viewport meta tag");
    }

    const passed = issues.length === 0;
    const penalty = issues.length * 20;
    const score = Math.max(0, 100 - penalty);

    return {
      checkName: "page-speed-hints",
      passed,
      severity: passed ? "info" : issues.length >= 3 ? "error" : "warning",
      score,
      details: { blockingStyles, blockingScripts, inlineStyles, hasViewport: !!viewport, issues },
    };
  },
};
