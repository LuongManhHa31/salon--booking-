import { Router } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { Content, FunctionDeclaration } from "@google/genai";
import { prisma } from "../prisma";
import { getAnthropicClient, CHAT_MODEL } from "../utils/anthropic";
import { withGemini, isGeminiConfigured, GEMINI_CHAT_MODEL } from "../utils/gemini";
import { computeAvailableSlots } from "../utils/availability";
import { SALON_OPEN_HOUR, SALON_CLOSE_HOUR } from "../utils/schedule";
import { retrieveContext } from "../rag/retriever";

const router = Router();

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1)
    .max(30),
});

const HANDOFF_MARKER = "[HANDOFF]";
const SUGGESTION_MARKER = "[GỢI_Ý]:";

interface SlotToolInput {
  date: string;
  serviceNames: string[];
}

async function runGetAvailableSlots(input: SlotToolInput) {
  const catalog = await prisma.service.findMany({ where: { isActive: true } });
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
    .slice(0, 50) // Limit to 50 to avoid prompt size explosion
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
BẮT BUỘC TRẢ LỜI CỰC KỲ NGẮN GỌN VÀ SÚC TÍCH (DƯỚI 30 TỪ). Việc trả lời ngắn giúp hệ thống phản hồi cực nhanh trong 1 giây.
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
Nhiệm vụ chính: hiểu nhu cầu của khách hàng, gợi ý dịch vụ phù hợp trong danh mục trên, tư vấn kiểu tóc, nhân viên, và dùng công cụ
get_available_slots để tra cứu khung giờ trống thực tế khi khách hàng đã chọn được dịch vụ và ngày mong muốn.
Không tự bịa khung giờ.

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

NẾU khách hàng đã chốt xong nhu cầu, đồng ý đặt lịch hoặc đã chọn được người/dịch vụ cụ thể và muốn tiến hành đặt lịch, hãy chèn chính xác cụm "[BOOK_NOW;staffId;serviceIds;date]" vào cuối cùng của câu trả lời (trước cụm gợi ý).
Trong đó:
- staffId: ID của nhân viên khách chọn (nếu có, nếu không thì điền NONE)
- serviceIds: Các ID dịch vụ khách chọn, phân cách bằng dấu phẩy (ví dụ: id1,id2) (nếu không xác định thì điền NONE)
- date: Ngày khách chọn (định dạng YYYY-MM-DD, nếu không có điền NONE)
Ví dụ: [BOOK_NOW;cuid123;cuid456,cuid789;2026-09-24]
Điều này sẽ ra lệnh cho giao diện hiển thị nút Đặt lịch trực tiếp.`;
}

function extractHandoff(text: string): { reply: string; handoff: boolean } {
  const handoff = text.startsWith(HANDOFF_MARKER);
  return { reply: text.replace(HANDOFF_MARKER, "").trim(), handoff };
}

interface BookingIntent {
  staffId?: string;
  serviceIds?: string;
  date?: string;
}

function extractBookNow(text: string): { reply: string; bookingIntent?: BookingIntent } {
  const match = text.match(/\[BOOK_NOW;(.*?);(.*?);(.*?)\]/);
  if (!match) {
    const fallbackMatch = text.match(/\[BOOK_NOW\]/);
    if (fallbackMatch) {
      return { reply: text.replace(/\[BOOK_NOW\]/, "").trim(), bookingIntent: {} };
    }
    return { reply: text, bookingIntent: undefined };
  }
  
  const staffId = match[1] === "NONE" ? undefined : match[1];
  const serviceIds = match[2] === "NONE" ? undefined : match[2];
  const date = match[3] === "NONE" ? undefined : match[3];

  return {
    reply: text.replace(match[0], "").trim(),
    bookingIntent: { staffId, serviceIds, date },
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

async function chatWithAnthropic(userMessages: { role: "user" | "assistant"; content: string }[]) {
  const client = getAnthropicClient();
  const lastUserMessage = [...userMessages].reverse().find((m) => m.role === "user")?.content ?? "";
  const [contextChunks, services, staffList, hairstyles] = await Promise.all([
    retrieveContext(lastUserMessage),
    prisma.service.findMany({ where: { isActive: true } }),
    prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } }, include: { staffProfile: true } }),
    prisma.hairstyle.findMany(),
  ]);
  const systemPrompt = buildSystemPrompt(services, contextChunks, staffList, hairstyles);
  const messages: Anthropic.MessageParam[] = userMessages.map((m) => ({ role: m.role, content: m.content }));

  for (let iteration = 0; iteration < 3; iteration++) {
    const response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 300,
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

async function chatWithGemini(userMessages: { role: "user" | "assistant"; content: string }[]) {
  const lastUserMessage = [...userMessages].reverse().find((m) => m.role === "user")?.content ?? "";
  const [contextChunks, services, staffList, hairstyles] = await Promise.all([
    retrieveContext(lastUserMessage),
    prisma.service.findMany({ where: { isActive: true } }),
    prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } }, include: { staffProfile: true } }),
    prisma.hairstyle.findMany(),
  ]);
  const systemPrompt = buildSystemPrompt(services, contextChunks, staffList, hairstyles);

  const history: Content[] = userMessages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = userMessages[userMessages.length - 1].content;

  // Toàn bộ phiên chat (kể cả vòng lặp gọi tool) chạy trong withGemini để nếu key hiện tại hết
  // quota giữa chừng, tự làm lại từ đầu với key tiếp theo thay vì lỗi luôn.
  const text = await withGemini(async (client) => {
    const chat = client.chats.create({
      model: GEMINI_CHAT_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: [geminiSlotsTool] }],
        maxOutputTokens: 80,
      },
      history,
    });

    let response = await chat.sendMessage({ message: lastMessage });

    for (let iteration = 0; iteration < 3; iteration++) {
      const calls = response.functionCalls;
      if (!calls || calls.length === 0) break;

      const call = calls[0];
      const result = await runGetAvailableSlots(call.args as unknown as SlotToolInput);
      response = await chat.sendMessage({
        message: [{ functionResponse: { name: call.name ?? "get_available_slots", response: result } }],
      });
    }

    return (response.text ?? "").trim();
  });

  return parseAssistantReply(text);
}

// UC019 - Chatbot tư vấn dịch vụ và khung giờ phù hợp bằng ngôn ngữ tự nhiên
// Ưu tiên Gemini nếu đã cấu hình GEMINI_API_KEY, ngược lại dùng Claude (ANTHROPIC_API_KEY).
router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Nội dung trò chuyện không hợp lệ" });
  }

  const useGemini = isGeminiConfigured();
  const useAnthropic = !useGemini && Boolean(process.env.ANTHROPIC_API_KEY);
  if (!useGemini && !useAnthropic) {
    return res.status(503).json({ message: "Chưa cấu hình GEMINI_API_KEY hoặc ANTHROPIC_API_KEY, không thể sử dụng chatbot" });
  }

  try {
    const result = useGemini ? await chatWithGemini(parsed.data.messages) : await chatWithAnthropic(parsed.data.messages);
    return res.json(result);
  } catch (err) {
    console.error("Lỗi chatbot:", err);
    res.status(502).json({ message: "Chatbot đang gặp sự cố, vui lòng thử lại sau" });
  }
});

export default router;
