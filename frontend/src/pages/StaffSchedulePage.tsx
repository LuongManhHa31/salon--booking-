import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { Appointment, AppointmentStatus } from "../types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

const nextStatusOptions: Record<string, { value: AppointmentStatus; label: string }[]> = {
  PENDING: [
    { value: "CONFIRMED", label: "Xác nhận đến" },
    { value: "NO_SHOW", label: "Khách không đến" },
  ],
  CONFIRMED: [
    { value: "COMPLETED", label: "Hoàn tất dịch vụ" },
    { value: "NO_SHOW", label: "Khách không đến" },
  ],
};

export function StaffSchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<{ appointments: Appointment[] } | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ appointments: Appointment[] }>("/appointments/staff/mine")
      .then((res) => setAppointments(res.appointments))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: AppointmentStatus) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái");
    } finally {
      setBusyId(null);
    }
  }

  async function saveNotes(id: string) {
    const notes = notesDraft[id];
    if (!notes) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/result`, { method: "PATCH", body: JSON.stringify({ resultNotes: notes }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu ghi chú");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCustomerInfo(customerId: string) {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null);
      setCustomerDetail(null);
      return;
    }
    setExpandedCustomer(customerId);
    try {
      const res = await apiFetch<{ appointments: Appointment[] }>(`/customers/${customerId}`);
      setCustomerDetail(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xem được thông tin khách hàng");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Lịch làm việc được phân công</h1>
      {loading && <p className="text-gray-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!loading && appointments.length === 0 && <p className="text-gray-500">Chưa có lịch hẹn nào.</p>}
      <div className="space-y-3">
        {appointments.map((a) => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="font-medium">{formatDateTime(a.scheduledStart)}</p>
            <p className="text-sm text-gray-600">{a.services.map((s) => s.service.name).join(", ")}</p>
            {a.customer && (
              <p className="text-sm text-gray-500">
                Khách hàng: {a.customer.fullName} - {a.customer.phone}{" "}
                <button className="text-brand-600 hover:underline" onClick={() => toggleCustomerInfo(a.customer!.id)}>
                  ({expandedCustomer === a.customer.id ? "ẩn" : "xem"} lịch sử)
                </button>
              </p>
            )}
            {expandedCustomer === a.customer?.id && customerDetail && (
              <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                {customerDetail.appointments.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    {formatDateTime(h.scheduledStart)} - {h.services.map((s) => s.service.name).join(", ")} ({h.status})
                  </li>
                ))}
              </ul>
            )}

            {nextStatusOptions[a.status] && (
              <div className="mt-3 flex gap-2 border-t pt-3">
                {nextStatusOptions[a.status].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateStatus(a.id, opt.value)}
                    disabled={busyId === a.id}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:border-brand-500 disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 border-t pt-3">
              <textarea
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="Ghi chú kết quả thực hiện dịch vụ"
                defaultValue={a.resultNotes ?? ""}
                onChange={(e) => setNotesDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
              />
              <button
                onClick={() => saveNotes(a.id)}
                disabled={busyId === a.id}
                className="mt-2 text-sm bg-brand-600 text-white rounded-md px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
