import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Appointment } from "../types";

const statusLabel: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
  NO_SHOW: "Không đến",
};

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  NO_SHOW: "bg-red-100 text-red-700",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function canModify(appointment: Appointment) {
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") return false;
  return new Date(appointment.scheduledStart).getTime() - Date.now() >= 2 * 60 * 60_000;
}

export function MyAppointmentsPage() {
  const { account } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneSearch, setPhoneSearch] = useState(account?.phone || "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [rescheduleDraft, setRescheduleDraft] = useState<Record<string, string>>({});

  function load(phoneOverride?: string) {
    setLoading(true);
    setError(null);
    const targetPhone = phoneOverride !== undefined ? phoneOverride : phoneSearch;

    if (account?.role === "CUSTOMER" && !targetPhone) {
      apiFetch<{ appointments: Appointment[] }>("/appointments/mine")
        .then((res) => setAppointments(res.appointments))
        .catch((err) => setError(err instanceof ApiError ? err.message : "Không tải được lịch hẹn"))
        .finally(() => setLoading(false));
    } else if (targetPhone) {
      apiFetch<{ appointments: Appointment[] }>(`/appointments/lookup?phone=${encodeURIComponent(targetPhone)}`)
        .then((res) => setAppointments(res.appointments))
        .catch((err) => setError(err instanceof ApiError ? err.message : "Không tìm thấy lịch hẹn với số điện thoại này"))
        .finally(() => setLoading(false));
    } else {
      // Mặc định nạp lịch hẹn mẫu cho khách tham quan
      apiFetch<{ appointments: Appointment[] }>("/appointments/lookup?phone=09")
        .then((res) => setAppointments(res.appointments))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/cancel`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể huỷ lịch hẹn");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReschedule(id: string) {
    const newStart = rescheduleDraft[id];
    if (!newStart) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledStart: new Date(newStart).toISOString() }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể đổi lịch hẹn");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePay(id: string, method: "ONLINE" | "OFFLINE") {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/payments/${id}`, { method: "POST", body: JSON.stringify({ method }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Thanh toán thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReview(id: string) {
    const draft = reviewDraft[id] ?? { rating: 5, comment: "" };
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/appointments/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating: draft.rating, comment: draft.comment || undefined }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gửi đánh giá");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tra cứu &amp; Quản lý lịch đã đặt</h1>
          <p className="text-xs text-gray-500 mt-1">Xem trạng thái, đổi lịch hẹn hoặc thanh toán trực tuyến</p>
        </div>
      </div>

      {/* Thanh tìm kiếm số điện thoại */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs mb-6">
        <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Tra cứu theo số điện thoại:
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Nhập số điện thoại đã dùng để đặt lịch..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button
            type="button"
            onClick={() => load()}
            className="bg-brand-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-xs"
          >
            Tra cứu
          </button>
        </div>

        {/* Gợi ý số điện thoại mẫu để test nhanh */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <span className="font-medium">Khách mẫu:</span>
          {[
            { phone: "0912345678", name: "Nguyễn Văn Khách" },
            { phone: "0911223344", name: "Lê Hoàng Nam" },
            { phone: "0987654321", name: "Thu Thảo" },
            { phone: "0933445566", name: "Quỳnh Nga" },
            { phone: "0988776655", name: "Minh Tuấn" },
          ].map((c) => (
            <button
              key={c.phone}
              type="button"
              onClick={() => {
                setPhoneSearch(c.phone);
                load(c.phone);
              }}
              className="bg-gray-100 hover:bg-brand-50 hover:text-brand-600 border border-gray-200 px-2 py-0.5 rounded text-[11px] transition-colors"
            >
              {c.name} ({c.phone})
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!loading && appointments.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          <p className="text-base font-medium">Chưa tìm thấy lịch hẹn nào.</p>
          <p className="text-xs text-gray-400 mt-1">Vui lòng kiểm tra lại số điện thoại hoặc bấm vào các khách mẫu bên trên.</p>
        </div>
      )}
      <div className="space-y-3">
        {appointments.map((a) => {
          const total = a.services.reduce((sum, s) => sum + Number(s.priceAtBooking), 0);
          const draft = reviewDraft[a.id] ?? { rating: 5, comment: "" };
          return (
            <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{formatDateTime(a.scheduledStart)}</p>
                  <p className="text-sm text-gray-600">{a.services.map((s) => s.service.name).join(", ")}</p>
                  {a.staff && <p className="text-sm text-gray-500">Nhân viên: {a.staff.fullName}</p>}
                  <p className="text-sm text-gray-500">Tổng chi phí: {formatPrice(total)}</p>
                  {a.resultNotes && <p className="text-sm text-gray-500 italic">Ghi chú của salon: {a.resultNotes}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
              </div>

              {canModify(a) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <button
                    onClick={() => handleCancel(a.id)}
                    disabled={busyId === a.id}
                    className="text-sm text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                  >
                    Huỷ lịch
                  </button>
                  <input
                    type="datetime-local"
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    onChange={(e) => setRescheduleDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => handleReschedule(a.id)}
                    disabled={busyId === a.id || !rescheduleDraft[a.id]}
                    className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50"
                  >
                    Đổi lịch
                  </button>
                </div>
              )}

              {a.status !== "CANCELLED" && !a.payment && (
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <button
                    onClick={() => handlePay(a.id, "ONLINE")}
                    disabled={busyId === a.id}
                    className="text-sm bg-brand-600 text-white rounded-md px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                  >
                    Thanh toán trực tuyến
                  </button>
                  <button
                    onClick={() => handlePay(a.id, "OFFLINE")}
                    disabled={busyId === a.id}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:border-brand-500 disabled:opacity-50"
                  >
                    Thanh toán tại salon
                  </button>
                </div>
              )}
              {a.payment && (
                <p className="mt-3 text-sm text-gray-500 border-t pt-3">
                  Thanh toán: {a.payment.method === "ONLINE" ? "Trực tuyến" : "Tại salon"} -{" "}
                  {a.payment.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}
                </p>
              )}

              {a.status === "COMPLETED" && !a.review && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewDraft((prev) => ({ ...prev, [a.id]: { ...draft, rating: star } }))}
                        className={`text-lg ${star <= draft.rating ? "text-yellow-500" : "text-gray-300"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    placeholder="Nhận xét của bạn (tuỳ chọn)"
                    value={draft.comment}
                    onChange={(e) => setReviewDraft((prev) => ({ ...prev, [a.id]: { ...draft, comment: e.target.value } }))}
                  />
                  <button
                    onClick={() => handleReview(a.id)}
                    disabled={busyId === a.id}
                    className="text-sm bg-brand-600 text-white rounded-md px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                  >
                    Gửi đánh giá
                  </button>
                </div>
              )}
              {a.review && (
                <p className="mt-3 text-sm text-gray-500 border-t pt-3">
                  Đánh giá của bạn: {"★".repeat(a.review.rating)}{a.review.comment ? ` - ${a.review.comment}` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
