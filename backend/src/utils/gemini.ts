import { GoogleGenAI } from "@google/genai";

export const GEMINI_CHAT_MODEL = "gemini-3.7-flash";

// GEMINI_API_KEY có thể chứa nhiều key cách nhau bằng dấu phẩy (mỗi key từ một tài khoản Google
// khác nhau có quota free-tier riêng). Khi một key bị lỗi hết quota, withGemini() tự động thử
// key tiếp theo trong danh sách thay vì báo lỗi ngay.
function getApiKeys(): string[] {
  return (process.env.GEMINI_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function isGeminiConfigured(): boolean {
  return getApiKeys().length > 0;
}

const clientsByKey = new Map<string, GoogleGenAI>();

function getClientForKey(key: string): GoogleGenAI {
  let client = clientsByKey.get(key);
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
    clientsByKey.set(key, client);
  }
  return client;
}

function isQuotaExceededError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);
}

// Chạy một thao tác Gemini, tự động xoay qua key tiếp theo trong GEMINI_API_KEY nếu key hiện tại
// báo lỗi hết quota (429). Với lỗi khác (không phải quota), dừng ngay và ném lỗi ra luôn.
export async function withGemini<T>(operation: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY, không thể sử dụng Gemini");
  }

  let lastError: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await operation(getClientForKey(keys[i]));
    } catch (err) {
      lastError = err;
      if (!isQuotaExceededError(err)) throw err;
      if (i < keys.length - 1) {
        console.warn(`Gemini key #${i + 1} hết quota, chuyển sang key #${i + 2}/${keys.length}`);
      }
    }
  }
  throw lastError;
}
