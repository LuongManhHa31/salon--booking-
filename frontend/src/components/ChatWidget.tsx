import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { ChatMessage } from "../types";

const DEFAULT_SUGGESTIONS = ["Tôi muốn cắt tóc", "Xem bảng giá dịch vụ", "Chính sách hủy lịch", "Đặt lịch nhanh"];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Xin chào! Mình có thể tư vấn dịch vụ và khung giờ phù hợp cho bạn. Bạn muốn làm gì hôm nay?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  async function sendMessage(text: string) {
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await apiFetch<{ reply: string; handoff: boolean; suggestions?: string[]; bookingIntent?: { staffId?: string; serviceIds?: string; date?: string; time?: string } }>("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: nextMessages }),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, bookingIntent: res.bookingIntent }]);
      if (res.handoff) setHandoff(true);
      setSuggestions(res.suggestions ?? []);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof ApiError ? err.message : "Chatbot đang gặp sự cố, vui lòng thử lại sau." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    sendMessage(input.trim());
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="w-80 h-96 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col mb-3">
          <div className="bg-brand-600 text-white px-4 py-2.5 rounded-t-lg flex justify-between items-center">
            <span className="font-medium text-sm">Tư vấn salon (AI)</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.map((m, i) => {
              const params = new URLSearchParams();
              if (m.bookingIntent?.staffId) params.set("staffId", m.bookingIntent.staffId);
              if (m.bookingIntent?.serviceIds) params.set("serviceIds", m.bookingIntent.serviceIds);
              if (m.bookingIntent?.date) params.set("date", m.bookingIntent.date);
              if (m.bookingIntent?.time) params.set("time", m.bookingIntent.time);

              return (
              <div key={i} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  <span
                    className={`inline-block px-3 py-1.5 rounded-lg max-w-[85%] ${
                      m.role === "user" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {m.content}
                  </span>
                </div>
                {m.bookingIntent && (
                  <Link
                    to={`/quick-booking?${params.toString()}`}
                    className="inline-flex items-center gap-1.5 bg-brand-500 text-white px-3 py-1.5 text-xs font-medium rounded-md shadow hover:bg-brand-600 transition-colors"
                  >
                    📅 Đặt lịch ngay
                  </Link>
                )}
              </div>
            )})}
            {loading && <p className="text-xs text-gray-400">Đang trả lời...</p>}
            {handoff && (
              <p className="text-xs text-amber-600 border-t pt-2">
                Yêu cầu này sẽ được chuyển cho nhân viên hỗ trợ trực tiếp.
              </p>
            )}
          </div>
          {suggestions.length > 0 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-xs border border-brand-200 text-brand-700 bg-brand-50 rounded-full px-2.5 py-1 hover:bg-brand-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSend} className="p-2 border-t flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              placeholder="Nhập câu hỏi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" disabled={loading} className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700 disabled:opacity-50">
              Gửi
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-brand-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-brand-700"
        aria-label="Mở chat tư vấn"
      >
        💬
      </button>
    </div>
  );
}
