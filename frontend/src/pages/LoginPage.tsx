import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await login(identifier, password);
      const redirectTo =
        (location.state as { from?: string } | null)?.from ??
        (account.role === "ADMIN" ? "/admin/services" : account.role === "STAFF" ? "/staff/schedule" : "/booking");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-semibold mb-6 text-center">Đăng nhập</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Số điện thoại hoặc email</label>
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mật khẩu</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="text-brand-600 hover:underline">
          Đăng ký ngay
        </Link>
      </p>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Nhân viên/Quản trị viên đăng nhập bằng số điện thoại và mật khẩu được cấp tại đây.
      </p>
    </div>
  );
}
