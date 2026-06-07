import { OperatorActionProducer } from "../producers/operator-action.producer.js";
import { SessionManager } from "../session/session-manager.js";
import { prisma } from "@dacc/core";
import { randomUUID } from "crypto";
import type {
  AuditEventRecord,
  DigitalAssetRecord,
  RiskScoreRecord,
} from "../types/models.js";

export interface SdkConfig {
  tenantId: string;
  operatorId: string;
  redisUrl?: string;
}

export type { SdkConfig as OperatorSdkOptions };

export class OperatorSdkClient {
  private readonly producer: OperatorActionProducer;
  private readonly sessions: SessionManager;

  constructor(private readonly config: SdkConfig) {
    this.producer = new OperatorActionProducer(config.redisUrl);
    this.sessions = new SessionManager();
  }

  async triggerScan(
    url: string,
    opts?: { priority?: "low" | "normal" | "high" }
  ): Promise<{ auditEventId: string; sessionId: string }> {
    const { tenantId, operatorId } = this.config;
    const correlationId = randomUUID();
    const sessionId = await this.sessions.open(tenantId, operatorId, "api_key", {});

    const domain = new URL(url).hostname;
    const asset = await prisma.digitalAsset.upsert({
      where: { tenantId_url: { tenantId, url } },
      create: { tenantId, type: "URL", url, domain, status: "PENDING" },
      update: { lastSeenAt: new Date() },
    });

    const audit = await prisma.auditEvent.create({
      data: {
        tenantId,
        assetId: asset.id,
        triggeredBy: `operator:${operatorId}`,
        status: "QUEUED",
      },
    });

    await this.producer.publishAssetDiscovered(
      tenantId, asset.id, url, domain, correlationId
    );
    await this.producer.publishAuditTrigger(
      tenantId, audit.id, asset.id,
      `operator:${operatorId}`, opts?.priority ?? "normal", correlationId
    );
    await this.producer.publishAction(
      tenantId, sessionId, operatorId,
      "trigger_audit", asset.id, "asset"
    );

    await this.sessions.close(sessionId);
    return { auditEventId: audit.id, sessionId };
  }

  async getAuditHistory(assetId: string, limit = 10): Promise<AuditEventRecord[]> {
    return prisma.auditEvent.findMany({
      where: { assetId, tenantId: this.config.tenantId },
      orderBy: { startedAt: "desc" },
      take: limit,
    }) as Promise<AuditEventRecord[]>;
  }

  async getRiskScore(assetId: string): Promise<RiskScoreRecord | null> {
    return prisma.riskScore.findFirst({
      where: {
        assetId,
        tenantId: this.config.tenantId,
        validUntil: null,
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<RiskScoreRecord | null>;
  }

  async listAssets(opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<DigitalAssetRecord[]> {
    return prisma.digitalAsset.findMany({
      where: {
        tenantId: this.config.tenantId,
        ...(opts?.status !== undefined ? { status: opts.status as never } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: opts?.limit ?? 20,
      skip: opts?.offset ?? 0,
    }) as Promise<DigitalAssetRecord[]>;
  }

  async getAsset(assetId: string): Promise<DigitalAssetRecord | null> {
    return prisma.digitalAsset.findFirst({
      where: { id: assetId, tenantId: this.config.tenantId },
    }) as Promise<DigitalAssetRecord | null>;
  }

  async batchScan(
    urls: string[],
    opts?: { priority?: "low" | "normal" | "high" }
  ): Promise<Array<{ url: string; auditEventId: string; sessionId: string; error?: string }>> {
    const results: Array<{ url: string; auditEventId: string; sessionId: string; error?: string }> = [];

    for (const url of urls) {
      try {
        const r = await this.triggerScan(url, opts);
        results.push({ url, ...r });
      } catch (err) {
        results.push({
          url,
          auditEventId: "",
          sessionId: "",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}
