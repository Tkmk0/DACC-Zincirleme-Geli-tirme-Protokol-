import { prisma, createLogger } from "@dacc/core";
import { EmbeddingService } from "../embedding/embedding-service.js";
import { brandEnv } from "../config/brand-env.js";

const log = createLogger("vector-store");

export interface SimilarChunk {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  meta: Record<string, unknown>;
}

export class VectorStore {
  // ─── Write ──────────────────────────────────────────────────

  /**
   * Upsert a chunk's embedding via raw SQL (pgvector Unsupported type).
   * Prisma cannot manage vector columns natively, so we use $executeRaw.
   */
  async upsertChunkEmbedding(
    chunkId: string,
    embedding: number[]
  ): Promise<void> {
    const vectorLiteral = EmbeddingService.toVectorLiteral(embedding);
    await prisma.$executeRawUnsafe(
      `UPDATE brand_chunks SET embedding = $1::vector WHERE id = $2`,
      vectorLiteral,
      chunkId
    );
  }

  // ─── Read: Similarity Search ────────────────────────────────

  /**
   * Returns top-k most similar chunks for a given query embedding,
   * scoped to a tenant (enforces isolation).
   */
  async similaritySearch(
    tenantId: string,
    queryEmbedding: number[],
    opts?: { topK?: number; minSimilarity?: number; documentId?: string }
  ): Promise<SimilarChunk[]> {
    const topK = opts?.topK ?? brandEnv.RAG_TOP_K;
    const minSimilarity = opts?.minSimilarity ?? brandEnv.RAG_MIN_SIMILARITY;
    const vectorLiteral = EmbeddingService.toVectorLiteral(queryEmbedding);

    const documentFilter = opts?.documentId
      ? `AND bc.document_id = '${opts.documentId}'`
      : "";

    type RawRow = {
      chunk_id: string;
      document_id: string;
      content: string;
      similarity: number;
      meta: unknown;
    };

    // 1 - cosine_distance = cosine_similarity
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT
        bc.id            AS chunk_id,
        bc.document_id,
        bc.content,
        1 - (bc.embedding <=> $1::vector) AS similarity,
        bc.meta
      FROM brand_chunks bc
      INNER JOIN brand_documents bd ON bd.id = bc.document_id
      WHERE bc.tenant_id = $2
        AND bd.status = 'ACTIVE'
        AND bc.embedding IS NOT NULL
        ${documentFilter}
        AND 1 - (bc.embedding <=> $1::vector) >= $3
      ORDER BY bc.embedding <=> $1::vector
      LIMIT $4
      `,
      vectorLiteral,
      tenantId,
      minSimilarity,
      topK
    )) as RawRow[];

    log.debug(
      { tenantId, results: rows.length, topK },
      "Vector similarity search complete"
    );

    return rows.map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      content: r.content,
      similarity: r.similarity,
      meta: (r.meta as Record<string, unknown>) ?? {},
    }));
  }

  // ─── Stats ──────────────────────────────────────────────────

  async getChunkCount(tenantId: string): Promise<number> {
    const result = await prisma.brandChunk.count({ where: { tenantId } });
    return result;
  }
}
