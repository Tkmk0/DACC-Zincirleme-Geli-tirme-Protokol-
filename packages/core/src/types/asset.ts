export interface AssetMetadata {
  title?: string;
  description?: string;
  lastCrawledAt?: string; // ISO 8601
  httpStatus?: number;
  contentType?: string;
  redirectUrl?: string;
  robotsDirective?: string;
  canonicalUrl?: string;
}
