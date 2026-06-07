import type { FastifyPluginAsync } from "fastify";
import {
  BrandConstitutionManager,
  RagPipeline,
} from "@dacc/brand-engine";
import { z } from "zod";

const manager = new BrandConstitutionManager();
const ragPipeline = new RagPipeline();

// ─── Zod schemas (request validation) ────────────────────────

const createDocSchema = z.object({
  type: z.enum([
    "VOICE_AND_TONE",
    "VISUAL_IDENTITY",
    "MESSAGING_FRAMEWORK",
    "CONTENT_POLICY",
    "SEO_GUIDELINES",
    "COMPETITOR_RULES",
    "CUSTOM",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  content: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  queryText: z.string().min(1).max(4000),
  documentId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(20).optional(),
  auditEventId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
});

// ─── Routes ───────────────────────────────────────────────────

export const brandRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /brand/documents ────────────────────────────────────
  app.get("/documents", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.tenantCtx;
    return manager.listDocuments(tenantId);
  });

  // ── POST /brand/documents ───────────────────────────────────
  app.post("/documents", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = req.tenantCtx;
    const input = createDocSchema.parse(req.body);
    const doc = await manager.createDocument({
      tenantId,
      type: input.type,
      title: input.title,
      content: input.content,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
    });
    reply.status(201).send(doc);
  });

  // ── GET /brand/documents/:id ────────────────────────────────
  app.get("/documents/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const { tenantId } = req.tenantCtx;
    return manager.getDocument(id, tenantId);
  });

  // ── PATCH /brand/documents/:id ──────────────────────────────
  app.patch("/documents/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const { tenantId } = req.tenantCtx;
    const input = req.body as Record<string, unknown>;
    return manager.updateDocument(id, tenantId, input);
  });

  // ── POST /brand/documents/:id/embed ────────────────────────
  // Trigger chunk generation + embedding for a document
  app.post(
    "/documents/:id/embed",
    { preHandler: [app.authenticate] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { tenantId } = req.tenantCtx;
      return manager.embedDocument(id, tenantId);
    }
  );

  // ── DELETE /brand/documents/:id ────────────────────────────
  app.delete(
    "/documents/:id",
    { preHandler: [app.authenticate] },
    async (_req, reply) => {
      const { id } = (_req.params as { id: string });
      const { tenantId } = _req.tenantCtx;
      await manager.deleteDocument(id, tenantId);
      reply.status(204).send();
    }
  );

  // ── POST /brand/query ───────────────────────────────────────
  // RAG compliance check
  app.post("/query", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.tenantCtx;
    const input = querySchema.parse(req.body);
    return ragPipeline.query({
      tenantId,
      queryText: input.queryText,
      ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
      ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
      ...(input.topK !== undefined ? { topK: input.topK } : {}),
      ...(input.auditEventId !== undefined ? { auditEventId: input.auditEventId } : {}),
    });
  });

  // ── GET /brand/stats ────────────────────────────────────────
  app.get("/stats", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.tenantCtx;
    return manager.getTenantStats(tenantId);
  });
};
