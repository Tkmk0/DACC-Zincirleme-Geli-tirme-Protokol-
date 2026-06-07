import * as cheerio from "cheerio";
import type { AuditCheck } from "./index.js";

const VALID_CARDS = ["summary", "summary_large_image", "app", "player"];

export const twitterCardCheck: AuditCheck = {
  name: "twitter-card",
  async run(_url, html) {
    const $ = cheerio.load(html);
    const issues: string[] = [];

    const card = $('meta[name="twitter:card"]').attr("content")?.trim();
    const title = $('meta[name="twitter:title"]').attr("content")?.trim();
    const description = $('meta[name="twitter:description"]').attr("content")?.trim();

    if (!card) {
      issues.push("Missing twitter:card");
    } else if (!VALID_CARDS.includes(card)) {
      issues.push(`Invalid twitter:card value: ${card}`);
    }

    if (!title) issues.push("Missing twitter:title");
    if (!description) issues.push("Missing twitter:description");

    const passed = issues.length === 0;
    const score = Math.max(0, 100 - issues.length * 25);

    return {
      checkName: "twitter-card",
      passed,
      severity: passed ? "info" : "warning",
      score,
      details: { card, title: !!title, description: !!description, issues },
    };
  },
};
