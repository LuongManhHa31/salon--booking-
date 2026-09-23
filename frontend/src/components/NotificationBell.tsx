import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { NotificationItem } from "../types";
import { useAuth } from "../context/AuthContext";

export function NotificationBell() {
  const { account } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  function load() {
    apiFetch<{ notifications: NotificationItem[] }>("/notifications")
      .then((res) => setItems(res.notifications))
      .catch(() => {});
  }

  useEffect(() => {
    if (!account) return;
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [account]);

  if (!account) return null;

  const unreadCount = items.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    load();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative text-gray-600 hover:text-brand-600">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
          {items.length === 0 && <p className="p-3 text-sm text-gray-500">Chưa có thông báo nào.</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`block w-full text-left p-3 border-b text-sm hover:bg-gray-50 ${n.readAt ? "text-gray-400" : "text-gray-800"}`}
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-xs">{n.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
