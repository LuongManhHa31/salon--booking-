import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { Appointment, StaffMember } from "../types";

const statusLabel: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
  NO_SHOW: "Không đến",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "long", timeStyle: "short" });
}

export function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<{ appointments: Appointment[] }>("/appointments")
      .then((res) => setAppointments(res.appointments))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    apiFetch<{ staff: StaffMember[] }>("/staff").then((res) => setStaffList(res.staff));
  }, []);

  async function handleAssign(id: string, staffId: string) {
    if (!staffId) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/assign`, { method: "PATCH", body: JSON.stringify({ staffId }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể phân công nhân viên");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatus(id: string, status: string) {
    if (!status) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/admin-status`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Quản lý &amp; phân công lịch hẹn</h1>
      {loading && <p className="text-gray-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="space-y-2">
        {appointments.map((a) => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="text-lg font-bold text-gray-900">{formatDateTime(a.scheduledStart)}</p>
              <p className="text-base text-gray-700 mt-1">{a.services.map((s) => s.service.name).join(", ")}</p>
              {a.customer && <p className="text-base font-medium text-gray-800 mt-1">Khách hàng: {a.customer.fullName} - {a.customer.phone}</p>}
              <p className={`text-base font-semibold mt-1 ${a.status === 'CONFIRMED' ? 'text-green-600' : a.status === 'PENDING' ? 'text-yellow-600' : 'text-blue-600'}`}>Trạng thái: {statusLabel[a.status]}</p>
            </div>
            <div className="flex gap-3">
              <select
                className="border border-gray-400 rounded-md px-3 py-2 text-base font-medium"
                value={a.staff?.id ?? ""}
                disabled={busyId === a.id || a.status === "CANCELLED" || a.status === "COMPLETED"}
                onChange={(e) => handleAssign(a.id, e.target.value)}
              >
                <option value="" disabled>Chọn nhân viên</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>

              <select
                className="border-2 border-blue-400 rounded-md px-3 py-2 text-base font-bold text-blue-700 bg-blue-50"
                value={a.status}
                disabled={busyId === a.id || a.status === "CANCELLED" || a.status === "COMPLETED"}
                onChange={(e) => handleStatus(a.id, e.target.value)}
              >
                <option value="PENDING">Chờ xác nhận</option>
                <option value="CONFIRMED">Duyệt (Xác nhận)</option>
                <option value="COMPLETED">Hoàn tất</option>
                <option value="CANCELLED">Huỷ</option>
                <option value="NO_SHOW">Không đến</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      {!loading && appointments.length === 0 && <p className="text-gray-500">Chưa có lịch hẹn nào.</p>}
    </div>
  );
}
