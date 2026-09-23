import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface PaymentRow {
  id: string;
  method: "ONLINE" | "OFFLINE";
  status: "PENDING" | "PAID" | "FAILED";
  amount: string;
  paidAt?: string | null;
  appointment: {
    scheduledStart: string;
    customer: { fullName: string; phone: string };
    services: { service: { name: string } }[];
  };
}

function formatPrice(n: string) {
  return Number(n).toLocaleString("vi-VN") + "đ";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ payments: PaymentRow[] }>("/payments")
      .then((res) => setPayments(res.payments))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function settle(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/payments/${id}/settle`, { method: "PATCH" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Quản lý thanh toán, hoá đơn</h1>
      <p className="text-gray-500 mb-6 text-sm">Tổng đã thu: {formatPrice(String(totalPaid))}</p>
      {loading && <p className="text-gray-500">Đang tải...</p>}
      <div className="space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="font-medium">{formatDateTime(p.appointment.scheduledStart)}</p>
              <p className="text-sm text-gray-600">{p.appointment.services.map((s) => s.service.name).join(", ")}</p>
              <p className="text-sm text-gray-500">{p.appointment.customer.fullName} - {p.appointment.customer.phone}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formatPrice(p.amount)}</p>
              <p className="text-xs text-gray-500">{p.method === "ONLINE" ? "Trực tuyến" : "Tại salon"}</p>
              {p.status === "PAID" ? (
                <span className="text-xs text-green-600">Đã thu</span>
              ) : (
                <button
                  onClick={() => settle(p.id)}
                  disabled={busyId === p.id}
                  className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                >
                  Xác nhận đã thu
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!loading && payments.length === 0 && <p className="text-gray-500">Chưa có giao dịch nào.</p>}
    </div>
  );
}
