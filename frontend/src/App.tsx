import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { FloatingContact } from "./components/FloatingContact";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ChatWidget } from "./components/ChatWidget";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ServicesPage } from "./pages/ServicesPage";
import { BookingPage } from "./pages/BookingPage";
import { QuickBookingPage } from "./pages/QuickBookingPage";
import { MyAppointmentsPage } from "./pages/MyAppointmentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { HairstylePage } from "./pages/HairstylePage";
import { StaffSchedulePage } from "./pages/StaffSchedulePage";
import { AdminServicesPage } from "./pages/AdminServicesPage";
import { AdminStaffPage } from "./pages/AdminStaffPage";
import { AdminCustomersPage } from "./pages/AdminCustomersPage";
import { AdminAppointmentsPage } from "./pages/AdminAppointmentsPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { AdminReportsPage } from "./pages/AdminReportsPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/quick-booking" element={<QuickBookingPage />} />
          <Route path="/hairstyle-ai" element={<HairstylePage />} />
          <Route
            path="/booking"
            element={
              <ProtectedRoute roles={["CUSTOMER"]}>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-appointments"
            element={
              <ProtectedRoute roles={["CUSTOMER"]}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute roles={["CUSTOMER", "STAFF", "ADMIN"]}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/schedule"
            element={
              <ProtectedRoute roles={["STAFF"]}>
                <StaffSchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/services"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminServicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminStaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/appointments"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminPaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminReportsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
      <FloatingContact />
      <ChatWidget />
    </div>
  );
}
