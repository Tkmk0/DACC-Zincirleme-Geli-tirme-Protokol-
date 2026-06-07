import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { brandEnv } from "../config/brand-env.js";
import { createLogger } from "@dacc/core";

const log = createLogger("embedding-service");

const openai = createOpenAI({ apiKey: brandEnv.OPENAI_API_KEY });

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export class EmbeddingService {
  private readonly model = openai.embedding(brandEnv.EMBEDDING_MODEL);

  async embedOne(text: string): Promise<EmbeddingResult> {
    const { embedding, usage } = await embed({
      model: this.model,
      value: text,
    });
    log.debug({ tokens: usage.tokens }, "Single embedding generated");
    return { embedding, tokenCount: usage.tokens };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    const { embeddings, usage } = await embedMany({
      model: this.model,
      values: texts,
    });
    log.debug(
      { count: texts.length, totalTokens: usage.tokens },
      "Batch embeddings generated"
    );
    return embeddings.map((embedding, i) => ({
      embedding,
      // Approximate per-chunk token count
      tokenCount: Math.round(usage.tokens / texts.length),
    }));
  }

  // Format a float[] as a pgvector-compatible string: '[0.1,0.2,...]'
  static toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
  }
}
