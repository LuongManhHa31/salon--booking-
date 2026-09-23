import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { Service } from "../types";

const emptyForm = { name: "", description: "", price: "", durationMinutes: "" };

export function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadServices() {
    setLoading(true);
    apiFetch<{ services: Service[] }>("/services?all=true")
      .then((res) => setServices(res.services))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          price: Number(form.price),
          durationMinutes: Number(form.durationMinutes),
        }),
      });
      setForm(emptyForm);
      loadServices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo dịch vụ");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(service: Service) {
    await apiFetch(`/services/${service.id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    loadServices();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Quản lý dịch vụ</h1>

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 mb-8 grid gap-3 sm:grid-cols-2">
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Tên dịch vụ"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Mô tả"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Giá (VNĐ)"
          type="number"
          min={0}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Thời lượng (phút)"
          type="number"
          min={1}
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          required
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Đang thêm..." : "Thêm dịch vụ"}
        </button>
      </form>

      {loading && <p className="text-gray-500">Đang tải...</p>}
      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-medium">
                {s.name} {!s.isActive && <span className="text-xs text-gray-400">(đã ẩn)</span>}
              </p>
              <p className="text-sm text-gray-500">
                {Number(s.price).toLocaleString("vi-VN")}đ - {s.durationMinutes} phút
              </p>
            </div>
            <button
              onClick={() => toggleActive(s)}
              className="text-sm text-brand-600 hover:underline"
            >
              {s.isActive ? "Ẩn" : "Hiện"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
