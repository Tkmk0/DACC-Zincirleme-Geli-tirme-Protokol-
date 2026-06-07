import { brandEnv } from "../config/brand-env.js";

export interface TextChunk {
  content: string;
  chunkIndex: number;
  meta: {
    startChar: number;
    endChar: number;
    heading?: string;
  };
}

/**
 * Splits text into overlapping chunks by approximate token count.
 * Uses word-boundary splitting — no external tokenizer dependency.
 */
export class TextChunker {
  private readonly chunkSize: number;
  private readonly overlap: number;

  constructor(
    chunkSizeTokens = brandEnv.CHUNK_SIZE_TOKENS,
    overlapTokens = brandEnv.CHUNK_OVERLAP_TOKENS
  ) {
    // Rough heuristic: 1 token ≈ 4 chars for English text
    this.chunkSize = chunkSizeTokens * 4;
    this.overlap = overlapTokens * 4;
  }

  chunk(text: string): TextChunk[] {
    // Split on sentence boundaries first, then re-combine into target sizes
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const chunks: TextChunk[] = [];
    let buffer = "";
    let bufferStart = 0;
    let charOffset = 0;
    let currentHeading: string | undefined;

    for (const sentence of sentences) {
      // Detect markdown headings
      if (/^#{1,3}\s/.test(sentence)) {
        currentHeading = sentence.replace(/^#+\s*/, "");
      }

      if (buffer.length + sentence.length > this.chunkSize && buffer.length > 0) {
        chunks.push({
          content: buffer.trim(),
          chunkIndex: chunks.length,
          meta: {
            startChar: bufferStart,
            endChar: charOffset,
            ...(currentHeading !== undefined ? { heading: currentHeading } : {}),
          },
        });

        // Overlap: carry last N chars into next chunk
        const overlapText = buffer.slice(-this.overlap);
        buffer = overlapText + " " + sentence;
        bufferStart = charOffset - overlapText.length;
      } else {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      }
      charOffset += sentence.length + 1;
    }

    if (buffer.trim()) {
      chunks.push({
        content: buffer.trim(),
        chunkIndex: chunks.length,
        meta: { startChar: bufferStart, endChar: charOffset },
      });
    }

    return chunks;
  }
}
