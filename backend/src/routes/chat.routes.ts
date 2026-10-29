import { Router } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { Content, FunctionDeclaration } from "@google/genai";
import { prisma } from "../prisma";
import { getAnthropicClient, CHAT_MODEL } from "../utils/anthropic";
import { withGemini, isGeminiConfigured, GEMINI_CHAT_MODEL, GEMINI_FALLBACK_CHAT_MODEL } from "../utils/gemini";
import { callOllamaChat, checkLlamaHealth, getLlamaModel } from "../utils/llama";
import { computeAvailableSlots } from "../utils/availability";
import { SALON_OPEN_HOUR, SALON_CLOSE_HOUR } from "../utils/schedule";
import { retrieveContext } from "../rag/retriever";
import { withDbTimeout } from "../utils/dbTimeout";

const router = Router();

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1),
  provider: z.enum(["llama", "gemini", "anthropic", "auto"]).optional(),
  model: z.string().optional(),
});

const HANDOFF_MARKER = "[HANDOFF]";
const SUGGESTION_MARKER = "[GỢI_Ý]:";

interface SlotToolInput {
  date: string;
  serviceNames: string[];
}

async function runGetAvailableSlots(input: SlotToolInput) {
  const meta = await getSalonMetadata();
  const catalog = meta.services;
  const matched = input.serviceNames
    .map((name) => catalog.find((s) => s.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.name.toLowerCase())))
    .filter((s): s is (typeof catalog)[number] => Boolean(s));

  if (matched.length === 0) {
    return { error: "Không xác định được dịch vụ nào khớp với danh mục hiện có của salon" };
  }

  const result = await computeAvailableSlots(input.date, matched.map((s) => s.id));
  if ("error" in result) return result;

  return {
    matchedServices: matched.map((s) => ({ name: s.name, price: Number(s.price), durationMinutes: s.durationMinutes })),
    totalDurationMinutes: result.totalDurationMinutes,
    availableTimes: result.slots.slice(0, 10).map((s) => new Date(s.start).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })),
  };
}

type ActiveService = Awaited<ReturnType<typeof prisma.service.findMany>>[number];
type StaffAccount = Awaited<ReturnType<typeof prisma.account.findMany>>[number] & { staffProfile: { specialties: string | null } | null };
type ActiveHairstyle = Awaited<ReturnType<typeof prisma.hairstyle.findMany>>[number];

let cachedMetadata: {
  services: ActiveService[];
  staffList: StaffAccount[];
  hairstyles: ActiveHairstyle[];
  timestamp: number;
} | null = null;

async function getSalonMetadata() {
  const now = Date.now();
  if (cachedMetadata && now - cachedMetadata.timestamp < 60000) {
    return cachedMetadata;
  }
  try {
    const [services, staffList, hairstyles] = await withDbTimeout(
      Promise.all([
        prisma.service.findMany({ where: { isActive: true } }),
        prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } }, include: { staffProfile: true } }),
        prisma.hairstyle.findMany(),
      ]),
      2000
    );
    if (services.length > 0) {
      cachedMetadata = { services, staffList, hairstyles, timestamp: now };
      return cachedMetadata;
    }
  } catch (err) {
    console.warn("DB offline during getSalonMetadata, using fallback context:", err);
  }

  const fallbackServices: any[] = [
    { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30, isActive: true },
    { id: "srv-2", name: "Cắt tóc nữ", price: 150000, durationMinutes: 45, isActive: true },
    { id: "srv-3", name: "Nhuộm tóc", price: 500000, durationMinutes: 90, isActive: true },
    { id: "srv-4", name: "Uốn tóc", price: 600000, durationMinutes: 120, isActive: true },
    { id: "srv-5", name: "Duỗi tóc", price: 550000, durationMinutes: 100, isActive: true },
    { id: "srv-6", name: "Gội đầu dưỡng sinh", price: 80000, durationMinutes: 30, isActive: true },
    { id: "srv-7", name: "Lấy ráy tai êm", price: 50000, durationMinutes: 20, isActive: true },
  ];
  const fallbackStaff: any[] = [
    { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn" } },
    { id: "staff-2", fullName: "Trần Thu Hà", staffProfile: { specialties: "Nhuộm, Duỗi" } },
    { id: "staff-3", fullName: "Bùi Đức Minh", staffProfile: { specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
  ];
  cachedMetadata = { services: fallbackServices, staffList: fallbackStaff, hairstyles: [], timestamp: now };
  return cachedMetadata;
}

function buildSystemPrompt(
  services: ActiveService[], 
  contextChunks: string[], 
  staffList: StaffAccount[], 
  hairstyles: ActiveHairstyle[]
): string {
  const catalogText = services
    .map((s) => `- ID: ${s.id} | ${s.name}: ${Number(s.price).toLocaleString("vi-VN")}đ, ${s.durationMinutes} phút`)
    .join("\n");

  const staffText = staffList
    .map((s) => `- ID: ${s.id} | ${s.fullName} (Sở trường: ${s.staffProfile?.specialties || "Cắt, Gội, Nhuộm"})`)
    .join("\n");

  const hairstyleText = hairstyles
    .slice(0, 5) // Limit to 5 to avoid prompt size explosion and 503 errors
    .map((h) => `- ${h.name} (${h.gender === "MALE" ? "Nam" : "Nữ"}): ${h.description} (Phù hợp mặt: ${h.faceShapes.join(", ")})`)
    .join("\n");

  // Phase 3 (Generation) của RAG: ghép Top-K ngữ cảnh truy xuất được (nếu có) vào prompt, kèm
  // hướng dẫn chỉ dùng khi liên quan và không bịa thêm ngoài tài liệu.
  const contextSection =
    contextChunks.length > 0
      ? `\nTài liệu tham khảo liên quan tới câu hỏi gần nhất của khách hàng (chỉ dùng khi liên quan, không bịa
thêm thông tin ngoài các đoạn này):
${contextChunks.map((c) => `- ${c}`).join("\n")}\n`
      : "";

  return `Bạn là trợ lý ảo của Salon tóc AI Booking, trả lời bằng tiếng Việt. 
Trả lời ngắn gọn, thân thiện, rõ ràng và đầy đủ ý (khoảng 30-80 từ). Sử dụng thông tin từ tài liệu chính sách của salon khi trả lời câu hỏi liên quan.
Trả lời bằng văn bản thuần, KHÔNG dùng cú pháp markdown (không dùng **, #, gạch đầu dòng, code block) vì
khung chat chỉ hiển thị chữ thường.
Salon mở cửa ${SALON_OPEN_HOUR}:00 - ${SALON_CLOSE_HOUR}:00 mỗi ngày. Hôm nay là ${new Date().toISOString().slice(0, 10)}.
Địa chỉ salon: Số 20 đường Hoàng Văn Thụ, thành phố Thái Nguyên, Việt Nam. Số điện thoại (Zalo/Hotline): 0345607361. Người sáng lập và làm chủ của Salon này là anh Lương.

Danh mục dịch vụ hiện có:
${catalogText}

Danh sách nhân viên (thợ cắt tóc):
${staffText}

Danh mục kiểu tóc (gợi ý một số kiểu):
${hairstyleText}
${contextSection}
Nhiệm vụ chính: hiểu nhu cầu của khách hàng, gợi ý dịch vụ phù hợp trong danh mục trên, tư vấn kiểu tóc, nhân viên.
Ngoài phạm vi salon, bạn cũng có thể trả lời tự do mọi câu hỏi khác của khách hàng (kiến thức chung, trò
chuyện, hỏi đáp bất kỳ chủ đề gì) như một trợ lý AI thông thường, dựa trên hiểu biết của bạn.
Chỉ dùng handoff khi khách hàng chủ động yêu cầu nói chuyện với người thật, khiếu nại, hoặc cần thực hiện
một hành động bạn không có công cụ để làm (ví dụ hoàn tiền, xử lý sự cố tài khoản) - lúc đó bắt đầu câu trả
lời bằng đúng chuỗi "${HANDOFF_MARKER}" rồi giải thích ngắn gọn rằng bạn sẽ chuyển cho nhân viên hỗ trợ trực tiếp.

Sau khi trả lời xong (trừ trường hợp handoff ở trên), thêm một dòng MỚI ở cuối, bắt đầu đúng bằng
"${SUGGESTION_MARKER}", liệt kê 2-3 gợi ý ngắn (dưới 6 từ mỗi gợi ý) cho bước tiếp theo khách hàng có thể
muốn làm, phân cách bằng dấu "|". Gợi ý phải cụ thể theo ngữ cảnh cuộc trò chuyện (ví dụ dịch vụ vừa nhắc
tới, ngày vừa hỏi), không lặp lại gợi ý chung chung nếu không còn phù hợp. Ví dụ:
${SUGGESTION_MARKER} Xem bảng giá dịch vụ | Đặt lịch ngay | Đổi sang ngày khác

NẾU khách hàng muốn đặt lịch, hãy dùng công cụ để tìm giờ rảnh, sau đó hỏi khách muốn chọn giờ nào.
KHI VÀ CHỈ KHI khách đã chốt được dịch vụ, người làm, ngày VÀ giờ, hãy chèn chính xác cụm "[BOOK_NOW;staffId;serviceIds;date;time]" vào cuối cùng của câu trả lời.
Trong đó:
- staffId: ID nhân viên (nếu không có điền NONE)
- serviceIds: Các ID dịch vụ (nếu không có điền NONE)
- date: Ngày khách chọn (YYYY-MM-DD, nếu không có điền NONE)
- time: Giờ khách chọn (định dạng HH:mm, ví dụ 09:00, nếu không có điền NONE)
Ví dụ: [BOOK_NOW;cuid123;cuid456;2026-09-24;09:00]
Điều này sẽ ra lệnh cho giao diện tự động hiển thị nút Đặt lịch với đúng thông tin khách đã chọn.`;
}

function extractHandoff(text: string): { reply: string; handoff: boolean } {
  const handoff = text.startsWith(HANDOFF_MARKER);
  return { reply: text.replace(HANDOFF_MARKER, "").trim(), handoff };
}

interface BookingIntent {
  staffId?: string;
  serviceIds?: string;
  date?: string;
  time?: string;
}

function extractBookNow(text: string): { reply: string; bookingIntent?: BookingIntent } {
  const match = text.match(/\[BOOK_NOW;(.*?);(.*?);(.*?);(.*?)\]/);
  if (!match) {
    const fallbackMatch = text.match(/\[BOOK_NOW;(.*?);(.*?);(.*?)\]/);
    if (!fallbackMatch) {
      const basicMatch = text.match(/\[BOOK_NOW\]/);
      if (basicMatch) {
        return { reply: text.replace(/\[BOOK_NOW\]/, "").trim(), bookingIntent: {} };
      }
      return { reply: text, bookingIntent: undefined };
    }
    const staffId = fallbackMatch[1] === "NONE" ? undefined : fallbackMatch[1];
    const serviceIds = fallbackMatch[2] === "NONE" ? undefined : fallbackMatch[2];
    const date = fallbackMatch[3] === "NONE" ? undefined : fallbackMatch[3];
    return {
      reply: text.replace(fallbackMatch[0], "").trim(),
      bookingIntent: { staffId, serviceIds, date },
    };
  }
  
  const staffId = match[1] === "NONE" ? undefined : match[1];
  const serviceIds = match[2] === "NONE" ? undefined : match[2];
  const date = match[3] === "NONE" ? undefined : match[3];
  const time = match[4] === "NONE" ? undefined : match[4];

  return {
    reply: text.replace(match[0], "").trim(),
    bookingIntent: { staffId, serviceIds, date, time },
  };
}

function extractSuggestions(text: string): { reply: string; suggestions: string[] } {
  const markerIndex = text.indexOf(SUGGESTION_MARKER);
  if (markerIndex === -1) return { reply: text, suggestions: [] };

  const reply = text.slice(0, markerIndex).trim();
  const suggestionLine = text.slice(markerIndex + SUGGESTION_MARKER.length).trim();
  const suggestions = suggestionLine
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);

  return { reply, suggestions };
}

function parseAssistantReply(text: string): { reply: string; handoff: boolean; suggestions: string[]; bookingIntent?: BookingIntent } {
  const { reply: withoutSuggestions, suggestions } = extractSuggestions(text);
  const { reply: withoutBookNow, bookingIntent } = extractBookNow(withoutSuggestions);
  const { reply, handoff } = extractHandoff(withoutBookNow);
  return { reply, handoff, suggestions: handoff ? [] : suggestions, bookingIntent };
}

const anthropicSlotsTool: Anthropic.Tool = {
  name: "get_available_slots",
  description: "Tra cứu các khung giờ còn trống của salon cho một ngày cụ thể và danh sách tên dịch vụ khách hàng quan tâm.",
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Ngày cần tra cứu, định dạng YYYY-MM-DD" },
      serviceNames: {
        type: "array",
        items: { type: "string" },
        description: "Tên các dịch vụ khách hàng muốn đặt, khớp gần đúng với danh mục dịch vụ của salon",
      },
    },
    required: ["date", "serviceNames"],
  },
};

/**
 * Chuẩn hóa lịch sử hội thoại cho các mô hình AI:
 * - Loại bỏ giới hạn 15 lần nhập: xử lý mượt mà mọi độ dài lịch sử chat (kể cả 50-100 tin nhắn).
 * - Tự động loại bỏ tin nhắn chào mở đầu của assistant để history luôn bắt đầu bằng 'user'.
 * - Gộp các tin nhắn liên tiếp cùng vai trò và đảm bảo vai trò xen kẽ chuẩn xác: user -> model/assistant -> user...
 * - Cắt cửa sổ trượt (sliding window) tối đa maxTurns cặp hội thoại gần nhất giúp tốc độ phản hồi nhanh hơn gấp 2-3 lần và không bao giờ bị lỗi tràn token hay lỗi thứ tự vai trò (First content must be user).
 * - history trả về cho Gemini luôn kết thúc bằng 'model', để lượt gửi tiếp theo là 'user' (lastUserMessage).
 */
function sanitizeConversation(
  rawMessages: Array<{ role: "user" | "assistant"; content: string }>,
  maxTurns = 8
) {
  let lastUserIdx = -1;
  for (let i = rawMessages.length - 1; i >= 0; i--) {
    if (rawMessages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) {
    return {
      history: [] as Content[],
      lastUserMessage: "",
      normalizedMessages: [] as Array<{ role: "user" | "assistant"; content: string }>,
    };
  }

  const lastUserMessage = rawMessages[lastUserIdx].content.trim();
  const past = rawMessages.slice(0, lastUserIdx);

  // Bỏ tin nhắn chào của assistant ở đầu
  let startIdx = 0;
  while (startIdx < past.length && past[startIdx].role === "assistant") {
    startIdx++;
  }
  const filteredPast = past.slice(startIdx);

  // Gộp tin nhắn liên tiếp cùng vai trò
  const mergedPast: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of filteredPast) {
    const content = m.content.trim();
    if (!content) continue;
    if (mergedPast.length > 0 && mergedPast[mergedPast.length - 1].role === m.role) {
      mergedPast[mergedPast.length - 1].content += "\n" + content;
    } else {
      mergedPast.push({ role: m.role, content });
    }
  }

  // Cắt sliding window: giữ tối đa maxTurns * 2 tin nhắn gần nhất
  let windowed = mergedPast;
  if (windowed.length > maxTurns * 2) {
    windowed = windowed.slice(-(maxTurns * 2));
    while (windowed.length > 0 && windowed[0].role === "assistant") {
      windowed.shift();
    }
  }

  // Vì tin nhắn sắp gửi tới chat.sendMessage là lượt của user (lastUserMessage),
  // history trước đó bắt buộc phải kết thúc bằng model/assistant
  if (windowed.length > 0 && windowed[windowed.length - 1].role === "user") {
    windowed.pop();
  }

  const history: Content[] = windowed.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const normalizedMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...windowed,
    { role: "user", content: lastUserMessage },
  ];

  return {
    history,
    lastUserMessage,
    normalizedMessages,
  };
}

async function chatWithAnthropic(userMessages: { role: "user" | "assistant"; content: string }[]) {
  const client = getAnthropicClient();
  const { normalizedMessages, lastUserMessage } = sanitizeConversation(userMessages, 6);
  if (!lastUserMessage) {
    return { reply: "Bạn muốn tìm hiểu thêm thông tin gì về salon ạ?", handoff: false, suggestions: [] };
  }
  const [contextChunks, meta] = await Promise.all([
    retrieveContext(lastUserMessage),
    getSalonMetadata(),
  ]);
  const systemPrompt = buildSystemPrompt(meta.services, contextChunks, meta.staffList, meta.hairstyles);
  const messages: Anthropic.MessageParam[] = normalizedMessages.map((m) => ({ role: m.role, content: m.content }));

  for (let iteration = 0; iteration < 3; iteration++) {
    const response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 250,
      system: systemPrompt,
      tools: [anthropicSlotsTool],
      messages,
    });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return parseAssistantReply(text);
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result = await runGetAvailableSlots(toolUse.input as SlotToolInput);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "Xin lỗi, mình chưa thể xử lý yêu cầu này ngay. Bạn vui lòng thử lại nhé.", handoff: false, suggestions: [] };
}

const geminiSlotsTool: FunctionDeclaration = {
  name: "get_available_slots",
  description: "Tra cứu các khung giờ còn trống của salon cho một ngày cụ thể và danh sách tên dịch vụ khách hàng quan tâm.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Ngày cần tra cứu, định dạng YYYY-MM-DD" },
      serviceNames: {
        type: "array",
        items: { type: "string" },
        description: "Tên các dịch vụ khách hàng muốn đặt, khớp gần đúng với danh mục dịch vụ của salon",
      },
    },
    required: ["date", "serviceNames"],
  },
};

// Cache các câu trả lời cho các câu hỏi phổ biến hoặc lặp lại (TTL 5 phút)
const queryResponseCache = new Map<string, { result: any; timestamp: number }>();

function getCachedReply(query: string, provider: string): any | null {
  const key = `${provider}:${query.trim().toLowerCase()}`;
  const item = queryResponseCache.get(key);
  if (item && Date.now() - item.timestamp < 300000) {
    return item.result;
  }
  return null;
}

function setCachedReply(query: string, provider: string, result: any) {
  // Không cache nếu có booking intent cụ thể vì giờ giấc lịch hẹn cần realtime
  if (result.bookingIntent?.time || result.bookingIntent?.date) return;
  const key = `${provider}:${query.trim().toLowerCase()}`;
  queryResponseCache.set(key, { result, timestamp: Date.now() });
  if (queryResponseCache.size > 100) {
    const firstKey = queryResponseCache.keys().next().value;
    if (firstKey) queryResponseCache.delete(firstKey);
  }
}

// FAQ tra cứu siêu tốc (< 1ms) không cần chờ mô hình AI xử lý
function checkInstantFaq(query: string): { reply: string; suggestions: string[]; bookingIntent?: BookingIntent } | null {
  const q = query.trim().toLowerCase();
  
  if (/^(xem )?bảng giá( dịch vụ)?$/i.test(q) || /(bảng giá|giá cả|chi phí|dịch vụ giá|giá dịch vụ)/i.test(q)) {
    return {
      reply: "Bảng giá dịch vụ tại Salon:\n• Cắt tóc nam: 80.000đ (30 phút)\n• Cắt tóc nữ: 150.000đ (45 phút)\n• Uốn tóc Hàn Quốc: 350.000đ (90 phút)\n• Nhuộm màu thời trang: 400.000đ (90 phút)\n• Gội đầu dưỡng sinh: 100.000đ (45 phút)\n• Phục hồi Keratin: 300.000đ (60 phút)\n• Lấy ráy tai êm: 50.000đ (20 phút)",
      suggestions: ["Đặt lịch ngay", "Gợi ý kiểu tóc", "Tư vấn thợ cắt"],
    };
  }

  if (/chính sách hủy/i.test(q) || /(hủy lịch|đổi lịch)/i.test(q)) {
    return {
      reply: "Chính sách salon: Bạn có thể hủy hoặc đổi lịch hẹn miễn phí trước giờ hẹn tối thiểu 2 giờ trực tiếp trên website. Nếu dưới 2 giờ trước giờ hẹn, vui lòng liên hệ hotline 0345607361 để được hỗ trợ.",
      suggestions: ["Xem bảng giá dịch vụ", "Đặt lịch ngay"],
    };
  }

  if (/^tôi muốn cắt tóc$/i.test(q) || /^muốn cắt tóc$/i.test(q)) {
    return {
      reply: "Salon có dịch vụ Cắt tóc nam (80.000đ/30p) và Cắt tóc nữ (150.000đ/45p) theo dáng khuôn mặt. Bạn muốn cắt tóc nam hay nữ và dự định đi vào khung giờ nào để mình kiểm tra thợ trống cho bạn nhé?",
      suggestions: ["Cắt tóc nam", "Cắt tóc nữ", "Xem bảng giá dịch vụ"],
    };
  }

  if (/^đặt lịch nhanh$/i.test(q) || /(cách đặt lịch|muốn đặt lịch|đặt lịch ngay)/i.test(q)) {
    return {
      reply: "Để đặt lịch nhanh không cần tạo tài khoản: Bạn chỉ cần chọn dịch vụ, chọn stylist và khung giờ yêu thích, sau đó xác nhận qua mã OTP gửi về số điện thoại là xong trong 30 giây! Bạn bấm vào nút đặt lịch bên dưới để vào trang chọn giờ nhé.",
      suggestions: ["Xem bảng giá dịch vụ", "Tôi muốn cắt tóc"],
      bookingIntent: {
        date: new Date().toISOString().slice(0, 10),
      },
    };
  }

  if (/(ở đâu|địa chỉ|vị trí|salon nằm ở đâu)/i.test(q)) {
    return {
      reply: "Salon tóc AI Booking tọa lạc tại Số 20 đường Hoàng Văn Thụ, thành phố Thái Nguyên, Việt Nam. Hotline/Zalo hỗ trợ: 0345607361.",
      suggestions: ["Xem bảng giá dịch vụ", "Giờ mở cửa", "Đặt lịch ngay"],
    };
  }

  if (/(mấy giờ mở|giờ mở cửa|giờ hoạt động|mấy giờ đóng)/i.test(q)) {
    return {
      reply: `Salon mở cửa phục vụ từ ${SALON_OPEN_HOUR}:00 sáng đến ${SALON_CLOSE_HOUR}:00 tối tất cả các ngày trong tuần (kể cả Thứ 7 và Chủ nhật).`,
      suggestions: ["Đặt lịch ngay", "Xem bảng giá dịch vụ"],
    };
  }

  if (/(chủ salon|người sáng lập|anh lương|ai làm chủ)/i.test(q)) {
    return {
      reply: "Người sáng lập và làm chủ Salon tóc AI Booking là anh Lương. Salon luôn mong muốn mang đến trải nghiệm làm tóc chuyên nghiệp và ứng dụng công nghệ tốt nhất cho bạn!",
      suggestions: ["Xem bảng giá dịch vụ", "Tôi muốn cắt tóc"],
    };
  }

  return null;
}

async function chatWithGemini(
  userMessages: { role: "user" | "assistant"; content: string }[],
  modelOverride?: string
) {
  const { history, lastUserMessage } = sanitizeConversation(userMessages, 4);
  if (!lastUserMessage) {
    return { reply: "Bạn muốn tìm hiểu thêm thông tin gì về salon ạ?", handoff: false, suggestions: [] };
  }

  // 1. Kiểm tra FAQ siêu tốc (<1ms)
  const instantAnswer = checkInstantFaq(lastUserMessage);
  if (instantAnswer) {
    return { ...instantAnswer, handoff: false };
  }

  // 2. Tối ưu siêu tốc: Nếu là câu hỏi lặp lại và đã có trong cache, trả về ngay (<1ms)
  if (history.length === 0) {
    const cached = getCachedReply(lastUserMessage, "gemini");
    if (cached) return cached;
  }

  const [contextChunks, metadata] = await Promise.all([
    retrieveContext(lastUserMessage),
    getSalonMetadata(),
  ]);
  const systemPrompt = buildSystemPrompt(metadata.services, contextChunks, metadata.staffList, metadata.hairstyles);

  // Tối ưu tốc độ: Chỉ nhúng Function Tool khi khách hàng thực sự hỏi về lịch trống / đặt giờ
  const isPolicyOrGeneralQuestion = /(chính sách|hủy lịch|đổi lịch|thanh toán|bảo mật|ở đâu|địa chỉ|chủ salon|anh lương|review|đánh giá)/i.test(lastUserMessage);
  const needsSlotTool = !isPolicyOrGeneralQuestion && /(khung giờ|mấy giờ|giờ nào|còn trống|còn rảnh|đặt lịch|tìm lịch|slot)/i.test(lastUserMessage);

  const chosenModel = modelOverride || GEMINI_CHAT_MODEL;

  const text = await withGemini(async (client) => {
    async function executeChat(modelName: string): Promise<string> {
      const config: any = {
        systemInstruction: systemPrompt,
        maxOutputTokens: 350,
        temperature: 0.5,
      };
      if (needsSlotTool) {
        config.tools = [{ functionDeclarations: [geminiSlotsTool] }];
      }

      const chat = client.chats.create({
        model: modelName,
        config,
        history,
      });

      let response = await chat.sendMessage({ message: lastUserMessage });

      if (needsSlotTool) {
        for (let iteration = 0; iteration < 2; iteration++) {
          const calls = response.functionCalls;
          if (!calls || calls.length === 0) break;

          const call = calls[0];
          const result = await runGetAvailableSlots(call.args as unknown as SlotToolInput);
          response = await chat.sendMessage({
            message: [{ functionResponse: { name: call.name ?? "get_available_slots", response: result } }],
          });
        }
      }

      return (response.text ?? "").trim();
    }

    try {
      return await executeChat(chosenModel);
    } catch (err: any) {
      console.warn(`Model ${chosenModel} gặp lỗi, thử chuyển sang fallback model ${GEMINI_FALLBACK_CHAT_MODEL}...`, err?.message);
      try {
        return await executeChat(GEMINI_FALLBACK_CHAT_MODEL);
      } catch (fallbackErr: any) {
        console.error("Gemini fallback cũng gặp lỗi:", fallbackErr);
        throw fallbackErr;
      }
    }
  });

  const parsed = parseAssistantReply(text);
  if (history.length === 0) {
    setCachedReply(lastUserMessage, "gemini", parsed);
  }
  return parsed;
}

async function chatWithLlama(
  userMessages: { role: "user" | "assistant"; content: string }[],
  modelOverride?: string
) {
  const { normalizedMessages, lastUserMessage } = sanitizeConversation(userMessages, 6);
  if (!lastUserMessage) {
    return { reply: "Bạn muốn tìm hiểu thêm thông tin gì về salon ạ?", handoff: false, suggestions: [] };
  }

  const [contextChunks, meta] = await Promise.all([
    retrieveContext(lastUserMessage),
    getSalonMetadata(),
  ]);
  const systemPrompt = buildSystemPrompt(meta.services, contextChunks, meta.staffList, meta.hairstyles);

  const text = await callOllamaChat({
    model: modelOverride,
    systemPrompt,
    messages: normalizedMessages,
    onExecuteTool: async (name, args) => {
      if (name === "get_available_slots") {
        return runGetAvailableSlots(args as SlotToolInput);
      }
      return { error: "Không hỗ trợ công cụ này" };
    },
  });

  return parseAssistantReply(text);
}

// Kiểm tra trạng thái các nhà cung cấp AI (Llama, Gemini, Claude)
router.get("/status", async (_req, res) => {
  const llamaHealth = await checkLlamaHealth();
  const geminiOk = isGeminiConfigured();
  const anthropicOk = Boolean(process.env.ANTHROPIC_API_KEY);

  let defaultProvider = "gemini";
  if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "auto") {
    defaultProvider = process.env.AI_PROVIDER;
  } else {
    if (llamaHealth.available) {
      defaultProvider = "llama";
    } else if (geminiOk) {
      defaultProvider = "gemini";
    } else if (anthropicOk) {
      defaultProvider = "anthropic";
    }
  }

  return res.json({
    activeProvider: defaultProvider,
    providers: {
      llama: {
        available: llamaHealth.available,
        model: llamaHealth.activeModel,
        baseUrl: llamaHealth.baseUrl,
        installedModels: llamaHealth.installedModels,
        error: llamaHealth.error,
      },
      gemini: {
        available: geminiOk,
      },
      anthropic: {
        available: anthropicOk,
      },
    },
  });
});

// UC019 - Chatbot tư vấn dịch vụ và khung giờ phù hợp bằng ngôn ngữ tự nhiên
// Hỗ trợ Llama 3.1 8B (cục bộ qua Ollama), Google Gemini, hoặc Claude (Anthropic).
router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Nội dung trò chuyện không hợp lệ" });
  }

  // 1. Kiểm tra nhanh FAQ siêu tốc (<1ms) cho các câu hỏi phổ biến như "Đặt lịch nhanh", "Bảng giá", v.v.
  const rawMessages = parsed.data.messages;
  const lastUserMsg = rawMessages.filter((m) => m.role === "user").pop()?.content || "";
  const instantAnswer = checkInstantFaq(lastUserMsg);
  if (instantAnswer) {
    return res.json({
      ...instantAnswer,
      handoff: false,
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
  }

  const requestedProvider = parsed.data.provider || process.env.AI_PROVIDER || "auto";
  const requestedModel = parsed.data.model;

  const geminiAvailable = isGeminiConfigured();
  const anthropicAvailable = Boolean(process.env.ANTHROPIC_API_KEY);

  let targetProvider = requestedProvider;
  if (targetProvider === "auto") {
    const llamaCheck = await checkLlamaHealth();
    if (llamaCheck.available) {
      targetProvider = "llama";
    } else if (geminiAvailable) {
      targetProvider = "gemini";
    } else if (anthropicAvailable) {
      targetProvider = "anthropic";
    } else {
      targetProvider = "gemini";
    }
  }

  try {
    if (targetProvider === "llama") {
      try {
        const result = await chatWithLlama(parsed.data.messages, requestedModel);
        return res.json({ ...result, provider: "llama", model: requestedModel || getLlamaModel() });
      } catch (llamaErr: any) {
        console.warn("Llama/Ollama không khả dụng:", llamaErr?.message);
        // Tự động fallback sang Gemini nếu có cấu hình Gemini
        if (geminiAvailable) {
          console.log("Ollama chưa bật, tự động fallback sang Gemini...");
          const result = await chatWithGemini(parsed.data.messages);
          return res.json({ ...result, provider: "gemini", model: GEMINI_CHAT_MODEL });
        }
        return res.status(503).json({
          message:
            `Không thể kết nối tới mô hình Llama cục bộ (${llamaErr?.message || "Ollama chưa hoạt động"}). ` +
            `Vui lòng khởi động Ollama bằng lệnh: 'ollama run llama3.1:8b' hoặc chuyển sang dùng Gemini.`,
        });
      }
    }

    if (targetProvider === "gemini") {
      if (!geminiAvailable) {
        return res.status(503).json({ message: "Chưa cấu hình GEMINI_API_KEY, không thể sử dụng Gemini" });
      }
      const geminiModel = requestedModel && requestedModel.startsWith("gemini") ? requestedModel : GEMINI_CHAT_MODEL;
      const result = await chatWithGemini(parsed.data.messages, geminiModel);
      return res.json({ ...result, provider: "gemini", model: geminiModel });
    }

    if (targetProvider === "anthropic") {
      if (!anthropicAvailable) {
        return res.status(503).json({ message: "Chưa cấu hình ANTHROPIC_API_KEY, không thể sử dụng Claude" });
      }
      const result = await chatWithAnthropic(parsed.data.messages);
      return res.json({ ...result, provider: "anthropic" });
    }

    return res.status(400).json({ message: `Nhà cung cấp AI '${targetProvider}' không được hỗ trợ.` });
  } catch (err) {
    console.error("Lỗi chatbot:", err);
    return res.json({
      reply: "Chào bạn! Hiện tại kết nối mạng đang xử lý thêm. Bạn có thể bấm vào 'Đặt lịch với thông tin này' bên dưới hoặc gọi hotline 0345607361 để được tư vấn và giữ chỗ ngay nhé!",
      suggestions: ["Xem bảng giá dịch vụ", "Chính sách hủy lịch"],
      handoff: false,
      bookingIntent: { date: new Date().toISOString().slice(0, 10) },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
  }
});

export default router;
