// Brand Constitution Manager
export { BrandConstitutionManager } from "./constitution/brand-constitution-manager.js";
export type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from "./constitution/brand-constitution-manager.js";

// RAG Pipeline
export { RagPipeline } from "./rag/rag-pipeline.js";
export type { RagQueryOptions, RagQueryResult } from "./rag/rag-pipeline.js";

// Vector Store
export { VectorStore } from "./vector-store/vector-store.js";
export type { SimilarChunk } from "./vector-store/vector-store.js";

// Embedding Service
export { EmbeddingService } from "./embedding/embedding-service.js";
export type { EmbeddingResult } from "./embedding/embedding-service.js";

// Chunker
export { TextChunker } from "./chunking/text-chunker.js";
export type { TextChunk } from "./chunking/text-chunker.js";

// Config
export { brandEnv } from "./config/brand-env.js";
