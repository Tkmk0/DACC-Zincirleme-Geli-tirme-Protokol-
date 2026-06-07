-- ─────────────────────────────────────────────────────────────────────────────
-- DACC — pgvector Index Definitions
-- Run AFTER prisma migrate (Prisma cannot manage vector indexes natively)
-- ─────────────────────────────────────────────────────────────────────────────

-- IVFFlat index for approximate nearest-neighbor search
-- lists=100 is suitable for up to ~1M vectors; increase for larger datasets
CREATE INDEX IF NOT EXISTS brand_chunks_embedding_ivfflat_idx
  ON brand_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Exact (HNSW) index — better recall, more memory; toggle per deployment needs
-- CREATE INDEX IF NOT EXISTS brand_chunks_embedding_hnsw_idx
--   ON brand_chunks
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);

-- Trigram index for full-text fallback on chunk content
CREATE INDEX IF NOT EXISTS brand_chunks_content_trgm_idx
  ON brand_chunks
  USING gin (content gin_trgm_ops);

-- Trigram index for brand document full-text search
CREATE INDEX IF NOT EXISTS brand_documents_content_trgm_idx
  ON brand_documents
  USING gin (content gin_trgm_ops);
