import type { CheckResult } from "@dacc/core";

export interface AuditCheck {
  name: string;
  run(url: string, html: string): Promise<CheckResult>;
}

import { metaTagsCheck } from "./meta-tags.check.js";
import { canonicalCheck } from "./canonical.check.js";
import { robotsCheck } from "./robots.check.js";
import { sitemapCheck } from "./sitemap.check.js";
import { performanceCheck } from "./performance.check.js";
import { structuredDataCheck } from "./structured-data.check.js";
import { openGraphCheck } from "./open-graph.check.js";
import { twitterCardCheck } from "./twitter-card.check.js";
import { headingHierarchyCheck } from "./heading-hierarchy.check.js";
import { imageAltCheck } from "./image-alt.check.js";
import { pageSpeedHintsCheck } from "./page-speed-hints.check.js";
import { internalLinksCheck } from "./internal-links.check.js";

export const CHECK_REGISTRY: Record<string, AuditCheck> = {
  "meta-tags": metaTagsCheck,
  canonical: canonicalCheck,
  robots: robotsCheck,
  sitemap: sitemapCheck,
  performance: performanceCheck,
  "structured-data": structuredDataCheck,
  "open-graph": openGraphCheck,
  "twitter-card": twitterCardCheck,
  "heading-hierarchy": headingHierarchyCheck,
  "image-alt": imageAltCheck,
  "page-speed-hints": pageSpeedHintsCheck,
  "internal-links": internalLinksCheck,
};

export const ALL_CHECK_NAMES = Object.keys(CHECK_REGISTRY) as (keyof typeof CHECK_REGISTRY)[];
