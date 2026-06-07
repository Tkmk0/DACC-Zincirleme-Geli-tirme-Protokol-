// Minimal model shapes — mirrors Prisma output without @prisma/client dependency

export interface AuditEventRecord {
  id: string;
  tenantId: string;
  assetId: string;
  status: string;
  triggeredBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  isShadow: boolean;
}

export interface DigitalAssetRecord {
  id: string;
  tenantId: string;
  url: string;
  domain: string;
  status: string;
  type: string;
  createdAt: Date;
  lastSeenAt: Date | null;
}

export interface RiskScoreRecord {
  id: string;
  tenantId: string;
  assetId: string;
  score: number;
  level: string;
  calculatedAt: Date;
  validUntil: Date | null;
}
