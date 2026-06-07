import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const canonicalCheck: AuditCheck = {
  name: "canonical",
  async run(url, html) {
    const $ = cheerio.load(html);
    const canonical = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
    const passed = canonical.length > 0;

    return {
      checkName: "canonical",
      passed,
      severity: passed ? "info" : "warning",
      score: passed ? 100 : 60,
      details: {
        canonical,
        selfReferencing: canonical === url,
      },
    };
  },
};
