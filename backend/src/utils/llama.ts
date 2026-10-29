export const DEFAULT_LLAMA_MODEL = "llama3.1:8b";
export const DEFAULT_LLAMA_BASE_URL = "http://127.0.0.1:11434";

export function getLlamaBaseUrl(): string {
  return process.env.LLAMA_BASE_URL || DEFAULT_LLAMA_BASE_URL;
}

export function getLlamaModel(): string {
  return process.env.LLAMA_MODEL || DEFAULT_LLAMA_MODEL;
}

export function isLlamaConfigured(): boolean {
  // Có cấu hình LLAMA_BASE_URL hoặc mặc định hướng về Ollama localhost:11434
  return Boolean(process.env.LLAMA_BASE_URL || process.env.LLAMA_MODEL || process.env.AI_PROVIDER === "llama");
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
}

let cachedHealth: {
  timestamp: number;
  data: {
    available: boolean;
    activeModel: string;
    baseUrl: string;
    installedModels: string[];
    error?: string;
  };
} | null = null;

/**
 * Kiểm tra trạng thái Ollama/Llama cục bộ và danh sách model đã tải về.
 * Có cache 15 giây để tránh chậm luồng chat mỗi khi kiểm tra tự động.
 */
export async function checkLlamaHealth(forceRefresh = false): Promise<{
  available: boolean;
  activeModel: string;
  baseUrl: string;
  installedModels: string[];
  error?: string;
}> {
  const now = Date.now();
  if (!forceRefresh && cachedHealth && now - cachedHealth.timestamp < 15000) {
    return cachedHealth.data;
  }

  const baseUrl = getLlamaBaseUrl();
  const activeModel = getLlamaModel();

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(1000), // Timeout 1s để không làm trễ phản hồi
    });

    if (!res.ok) {
      const data = {
        available: false,
        activeModel,
        baseUrl,
        installedModels: [],
        error: `Ollama trả về HTTP ${res.status}`,
      };
      cachedHealth = { timestamp: now, data };
      return data;
    }

    const dataJson = (await res.json()) as { models?: OllamaModelInfo[] };
    const installedModels = (dataJson.models || []).map((m) => m.name);

    const data = {
      available: true,
      activeModel,
      baseUrl,
      installedModels,
    };
    cachedHealth = { timestamp: now, data };
    return data;
  } catch (err: any) {
    const data = {
      available: false,
      activeModel,
      baseUrl,
      installedModels: [],
      error: err?.message || "Không thể kết nối tới Ollama trên cổng 11434",
    };
    cachedHealth = { timestamp: now, data };
    return data;
  }
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown> | string;
    };
  }>;
}

export const OLLAMA_SLOTS_TOOL = {
  type: "function",
  function: {
    name: "get_available_slots",
    description: "Tra cứu các khung giờ còn trống của salon cho một ngày cụ thể (YYYY-MM-DD) và danh sách tên dịch vụ.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Ngày cần tra cứu, định dạng YYYY-MM-DD",
        },
        serviceNames: {
          type: "array",
          items: { type: "string" },
          description: "Tên các dịch vụ khách hàng muốn đặt",
        },
      },
      required: ["date", "serviceNames"],
    },
  },
};

/**
 * Gửi tin nhắn đến Ollama / Local Llama API (/api/chat).
 * Hỗ trợ function calling tự động với tối đa 3 vòng lặp.
 */
export async function callOllamaChat(params: {
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onExecuteTool?: (name: string, args: any) => Promise<any>;
}): Promise<string> {
  const baseUrl = getLlamaBaseUrl();
  const model = params.model || getLlamaModel();

  const conversation: OllamaChatMessage[] = [
    { role: "system", content: params.systemPrompt },
    ...params.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let iteration = 0; iteration < 3; iteration++) {
    const payload: any = {
      model,
      messages: conversation,
      stream: false,
      options: {
        temperature: 0.5,
        num_predict: 512,
      },
    };

    if (params.onExecuteTool) {
      payload.tools = [OLLAMA_SLOTS_TOOL];
    }

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000), // Cho phép chạy tối đa 60s trên máy cá nhân
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Lỗi kết nối Ollama (${res.status}): ${errBody || res.statusText}`);
    }

    const data = (await res.json()) as {
      message?: OllamaChatMessage;
    };

    const replyMessage = data.message;
    if (!replyMessage) {
      throw new Error("Ollama không trả về nội dung tin nhắn");
    }

    // Nếu mô hình yêu cầu gọi tool
    const toolCalls = replyMessage.tool_calls;
    if (toolCalls && toolCalls.length > 0 && params.onExecuteTool) {
      conversation.push(replyMessage);

      for (const call of toolCalls) {
        let args = call.function.arguments;
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }
        const toolResult = await params.onExecuteTool(call.function.name, args);
        conversation.push({
          role: "tool",
          content: JSON.stringify(toolResult),
        });
      }
      continue;
    }

    return replyMessage.content || "";
  }

  return "Xin lỗi, cuộc trò chuyện vượt quá giới hạn xử lý. Bạn vui lòng thử lại nhé.";
}
