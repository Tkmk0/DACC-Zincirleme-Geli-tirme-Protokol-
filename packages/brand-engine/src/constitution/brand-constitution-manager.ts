import { prisma, createLogger, NotFoundError, ForbiddenError } from "@dacc/core";
import { EmbeddingService } from "../embedding/embedding-service.js";
import { TextChunker } from "../chunking/text-chunker.js";
import { VectorStore } from "../vector-store/vector-store.js";
// Local enum mirrors (Prisma client not yet generated)
type BrandDocumentType = "VOICE_AND_TONE" | "VISUAL_IDENTITY" | "MESSAGING_FRAMEWORK" | "CONTENT_POLICY" | "SEO_GUIDELINES" | "COMPETITOR_RULES" | "CUSTOM";
type BrandDocumentStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

const log = createLogger("brand-constitution-manager");

export interface CreateDocumentInput {
  tenantId: string;
  type: BrandDocumentType;
  title: string;
  description?: string;
  content: string;
  meta?: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  content?: string;
  status?: BrandDocumentStatus;
  meta?: Record<string, unknown>;
}

export class BrandConstitutionManager {
  private readonly embedder = new EmbeddingService();
  private readonly chunker = new TextChunker();
  private readonly vectorStore = new VectorStore();

  // ─── Create ─────────────────────────────────────────────────

  async createDocument(input: CreateDocumentInput) {
    const doc = await prisma.brandDocument.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        description: input.description ?? "",
        content: input.content,
        meta: (input.meta ?? {}) as never,
        status: "DRAFT",
        chunksGenerated: false,
      },
    });

    log.info({ docId: doc.id, tenantId: input.tenantId, type: input.type }, "Brand document created");
    return doc;
  }

  // ─── Embed (generate chunks + embeddings) ───────────────────

  async embedDocument(documentId: string, tenantId: string): Promise<{ chunksCreated: number }> {
    const doc = await prisma.brandDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundError("BrandDocument", documentId);
    if (doc.tenantId !== tenantId) throw new ForbiddenError();

    // Delete existing chunks before re-embedding
    await prisma.brandChunk.deleteMany({ where: { documentId } });

    // Split into chunks
    const textChunks = this.chunker.chunk(doc.content);
    if (textChunks.length === 0) {
      log.warn({ documentId }, "No chunks generated — content may be empty");
      return { chunksCreated: 0 };
    }

    // Embed all chunks in one batch
    const embeddingResults = await this.embedder.embedBatch(
      textChunks.map((c) => c.content)
    );

    // Insert chunks (without embeddings first, then update via raw SQL)
    const insertedChunks = await Promise.all(
      textChunks.map((chunk, i) =>
        prisma.brandChunk.create({
          data: {
            tenantId,
            documentId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            tokenCount: embeddingResults[i]?.tokenCount ?? 0,
            meta: chunk.meta as never,
          },
        })
      )
    );

    // Update embeddings via raw SQL (pgvector)
    await Promise.all(
      insertedChunks.map((chunk, i) =>
        this.vectorStore.upsertChunkEmbedding(
          chunk.id,
          embeddingResults[i]?.embedding ?? []
        )
      )
    );

    // Mark document as embedded
    await prisma.brandDocument.update({
      where: { id: documentId },
      data: { chunksGenerated: true, status: "ACTIVE" },
    });

    log.info(
      { documentId, tenantId, chunksCreated: insertedChunks.length },
      "Document embedded successfully"
    );

    return { chunksCreated: insertedChunks.length };
  }

  // ─── Read ────────────────────────────────────────────────────

  async listDocuments(tenantId: string, type?: BrandDocumentType) {
    return prisma.brandDocument.findMany({
      where: { tenantId, deletedAt: null, ...(type ? { type } : {}) },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        description: true,
        chunksGenerated: true,
        embeddingModel: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async getDocument(documentId: string, tenantId: string) {
    const doc = await prisma.brandDocument.findUnique({
      where: { id: documentId },
      include: { _count: { select: { chunks: true, queries: true } } },
    });
    if (!doc || doc.deletedAt) throw new NotFoundError("BrandDocument", documentId);
    if (doc.tenantId !== tenantId) throw new ForbiddenError();
    return doc;
  }

  // ─── Update ──────────────────────────────────────────────────

  async updateDocument(
    documentId: string,
    tenantId: string,
    input: UpdateDocumentInput
  ) {
    const doc = await prisma.brandDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.deletedAt) throw new NotFoundError("BrandDocument", documentId);
    if (doc.tenantId !== tenantId) throw new ForbiddenError();

    const updated = await prisma.brandDocument.update({
      where: { id: documentId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.content !== undefined
          ? { content: input.content, chunksGenerated: false }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.meta !== undefined ? { meta: input.meta as never } : {}),
      },
    });

    // If content changed, re-embed automatically
    if (input.content !== undefined) {
      log.info({ documentId }, "Content updated — triggering re-embedding");
      await this.embedDocument(documentId, tenantId);
    }

    return updated;
  }

  // ─── Soft Delete ─────────────────────────────────────────────

  async deleteDocument(documentId: string, tenantId: string): Promise<void> {
    const doc = await prisma.brandDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.deletedAt) throw new NotFoundError("BrandDocument", documentId);
    if (doc.tenantId !== tenantId) throw new ForbiddenError();

    await prisma.brandDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    log.info({ documentId, tenantId }, "Brand document archived");
  }

  // ─── Stats ───────────────────────────────────────────────────

  async getTenantStats(tenantId: string) {
    const [docCount, chunkCount, queryCount] = await Promise.all([
      prisma.brandDocument.count({ where: { tenantId, deletedAt: null } }),
      prisma.brandChunk.count({ where: { tenantId } }),
      prisma.brandQuery.count({ where: { tenantId } }),
    ]);
    return { docCount, chunkCount, queryCount };
  }
}
