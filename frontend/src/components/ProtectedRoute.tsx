import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types";

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { account, loading } = useAuth();

  if (loading) return <p className="text-center py-10 text-gray-500">Đang tải...</p>;
  if (!account) return <Navigate to="/login" replace />;
  if (!roles.includes(account.role)) return <Navigate to="/" replace />;

  return children;
}
