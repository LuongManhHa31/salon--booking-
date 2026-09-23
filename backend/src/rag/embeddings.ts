import { isGeminiConfigured, withGemini } from "../utils/gemini";

export const EMBEDDING_MODEL = "gemini-embedding-001";

export function isEmbeddingAvailable(): boolean {
  return isGeminiConfigured();
}

// Gemini giới hạn số lượng contents mỗi lần gọi embedContent, nên chia theo lô nhỏ.
const BATCH_SIZE = 20;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await withGemini((client) => client.models.embedContent({ model: EMBEDDING_MODEL, contents: batch }));
    for (const embedding of response.embeddings ?? []) {
      results.push(embedding.values ?? []);
    }
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector ?? [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
