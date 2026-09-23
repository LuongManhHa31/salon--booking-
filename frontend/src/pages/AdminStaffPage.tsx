import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";

interface StaffRow {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  staffProfile?: { specialties?: string | null; active: boolean } | null;
}

const emptyForm = { fullName: "", phone: "", email: "", password: "", specialties: "" };

export function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadStaff() {
    setLoading(true);
    apiFetch<{ staff: StaffRow[] }>("/staff/admin")
      .then((res) => setStaff(res.staff))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          password: form.password,
          specialties: form.specialties || undefined,
        }),
      });
      setForm(emptyForm);
      loadStaff();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo nhân viên");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: StaffRow) {
    await apiFetch(`/staff/${row.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !(row.staffProfile?.active ?? true) }),
    });
    loadStaff();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Quản lý nhân viên</h1>

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 mb-8 grid gap-3 sm:grid-cols-2">
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Họ tên"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Số điện thoại"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Email (tuỳ chọn)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Mật khẩu tạm"
          type="password"
          minLength={6}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 sm:col-span-2"
          placeholder="Chuyên môn (VD: Cắt tóc, Nhuộm)"
          value={form.specialties}
          onChange={(e) => setForm({ ...form, specialties: e.target.value })}
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Đang thêm..." : "Thêm nhân viên"}
        </button>
      </form>

      {loading && <p className="text-gray-500">Đang tải...</p>}
      <div className="space-y-2">
        {staff.map((s) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-medium">
                {s.fullName}{" "}
                {!(s.staffProfile?.active ?? true) && <span className="text-xs text-gray-400">(đã khoá)</span>}
              </p>
              <p className="text-sm text-gray-500">
                {s.phone} {s.staffProfile?.specialties ? `- ${s.staffProfile.specialties}` : ""}
              </p>
            </div>
            <button onClick={() => toggleActive(s)} className="text-sm text-brand-600 hover:underline">
              {s.staffProfile?.active ?? true ? "Khoá" : "Mở khoá"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
