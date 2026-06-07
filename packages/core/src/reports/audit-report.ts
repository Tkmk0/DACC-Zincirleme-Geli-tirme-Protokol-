import type { CheckResult } from "../types/risk.js";
import { computeWeightedScore } from "../scoring/weighted-score.js";

export type AuditGrade = "A" | "B" | "C" | "D" | "F";

export interface AuditRecommendation {
  checkName: string;
  priority: "high" | "medium" | "low";
  message: string;
}

export interface AuditReport {
  score: number;
  riskScore: number;
  grade: AuditGrade;
  checkResults: CheckResult[];
  recommendations: AuditRecommendation[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  generatedAt: Date;
}

function toGrade(score: number): AuditGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function toPriority(severity: CheckResult["severity"]): AuditRecommendation["priority"] {
  if (severity === "critical" || severity === "error") return "high";
  if (severity === "warning") return "medium";
  return "low";
}

const RECOMMENDATION_MESSAGES: Record<string, string> = {
  "meta-tags": "Add or fix <title> (30–60 chars) and meta description (70–160 chars)",
  canonical: "Add a canonical link tag to prevent duplicate content penalties",
  robots: "Ensure robots.txt is reachable and does not block important paths",
  sitemap: "Submit a valid XML sitemap to improve crawlability",
  performance: "Reduce page weight and optimize load time for better Core Web Vitals",
  "structured-data": "Add JSON-LD schema markup (e.g. Organization, WebPage) for rich search results",
  "open-graph": "Add og:title, og:description, og:image for better social sharing previews",
  "twitter-card": "Add twitter:card and twitter:title meta tags for Twitter previews",
  "heading-hierarchy": "Use a single H1 and maintain correct H1→H2→H3 order",
  "image-alt": "Add descriptive alt attributes to all meaningful images",
  "page-speed-hints": "Eliminate render-blocking scripts/stylesheets and add viewport meta tag",
  "internal-links": "Add at least 3 internal links to improve site crawlability",
};

export function generateAuditReport(checkResults: CheckResult[]): AuditReport {
  const { score, riskScore } = computeWeightedScore(checkResults);
  const grade = toGrade(score);

  const recommendations: AuditRecommendation[] = checkResults
    .filter((r) => !r.passed)
    .map((r) => ({
      checkName: r.checkName,
      priority: toPriority(r.severity),
      message: RECOMMENDATION_MESSAGES[r.checkName] ?? `Fix issues in ${r.checkName} check`,
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });

  const summary = {
    totalChecks: checkResults.length,
    passed: checkResults.filter((r) => r.passed).length,
    failed: checkResults.filter((r) => !r.passed && (r.severity === "error" || r.severity === "critical")).length,
    warnings: checkResults.filter((r) => r.severity === "warning").length,
  };

  return { score, riskScore, grade, checkResults, recommendations, summary, generatedAt: new Date() };
}
