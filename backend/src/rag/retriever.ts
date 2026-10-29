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

  try {
    const vectors = await embedTexts(chunks.map((c) => c.text));
    console.log(`[RAG] Đã vector hoá thành công ${vectors.length} đoạn tri thức với Gemini Embedding.`);
    return chunks.map((c, i) => ({ ...c, vector: vectors[i] ?? null }));
  } catch (err) {
    console.error("[RAG] Lỗi khi tạo embeddings cho knowledge base, dùng fallback keyword:", err);
    return chunks.map((c) => ({ ...c, vector: null }));
  }
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

// Phase 2 (Retrieval): trả về Top-K đoạn tri thức liên quan nhất tới câu hỏi của khách hàng.
// Tối ưu tốc độ: Ưu tiên Keyword Retrieval siêu tốc cục bộ (<0.5ms). Nếu tìm thấy đoạn liên quan,
// trả về ngay mà KHÔNG mất 2-3s gọi API mạng. Chỉ gọi Dense Retrieval (Gemini Embedding) khi hoàn toàn không có từ khóa trùng.
export async function retrieveContext(query: string, k = 3): Promise<string[]> {
  const index = await getIndex();
  if (index.length === 0) return [];

  // 1. Keyword Retrieval siêu tốc (<0.5ms trong bộ nhớ)
  const scoredKeyword = index
    .map((chunk) => ({ chunk, score: keywordScore(query, chunk.text) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Nếu câu hỏi khớp từ khóa (dù chỉ 1 từ liên quan), dùng ngay kết quả này để phản hồi lập tức
  if (scoredKeyword.length > 0) {
    return scoredKeyword.slice(0, k).map((s) => `[${s.chunk.sourceTitle}] ${s.chunk.text}`);
  }

  // 2. Dense Retrieval (Gemini Embedding) chỉ khi không tìm thấy từ khóa nào và câu hỏi đủ dài
  if (isEmbeddingAvailable() && query.trim().length >= 15) {
    try {
      const queryVector = await embedQuery(query);
      if (queryVector.length > 0) {
        const denseScored = index
          .filter((chunk) => chunk.vector && chunk.vector.length > 0)
          .map((chunk) => ({
            chunk,
            score: cosineSimilarity(queryVector, chunk.vector!),
          }))
          .filter((item) => item.score >= 0.5)
          .sort((a, b) => b.score - a.score);

        if (denseScored.length > 0) {
          return denseScored.slice(0, k).map((s) => `[${s.chunk.sourceTitle}] ${s.chunk.text}`);
        }
      }
    } catch (err) {
      console.warn("[RAG] Lỗi tính similarity với Gemini embeddings:", err);
    }
  }

  return [];
}
