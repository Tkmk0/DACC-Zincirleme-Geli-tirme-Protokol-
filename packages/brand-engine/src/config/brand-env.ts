import { z } from "zod";

const brandEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIM: z.coerce.number().default(1536),
  CHAT_MODEL: z.string().default("gpt-4o-mini"),
  RAG_TOP_K: z.coerce.number().default(5),
  RAG_MIN_SIMILARITY: z.coerce.number().default(0.7),
  CHUNK_SIZE_TOKENS: z.coerce.number().default(512),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().default(64),
});

export type BrandEnv = z.infer<typeof brandEnvSchema>;

function parseBrandEnv(): BrandEnv {
  const result = brandEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Brand Engine env vars missing:\n${formatted}`);
  }
  return result.data;
}

export const brandEnv = parseBrandEnv();
