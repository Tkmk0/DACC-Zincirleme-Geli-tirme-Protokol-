import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prisma, createLogger } from "@dacc/core";
import { EmbeddingService } from "../embedding/embedding-service.js";
import { VectorStore } from "../vector-store/vector-store.js";
import { brandEnv } from "../config/brand-env.js";
import type { SimilarChunk } from "../vector-store/vector-store.js";

const log = createLogger("rag-pipeline");

const openai = createOpenAI({ apiKey: brandEnv.OPENAI_API_KEY });

export interface RagQueryOptions {
  tenantId: string;
  queryText: string;
  documentId?: string;
  topK?: number;
  minSimilarity?: number;
  auditEventId?: string;
  assetId?: string;
}

export interface RagQueryResult {
  queryId: string;
  response: string;
  retrievedChunks: SimilarChunk[];
  isCompliant: boolean;
  complianceScore: number;
  violationTags: string[];
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are the Brand Constitution Compliance Engine for the Digital Asset Command Center.
Your role is to evaluate whether digital content complies with the brand guidelines provided.

When given brand guidelines (context) and a query about content compliance:
1. Analyze the content against the guidelines
2. Identify any violations or concerns
3. Provide a compliance verdict

Always respond in valid JSON with this exact structure:
{
  "isCompliant": boolean,
  "complianceScore": number (0-100, 100 = fully compliant),
  "violationTags": string[] (e.g. ["wrong-tone", "missing-cta", "competitor-mention"]),
  "explanation": string (brief explanation of verdict),
  "suggestions": string[] (actionable improvements if not compliant)
}`;

export class RagPipeline {
  private readonly embeddingService = new EmbeddingService();
  private readonly vectorStore = new VectorStore();
  private readonly chatModel = openai(brandEnv.CHAT_MODEL);

  async query(opts: RagQueryOptions): Promise<RagQueryResult> {
    const start = Date.now();
    const { tenantId, queryText } = opts;

    // 1. Create query record
    const queryRecord = await prisma.brandQuery.create({
      data: {
        tenantId,
        queryText,
        status: "PENDING",
        ...(opts.documentId !== undefined ? { documentId: opts.documentId } : {}),
        ...(opts.auditEventId !== undefined ? { auditEventId: opts.auditEventId } : {}),
        ...(opts.assetId !== undefined ? { assetId: opts.assetId } : {}),
      },
    });

    try {
      // 2. Embed the query
      const { embedding: queryEmbedding } = await this.embeddingService.embedOne(queryText);

      // 3. Retrieve similar chunks
      const chunks = await this.vectorStore.similaritySearch(tenantId, queryEmbedding, {
        ...(opts.topK !== undefined ? { topK: opts.topK } : {}),
        ...(opts.minSimilarity !== undefined ? { minSimilarity: opts.minSimilarity } : {}),
        ...(opts.documentId !== undefined ? { documentId: opts.documentId } : {}),
      });

      if (chunks.length === 0) {
        log.warn({ tenantId }, "No relevant brand chunks found for query");
      }

      // 4. Build context from retrieved chunks
      const context = chunks
        .map((c, i) => `[Source ${i + 1}] (similarity: ${c.similarity.toFixed(3)})\n${c.content}`)
        .join("\n\n---\n\n");

      const userMessage = `Brand Guidelines Context:\n${context || "(No relevant guidelines found)"}\n\n---\n\nContent to Evaluate:\n${queryText}`;

      // 5. Generate compliance verdict
      const { text, usage } = await generateText({
        model: this.chatModel,
        system: SYSTEM_PROMPT,
        prompt: userMessage,
        maxTokens: 1024,
      });

      // 6. Parse response
      let parsed: {
        isCompliant: boolean;
        complianceScore: number;
        violationTags: string[];
        explanation: string;
        suggestions: string[];
      };

      try {
        parsed = JSON.parse(text);
      } catch {
        log.error({ raw: text }, "Failed to parse RAG response as JSON");
        parsed = {
          isCompliant: false,
          complianceScore: 0,
          violationTags: ["parse-error"],
          explanation: text,
          suggestions: [],
        };
      }

      const durationMs = Date.now() - start;

      // 7. Update query record
      await prisma.brandQuery.update({
        where: { id: queryRecord.id },
        data: {
          status: "COMPLETED",
          retrievedChunkIds: chunks.map((c) => c.chunkId),
          response: text,
          modelUsed: brandEnv.CHAT_MODEL,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          isCompliant: parsed.isCompliant,
          complianceScore: parsed.complianceScore,
          violationTags: parsed.violationTags,
          durationMs,
        },
      });

      log.info(
        {
          queryId: queryRecord.id,
          tenantId,
          isCompliant: parsed.isCompliant,
          score: parsed.complianceScore,
          durationMs,
        },
        "RAG query complete"
      );

      return {
        queryId: queryRecord.id,
        response: text,
        retrievedChunks: chunks,
        isCompliant: parsed.isCompliant,
        complianceScore: parsed.complianceScore,
        violationTags: parsed.violationTags,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        durationMs,
      };
    } catch (err) {
      await prisma.brandQuery.update({
        where: { id: queryRecord.id },
        data: { status: "FAILED" },
      });
      throw err;
    }
  }
}
