import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { ChatMessage } from "../types";

const DEFAULT_SUGGESTIONS = ["Tôi muốn cắt tóc", "Xem bảng giá dịch vụ", "Chính sách hủy lịch", "Đặt lịch nhanh"];

interface AIStatusResponse {
  activeProvider: string;
  providers: {
    llama: {
      available: boolean;
      model: string;
      baseUrl: string;
      installedModels: string[];
      error?: string;
    };
    gemini: {
      available: boolean;
    };
    anthropic: {
      available: boolean;
    };
  };
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"llama" | "gemini" | "auto">("auto");
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Xin chào! Mình là trợ lý AI Salon. Mình có thể tư vấn dịch vụ, chính sách, gợi ý kiểu tóc và tìm khung giờ trống giúp bạn!",
      provider: "gemini",
      model: "Gemini 2.5 Flash",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

  // Tự động focus ô nhập khi mở khung chat
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Lấy trạng thái mô hình khi mở chat
  useEffect(() => {
    if (open) {
      apiFetch<AIStatusResponse>("/chat/status")
        .then((data) => {
          setAiStatus(data);
          if (data.activeProvider) {
            setProvider(data.activeProvider as any);
          }
          if (data.activeProvider === "llama" && data.providers.llama?.model) {
            setModel(data.providers.llama.model);
          } else {
            setModel("gemini-2.5-flash-lite");
          }
        })
        .catch(() => {
          // Bỏ qua lỗi nếu backend chưa phản hồi
        });
    }
  }, [open]);

  async function sendMessage(text: string) {
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSuggestions([]);
    setLoading(true);

    try {
      const res = await apiFetch<{
        reply: string;
        handoff: boolean;
        suggestions?: string[];
        provider?: string;
        model?: string;
        bookingIntent?: { staffId?: string; serviceIds?: string; date?: string; time?: string };
      }>("/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages.slice(-50),
          provider: provider,
          model: model,
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          bookingIntent: res.bookingIntent,
          provider: res.provider,
          model: res.model,
        },
      ]);
      if (res.handoff) setHandoff(true);
      setSuggestions(res.suggestions ?? []);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof ApiError ? err.message : "Chatbot đang gặp sự cố, vui lòng thử lại sau.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    sendMessage(input.trim());
  }

  const isLlamaOnline = aiStatus?.providers.llama.available ?? false;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="w-[340px] sm:w-[380px] h-[520px] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col mb-3 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-3 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🦙</span>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Trợ lý AI Salon</h3>
                <p className="text-[11px] text-white/80">Tích hợp Gemini & RAG Knowledge Base</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      role: "assistant",
                      content: "Xin chào! Mình là trợ lý AI Salon. Mình có thể tư vấn dịch vụ, chính sách, gợi ý kiểu tóc và tìm khung giờ trống giúp bạn!",
                      provider: "gemini",
                      model: "Gemini 2.5 Flash",
                    },
                  ]);
                  setSuggestions(DEFAULT_SUGGESTIONS);
                }}
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors text-xs"
                title="Làm mới cuộc trò chuyện"
              >
                🔄
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
                title="Đóng chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Model / Provider Selector Toolbar */}
          <div className="bg-slate-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">Model:</span>
              <select
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as any;
                  setProvider(p);
                  if (p === "llama") {
                    setModel(aiStatus?.providers.llama?.model || "llama3.1:8b");
                  } else {
                    setModel("gemini-2.5-flash-lite");
                  }
                }}
                className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="llama">🦙 Llama 3.1 8B (Local)</option>
                <option value="gemini">✨ Google Gemini (Cloud)</option>
                <option value="auto">⚡ Tự động (Auto)</option>
              </select>
            </div>

            {/* Trạng thái Ollama */}
            {provider === "llama" && (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                  isLlamaOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
                title={
                  isLlamaOnline
                    ? "Ollama đang chạy và sẵn sàng"
                    : "Chưa bật Ollama! Mở CMD chạy lệnh: ollama run llama3.1:8b"
                }
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLlamaOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span>{isLlamaOnline ? "Online" : "Offline"}</span>
              </div>
            )}
          </div>

          {/* Thông báo nếu chọn Llama nhưng Ollama chưa online */}
          {provider === "llama" && !isLlamaOnline && (
            <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-[11px] text-amber-800 flex items-start gap-1.5">
              <span className="text-xs">💡</span>
              <div className="flex-1">
                Để chat với Llama 3.1 8B, mở CMD và gõ:{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-mono font-bold">
                  ollama run llama3.1:8b
                </code>{" "}
                hoặc chuyển sang <b>Gemini</b> để test ngay!
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm bg-gray-50/50">
            {messages.map((m, i) => {
              const params = new URLSearchParams();
              if (m.bookingIntent?.staffId) params.set("staffId", m.bookingIntent.staffId);
              if (m.bookingIntent?.serviceIds) params.set("serviceIds", m.bookingIntent.serviceIds);
              if (m.bookingIntent?.date) params.set("date", m.bookingIntent.date);
              if (m.bookingIntent?.time) params.set("time", m.bookingIntent.time);

              return (
                <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {/* Badge mô hình nếu là bot */}
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 pl-1">
                      {m.provider === "llama" ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium">
                          🦙 {m.model || "Llama 3.1 8B"}
                        </span>
                      ) : m.provider === "gemini" ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                          ✨ Gemini Cloud
                        </span>
                      ) : (
                        <span>AI Assistant</span>
                      )}
                    </div>
                  )}

                  <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                    <span
                      className={`inline-block px-3.5 py-2 rounded-2xl max-w-[88%] leading-relaxed ${
                        m.role === "user"
                          ? "bg-brand-600 text-white rounded-br-xs"
                          : "bg-white text-gray-800 shadow-sm border border-gray-200/80 rounded-bl-xs"
                      }`}
                    >
                      {m.content}
                    </span>
                  </div>

                  {m.bookingIntent && (
                    <Link
                      to={`/quick-booking?${params.toString()}`}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm hover:from-brand-600 hover:to-brand-700 transition-all mt-1"
                    >
                      📅 Đặt lịch với thông tin này
                    </Link>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-2.5 rounded-2xl rounded-bl-xs border border-gray-200/80 shadow-xs max-w-fit animate-in fade-in duration-200">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" />
                </div>
                <span className="text-[11px] text-gray-500 font-medium pl-1">
                  {provider === "llama" ? "Llama 3.1 đang suy nghĩ..." : "AI đang trả lời..."}
                </span>
              </div>
            )}

            {handoff && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                ⚠️ Yêu cầu này sẽ được chuyển tiếp cho nhân viên hỗ trợ trực tiếp.
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-xs border border-brand-200 text-brand-700 bg-brand-50/70 rounded-full px-2.5 py-1 hover:bg-brand-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input Form */}
          <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-gray-200 flex gap-2 items-center">
            <input
              ref={inputRef}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Hỏi về dịch vụ, giá, kiểu tóc..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              Gửi
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative group bg-gradient-to-r from-brand-600 to-brand-700 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 hover:shadow-xl transition-all"
        aria-label="Mở chat tư vấn AI"
      >
        <span>💬</span>
        <span className="absolute -top-1 -right-1 bg-blue-500 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full shadow border-2 border-white">
          AI
        </span>
      </button>
    </div>
  );
}
