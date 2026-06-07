import type { FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { env, createProducer, createRedisClient, QUEUE_NAMES, buildBaseEvent, type AuditTriggeredEvent } from "@dacc/core";
import type { ConnectionOptions } from "bullmq";
import { randomUUID } from "crypto";

const SYSTEM_PROMPT = `Sen DACC (Digital Asset Command Center) panelinin AI asistanısın.
Kullanıcının dijital varlıklarını (web siteleri, URL'ler), SEO denetimlerini ve risk skorlarını yönetmesine yardımcı olursun.
Kullanıcının gerçek verilerine erişmek için sağlanan araçları kullan; verileri tahmin etme veya uydurma.
Türkçe sorulara Türkçe, İngilizce sorulara İngilizce yanıtla. Kısa ve net yanıtlar ver.`;

const tools: Anthropic.Tool[] = [
  {
    name: "list_assets",
    description: "Kullanıcının tüm dijital varlıklarını (web siteleri) risk skorlarıyla listeler",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_asset",
    description: "Belirli bir varlığın detaylarını, durumunu ve güncel risk skorunu getirir",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "Varlık ID'si" } },
      required: ["assetId"],
    },
  },
  {
    name: "list_audits",
    description: "Son SEO audit listesini getirir. Opsiyonel olarak bir varlığa göre filtrelenebilir.",
    input_schema: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "Filtre için varlık ID'si (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "trigger_audit",
    description: "Belirli bir varlık için yeni bir SEO audit başlatır",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "Audit yapılacak varlık ID'si" } },
      required: ["assetId"],
    },
  },
];

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  const anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] ?? "" });

  app.post<{ Body: ChatBody }>("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { messages } = req.body;

    if (!messages || messages.length === 0) {
      return reply.status(400).send({ error: "messages is required" });
    }

    async function runTool(name: string, input: Record<string, string>): Promise<unknown> {
      switch (name) {
        case "list_assets": {
          const assets = await app.db.digitalAsset.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            take: 20,
          });
          const assetIds = assets.map((a) => a.id);
          const riskScores = await app.db.riskScore.findMany({
            where: { assetId: { in: assetIds }, tenantId, validUntil: null },
            orderBy: { createdAt: "desc" },
          });
          const scoreMap = new Map(riskScores.map((r) => [r.assetId, r]));
          return assets.map((a) => ({ ...a, riskScore: scoreMap.get(a.id) ?? null }));
        }

        case "get_asset": {
          const asset = await app.db.digitalAsset.findFirst({
            where: { id: input.assetId, tenantId },
          });
          if (!asset) return { error: "Asset not found" };
          const riskScore = await app.db.riskScore.findFirst({
            where: { assetId: input.assetId, tenantId, validUntil: null },
            orderBy: { createdAt: "desc" },
          });
          const audits = await app.db.auditEvent.findMany({
            where: { assetId: input.assetId, tenantId },
            orderBy: { startedAt: "desc" },
            take: 5,
          });
          return { asset, riskScore, recentAudits: audits };
        }

        case "list_audits": {
          const audits = await app.db.auditEvent.findMany({
            where: {
              tenantId,
              ...(input.assetId ? { assetId: input.assetId } : {}),
            },
            orderBy: { startedAt: "desc" },
            take: 10,
          });
          return { audits };
        }

        case "trigger_audit": {
          const asset = await app.db.digitalAsset.findFirst({
            where: { id: input.assetId, tenantId },
          });
          if (!asset) return { error: "Asset not found" };

          const auditEvent = await app.db.auditEvent.create({
            data: {
              tenantId,
              assetId: input.assetId,
              triggeredBy: `ai:${tenantId}`,
              status: "QUEUED",
            },
          });

          const correlationId = randomUUID();
          const producer = createProducer(
            QUEUE_NAMES.AUDIT_TRIGGER,
            createRedisClient(env.REDIS_URL) as unknown as ConnectionOptions
          );
          const event: AuditTriggeredEvent = {
            ...buildBaseEvent(tenantId, "ai-agent", correlationId),
            type: "AUDIT_TRIGGERED",
            payload: {
              auditEventId: auditEvent.id,
              assetId: input.assetId,
              triggeredBy: `ai:${tenantId}`,
              checksToRun: [],
              priority: "normal",
            },
          };
          await producer.publish(event, { priority: 5 });

          return { queued: true, auditEventId: auditEvent.id, url: asset.url };
        }

        default:
          return { error: `Unknown tool: ${name}` };
      }
    }

    // Agentic loop: tool use döngüsü
    let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: currentMessages,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await runTool(block.name, block.input as Record<string, string>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        })
      );

      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages: currentMessages,
      });
    }

    const text =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ??
      "Yanıt alınamadı.";

    return reply.send({ reply: text });
  });
};
