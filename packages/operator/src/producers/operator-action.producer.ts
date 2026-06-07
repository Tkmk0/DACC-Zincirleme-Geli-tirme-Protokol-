import {
  createProducer,
  createRedisClient,
  QUEUE_NAMES,
  buildBaseEvent,
  env,
  type OperatorActionEvent,
  type AssetDiscoveredEvent,
  type AuditTriggeredEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { randomUUID } from "crypto";

export class OperatorActionProducer {
  private readonly producer;
  private readonly redisUrl: string;

  constructor(redisUrl: string = env.REDIS_URL) {
    this.redisUrl = redisUrl;
    const redis = createRedisClient(redisUrl);
    this.producer = createProducer(
      QUEUE_NAMES.OPERATOR_ACTION,
      redis as unknown as ConnectionOptions
    );
  }

  async publishAction(
    tenantId: string,
    sessionId: string,
    operatorId: string,
    actionType: string,
    targetId?: string,
    targetType?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const correlationId = randomUUID();
    const event: OperatorActionEvent = {
      ...buildBaseEvent(tenantId, "operator", correlationId),
      type: "OPERATOR_ACTION",
      payload: {
        sessionId,
        operatorId,
        operatorType: "api_key",
        actionType,
        ...(targetId !== undefined ? { targetId } : {}),
        ...(targetType !== undefined ? { targetType } : {}),
        outcome: "queued",
        ...(metadata !== undefined ? { metadata } : {}),
      },
    };
    await this.producer.publish(event);
  }

  async publishAssetDiscovered(
    tenantId: string,
    assetId: string,
    url: string,
    domain: string,
    correlationId: string
  ): Promise<void> {
    const redis = createRedisClient(this.redisUrl);
    const discoveryProducer = createProducer(
      QUEUE_NAMES.ASSET_DISCOVERY,
      redis as unknown as ConnectionOptions
    );
    const event: AssetDiscoveredEvent = {
      ...buildBaseEvent(tenantId, "operator", correlationId),
      type: "ASSET_DISCOVERED",
      payload: {
        assetId,
        url,
        domain,
        assetType: "URL",
        discoverySource: "operator",
      },
    };
    await discoveryProducer.publish(event);
  }

  async publishAuditTrigger(
    tenantId: string,
    auditEventId: string,
    assetId: string,
    triggeredBy: string,
    priority: "low" | "normal" | "high" = "normal",
    correlationId?: string
  ): Promise<void> {
    const redis = createRedisClient(this.redisUrl);
    const auditProducer = createProducer(
      QUEUE_NAMES.AUDIT_TRIGGER,
      redis as unknown as ConnectionOptions
    );
    const event: AuditTriggeredEvent = {
      ...buildBaseEvent(tenantId, "operator", correlationId),
      type: "AUDIT_TRIGGERED",
      payload: {
        auditEventId,
        assetId,
        triggeredBy,
        checksToRun: ["meta-tags", "canonical", "robots", "sitemap", "performance"],
        priority,
      },
    };
    await auditProducer.publish(event, {
      priority: priority === "high" ? 1 : priority === "normal" ? 5 : 10,
    });
  }
}
