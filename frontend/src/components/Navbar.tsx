import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <Link to="/" className="text-xl font-bold text-brand-600">
          Salon AI Booking
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-base font-medium">
          <Link to="/services" className="hover:text-brand-600">
            Dịch vụ
          </Link>
          <Link to="/quick-booking" className="hover:text-brand-600">
            Đặt lịch nhanh
          </Link>
          <Link to="/hairstyle-ai" className="hover:text-brand-600">
            Kiểu tóc AI
          </Link>
          {account?.role === "CUSTOMER" && (
            <>
              <Link to="/booking" className="hover:text-brand-600">
                Đặt lịch
              </Link>
              <Link to="/my-appointments" className="hover:text-brand-600">
                Lịch của tôi
              </Link>
            </>
          )}
          {account?.role === "STAFF" && (
            <Link to="/staff/schedule" className="hover:text-brand-600">
              Lịch làm việc
            </Link>
          )}
          {account?.role === "ADMIN" && (
            <>
              <Link to="/admin/services" className="hover:text-brand-600">
                Dịch vụ
              </Link>
              <Link to="/admin/staff" className="hover:text-brand-600">
                Nhân viên
              </Link>
              <Link to="/admin/customers" className="hover:text-brand-600">
                Khách hàng
              </Link>
              <Link to="/admin/appointments" className="hover:text-brand-600">
                Lịch hẹn
              </Link>
              <Link to="/admin/payments" className="hover:text-brand-600">
                Thanh toán
              </Link>
              <Link to="/admin/reports" className="hover:text-brand-600">
                Báo cáo
              </Link>
            </>
          )}
          {account && <NotificationBell />}
          {account ? (
            <>
              <Link to="/profile" className="text-gray-500 hover:text-brand-600">
                {account.fullName}
              </Link>
              <button onClick={handleLogout} className="text-brand-600 hover:underline">
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-brand-600">
                Đăng nhập
              </Link>
              <Link to="/register" className="bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700">
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
