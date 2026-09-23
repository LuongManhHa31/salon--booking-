import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { AvailabilitySlot, Service, StaffMember } from "../types";

function formatPrice(price: string) {
  return Number(price).toLocaleString("vi-VN") + "đ";
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  
  // Lấy serviceId từ trang danh sách (nếu có)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    location.state?.serviceId ? [location.state.serviceId] : []
  );
  
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    apiFetch<{ services: Service[] }>("/services").then((res) => setServices(res.services));
    apiFetch<{ staff: StaffMember[] }>("/staff").then((res) => setStaffList(res.staff));
  }, []);

  const totalDuration = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.durationMinutes, 0),
    [services, selectedServiceIds]
  );
  const totalPrice = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0),
    [services, selectedServiceIds]
  );

  function toggleService(id: string) {
    setSelectedSlot(null);
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function loadAvailability() {
    if (selectedServiceIds.length === 0) {
      setMessage({ type: "error", text: "Vui lòng chọn ít nhất một dịch vụ" });
      return;
    }
    setMessage(null);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date, serviceIds: selectedServiceIds.join(",") });
      if (selectedStaffId) params.set("staffId", selectedStaffId);
      const res = await apiFetch<{ slots: AvailabilitySlot[] }>(`/appointments/availability?${params.toString()}`);
      setSlots(res.slots);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof ApiError ? err.message : "Không tải được khung giờ trống" });
    } finally {
      setLoadingSlots(false);
    }
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await apiFetch("/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          staffId: selectedStaffId || undefined,
          scheduledStart: selectedSlot,
        }),
      });
      setMessage({ type: "success", text: "Đặt lịch thành công! Bạn có thể xem trong Lịch của tôi." });
      setSelectedSlot(null);
      setSlots([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { state: { from: "/booking" } });
        return;
      }
      setMessage({ type: "error", text: err instanceof ApiError ? err.message : "Đặt lịch thất bại" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Đặt lịch hẹn</h1>

      <section className="mb-6">
        <h2 className="font-medium mb-3">1. Chọn dịch vụ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer ${
                selectedServiceIds.includes(s.id) ? "border-brand-500 bg-brand-50" : "border-gray-300"
              }`}
            >
              <span>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedServiceIds.includes(s.id)}
                  onChange={() => toggleService(s.id)}
                />
                {s.name} ({s.durationMinutes}p)
              </span>
              <span className="text-sm text-gray-600">{formatPrice(s.price)}</span>
            </label>
          ))}
        </div>
        {selectedServiceIds.length > 0 && (
          <p className="text-sm text-gray-600 mt-2">
            Tổng thời lượng: {totalDuration} phút — Tổng chi phí: {formatPrice(String(totalPrice))}
          </p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-3">2. Chọn nhân viên (tuỳ chọn)</h2>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 w-full sm:w-64"
          value={selectedStaffId}
          onChange={(e) => {
            setSelectedStaffId(e.target.value);
            setSelectedSlot(null);
          }}
        >
          <option value="">Để hệ thống tự chọn nhân viên còn trống</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} {s.staffProfile?.specialties ? `- ${s.staffProfile.specialties}` : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-6">
        <h2 className="font-medium mb-3">3. Chọn ngày và khung giờ</h2>
        <div className="flex items-center gap-3 mb-4">
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2"
            value={date}
            min={todayISO()}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlot(null);
              setSlots([]);
            }}
          />
          <button
            onClick={loadAvailability}
            disabled={loadingSlots}
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50"
          >
            {loadingSlots ? "Đang tải..." : "Xem khung giờ trống"}
          </button>
        </div>
        {slots.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {slots.map((slot) => {
              const time = new Date(slot.start).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
              const isSelected = selectedSlot === slot.start;
              return (
                <button
                  key={slot.start}
                  onClick={() => setSelectedSlot(slot.start)}
                  className={`border rounded-md py-2 text-sm ${
                    isSelected ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 hover:border-brand-500"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
        {!loadingSlots && slots.length === 0 && (
          <p className="text-sm text-gray-500">Chọn dịch vụ và bấm "Xem khung giờ trống" để bắt đầu.</p>
        )}
      </section>

      {message && (
        <p className={`text-sm mb-4 ${message.type === "error" ? "text-red-600" : "text-green-600"}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={confirmBooking}
        disabled={!selectedSlot || submitting}
        className="bg-brand-600 text-white px-6 py-2.5 rounded-md hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Đang xác nhận..." : "Xác nhận đặt lịch"}
      </button>
    </div>
  );
}
