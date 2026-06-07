-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text search on brand documents
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for uuid generation fallback
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
