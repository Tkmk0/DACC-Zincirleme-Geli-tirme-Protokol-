import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  prisma,
  createLogger,
  buildBaseEvent,
  createProducer,
  type RiskScoredEvent,
} from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { analyzeTrend } from "../scoring/trend-analyzer.js";

const log = createLogger("risk-engine.worker");

const CRITICAL_THRESHOLD = 75;

export function startRiskEngineWorker() {
  const connection = createRedisClient(env.REDIS_URL);
  const logProducer = createProducer(
    QUEUE_NAMES.EVENT_LOG_PERSIST,
    createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions
  );

  return createConsumer<RiskScoredEvent>(
    QUEUE_NAMES.RISK_SCORING,
    async (job) => {
      const event = job.data;
      const { riskScoreId, assetId, score, level } = event.payload;
      const { tenantId, correlationId, eventId } = event;

      // Fetch last 10 risk scores for this asset (history for trend)
      const history = await prisma.riskScore.findMany({
        where: { assetId, tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { score: true, createdAt: true },
      });

      const trendResult = analyzeTrend(
        history.map((h) => ({
          score: h.score,
          calculatedAt: h.createdAt,
        }))
      );

      const approvalRequired = score >= CRITICAL_THRESHOLD;

      // Enrich the current RiskScore.factors with trend data
      const currentScore = await prisma.riskScore.findUnique({
        where: { id: riskScoreId },
        select: { factors: true },
      });

      const existingFactors = Array.isArray(currentScore?.factors)
        ? (currentScore.factors as unknown[])
        : [];

      const updatedFactors = [
        ...existingFactors,
        {
          factorName: "trend",
          trend: trendResult.trend,
          rollingAvg7d: trendResult.rollingAvg7d,
          sampleCount: trendResult.sampleCount,
          approvalRequired,
        },
      ];
      await prisma.riskScore.update({
        where: { id: riskScoreId },
        data: { factors: updatedFactors as unknown as object },
      });

      // Publish enrichment event to event log
      const enrichedEvent = {
        ...buildBaseEvent(tenantId, "auditor", correlationId, eventId),
        type: "RISK_TREND_ANALYZED" as const,
        payload: {
          riskScoreId,
          assetId,
          score,
          level,
          trend: trendResult.trend,
          rollingAvg7d: trendResult.rollingAvg7d,
          approvalRequired,
        },
      };
      await logProducer.publish(enrichedEvent as unknown as RiskScoredEvent);

      log.info(
        { riskScoreId, assetId, level, trend: trendResult.trend, approvalRequired },
        "Risk trend analyzed"
      );
    },
    connection as unknown as ConnectionOptions,
    { concurrency: 5 }
  );
}
