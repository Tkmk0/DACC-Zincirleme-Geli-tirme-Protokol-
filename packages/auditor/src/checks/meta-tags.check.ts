import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

export const metaTagsCheck: AuditCheck = {
  name: "meta-tags",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const title = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content")?.trim() ?? "";

    const issues: string[] = [];
    if (!title) issues.push("Missing <title>");
    else if (title.length < 30) issues.push("Title too short (<30 chars)");
    else if (title.length > 60) issues.push("Title too long (>60 chars)");

    if (!description) issues.push("Missing meta description");
    else if (description.length < 70) issues.push("Meta description too short");
    else if (description.length > 160) issues.push("Meta description too long");

    const passed = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 25);

    return {
      checkName: "meta-tags",
      passed,
      severity: passed ? "info" : issues.length >= 2 ? "error" : "warning",
      score,
      details: { title, descriptionLength: description.length, issues },
    };
  },
};
