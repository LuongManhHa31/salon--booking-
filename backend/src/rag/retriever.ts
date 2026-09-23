import { knowledgeBase } from "./knowledgeBase";
import { splitText } from "./textSplitter";
import { cosineSimilarity, embedQuery, embedTexts, isEmbeddingAvailable } from "./embeddings";

interface IndexedChunk {
  text: string;
  sourceTitle: string;
  vector: number[] | null;
}

let indexPromise: Promise<IndexedChunk[]> | null = null;

// Indexing: chia mỗi tài liệu tri thức thành các chunk, rồi (nếu có Gemini) vector hoá một lần
// và giữ trong bộ nhớ - tương ứng Phase 1 (Indexing) của RAG, đơn giản hoá cho quy mô nhỏ (không
// cần ANN/vector database chuyên dụng vì chỉ có vài chục chunk).
async function buildIndex(): Promise<IndexedChunk[]> {
  const chunks: { text: string; sourceTitle: string }[] = [];
  for (const doc of knowledgeBase) {
    for (const piece of splitText(doc.content)) {
      chunks.push({ text: piece, sourceTitle: doc.title });
    }
  }

  if (!isEmbeddingAvailable()) {
    return chunks.map((c) => ({ ...c, vector: null }));
  }

  const vectors = await embedTexts(chunks.map((c) => c.text));
  return chunks.map((c, i) => ({ ...c, vector: vectors[i] ?? null }));
}

function getIndex(): Promise<IndexedChunk[]> {
  if (!indexPromise) indexPromise = buildIndex();
  return indexPromise;
}

// Gọi một lần khi server khởi động để chỉ mục RAG (chunk + embedding) được xây sẵn trong nền,
// tránh việc tin nhắn chat đầu tiên sau mỗi lần khởi động phải chờ bước embedding này.
export function warmUpRetriever(): void {
  getIndex().catch((err) => console.error("Lỗi làm nóng chỉ mục RAG:", err));
}

// Fallback khi không có GEMINI_API_KEY: chấm điểm theo số từ trùng khớp giữa câu hỏi và chunk
// (tương tự Sparse/Keyword Retrieval trong tài liệu), thay vì Dense Retrieval bằng vector.
function keywordScore(query: string, text: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const textLower = text.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) score += 1;
  }
  return score;
}

// Phase 2 (Retrieval): trả về Top-K đoạn tri thức liên quan nhất tới câu hỏi của khách hàng,
// dùng Dense Retrieval (cosine similarity) khi có embedding, ngược lại dùng Keyword Retrieval.
export async function retrieveContext(query: string, k = 3): Promise<string[]> {
  const index = await getIndex();
  if (index.length === 0) return [];

  let scored: { chunk: IndexedChunk; score: number }[];

  // Bỏ qua Dense Retrieval (gọi API embedding) để tiết kiệm ~1-2 giây phản hồi,
  // chỉ dùng Keyword Retrieval cục bộ siêu nhanh vì dữ liệu knowledge base rất nhỏ.
  scored = index.map((chunk) => ({ chunk, score: keywordScore(query, chunk.text) }));

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => `[${s.chunk.sourceTitle}] ${s.chunk.text}`);
}
