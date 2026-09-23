import { FormEvent, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function ProfilePage() {
  const { account, refreshAccount } = useAuth();
  const [fullName, setFullName] = useState(account?.fullName ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          fullName: fullName || undefined,
          email: email || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      await refreshAccount();
      setSuccess("Cập nhật thông tin thành công");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cập nhật thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold mb-6">Thông tin cá nhân</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Họ tên</label>
          <input className="w-full border border-gray-300 rounded-md px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input type="email" className="w-full border border-gray-300 rounded-md px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Số điện thoại</label>
          <input className="w-full border border-gray-100 bg-gray-100 rounded-md px-3 py-2 text-gray-500" value={account?.phone ?? ""} disabled />
        </div>
        <hr className="my-4" />
        <p className="text-sm text-gray-500">Để trống nếu bạn chưa muốn đặt/đổi mật khẩu.</p>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mật khẩu hiện tại (nếu đã có)</label>
          <input type="password" className="w-full border border-gray-300 rounded-md px-3 py-2" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mật khẩu mới</label>
          <input type="password" minLength={6} className="w-full border border-gray-300 rounded-md px-3 py-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <button type="submit" disabled={submitting} className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </form>
    </div>
  );
}
