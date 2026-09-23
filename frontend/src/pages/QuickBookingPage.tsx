import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AvailabilitySlot, Service, StaffMember } from "../types";

function formatPrice(price: string) {
  return Number(price).toLocaleString("vi-VN") + "đ";
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

type Step = "select" | "phone" | "otp" | "done";

export function QuickBookingPage() {
  const { loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledPhone = (location.state as { phone?: string } | null)?.phone;

  const searchParams = new URLSearchParams(location.search);
  const initialServiceIds = searchParams.get("serviceIds")?.split(",").filter(Boolean) ?? [];
  const initialStaffId = searchParams.get("staffId") ?? "";
  const initialDate = searchParams.get("date") ?? todayISO();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds);
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaffId);
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [step, setStep] = useState<Step>("select");
  const [phone, setPhone] = useState(prefilledPhone ?? "");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ services: Service[] }>("/services").then((res) => setServices(res.services));
    apiFetch<{ staff: StaffMember[] }>("/staff").then((res) => setStaffList(res.staff));
  }, []);

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
      setError("Vui lòng chọn ít nhất một dịch vụ");
      return;
    }
    setError(null);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date, serviceIds: selectedServiceIds.join(",") });
      if (selectedStaffId) params.set("staffId", selectedStaffId);
      const res = await apiFetch<{ slots: AvailabilitySlot[] }>(`/appointments/availability?${params.toString()}`);
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được khung giờ trống");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function requestOtp() {
    if (!phone || phone.length < 8) {
      setError("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ devCode?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setDevCode(res.devCode ?? null);
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được mã OTP");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyAndBook() {
    if (code.length !== 6) {
      setError("Mã OTP gồm 6 chữ số");
      return;
    }
    if (!selectedSlot) {
      setError("Vui lòng chọn khung giờ trước khi xác thực");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await loginWithOtp(phone, code, fullName || undefined);
      await apiFetch("/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          staffId: selectedStaffId || undefined,
          scheduledStart: selectedSlot,
        }),
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đặt lịch nhanh thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">Đặt lịch thành công!</h1>
        <p className="text-gray-600 mb-6">
          Salon đã ghi nhận lịch hẹn của bạn. Bạn có thể hoàn thiện tài khoản (đặt mật khẩu) để quản lý lịch hẹn dễ
          dàng hơn ở lần sau.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={() => navigate("/my-appointments")} className="bg-brand-600 text-white px-5 py-2.5 rounded-md hover:bg-brand-700">
            Xem lịch của tôi
          </button>
          <button onClick={() => navigate("/profile")} className="border border-gray-300 px-5 py-2.5 rounded-md hover:border-brand-500">
            Hoàn thiện tài khoản
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Đặt lịch nhanh</h1>
      <p className="text-gray-500 mb-6 text-sm">Không cần đăng ký tài khoản - chỉ cần xác thực số điện thoại bằng mã OTP.</p>

      {step === "select" && (
        <>
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
                    <input type="checkbox" className="mr-2" checked={selectedServiceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                    {s.name} ({s.durationMinutes}p)
                  </span>
                  <span className="text-sm text-gray-600">{formatPrice(s.price)}</span>
                </label>
              ))}
            </div>
            {selectedServiceIds.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">Tổng chi phí: {formatPrice(String(totalPrice))}</p>
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
                  {s.fullName}
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
              <button onClick={loadAvailability} disabled={loadingSlots} className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50">
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
                      className={`border rounded-md py-2 text-sm ${isSelected ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 hover:border-brand-500"}`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button
            onClick={() => selectedSlot && setStep("phone")}
            disabled={!selectedSlot}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-md hover:bg-brand-700 disabled:opacity-50"
          >
            Tiếp tục
          </button>
        </>
      )}

      {step === "phone" && (
        <div className="max-w-sm">
          <h2 className="font-medium mb-3">4. Nhập số điện thoại để nhận mã OTP</h2>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3"
            placeholder="Họ tên (nếu là khách mới)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep("select")} className="border border-gray-300 px-4 py-2 rounded-md">
              Quay lại
            </button>
            <button onClick={requestOtp} disabled={submitting} className="bg-brand-600 text-white px-5 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
              {submitting ? "Đang gửi..." : "Gửi mã OTP"}
            </button>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="max-w-sm">
          <h2 className="font-medium mb-3">5. Nhập mã OTP đã gửi tới {phone}</h2>
          {devCode && (
            <p className="text-xs text-amber-600 mb-3">
              (Demo - chưa nối SMS thật) Mã OTP của bạn là: <strong>{devCode}</strong>
            </p>
          )}
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3 tracking-widest text-center"
            placeholder="------"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep("phone")} className="border border-gray-300 px-4 py-2 rounded-md">
              Quay lại
            </button>
            <button onClick={verifyAndBook} disabled={submitting} className="bg-brand-600 text-white px-5 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
              {submitting ? "Đang xác nhận..." : "Xác thực & Đặt lịch"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
