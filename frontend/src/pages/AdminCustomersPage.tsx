import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { CustomerRow } from "../types";

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  function load(q?: string) {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    apiFetch<{ customers: CustomerRow[] }>(`/customers${params}`)
      .then((res) => setCustomers(res.customers))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  async function toggleLock(customer: CustomerRow) {
    await apiFetch(`/customers/${customer.id}/lock`, { method: "PATCH", body: JSON.stringify({ locked: !customer.locked }) });
    load(query);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Quản lý khách hàng</h1>

      <div className="flex gap-2 mb-6">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 flex-1"
          placeholder="Tìm theo tên, số điện thoại hoặc email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
        />
        <button onClick={() => load(query)} className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900">
          Tìm
        </button>
      </div>

      {loading && <p className="text-gray-500">Đang tải...</p>}
      {!loading && customers.length === 0 && <p className="text-gray-500">Không tìm thấy khách hàng nào.</p>}
      <div className="space-y-2">
        {customers.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-medium">
                {c.fullName} {c.locked && <span className="text-xs text-red-500">(đã khoá)</span>}
                {c.isQuickProfile && <span className="text-xs text-gray-400"> - đặt lịch nhanh</span>}
              </p>
              <p className="text-sm text-gray-500">
                {c.phone} {c.email ? `- ${c.email}` : ""}
              </p>
            </div>
            <button onClick={() => toggleLock(c)} className="text-sm text-brand-600 hover:underline">
              {c.locked ? "Mở khoá" : "Khoá"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
