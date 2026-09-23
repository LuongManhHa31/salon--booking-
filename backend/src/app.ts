import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import servicesRoutes from "./routes/services.routes";
import staffRoutes from "./routes/staff.routes";
import appointmentsRoutes from "./routes/appointments.routes";
import paymentsRoutes from "./routes/payments.routes";
import customersRoutes from "./routes/customers.routes";
import reportsRoutes from "./routes/reports.routes";
import notificationsRoutes from "./routes/notifications.routes";
import hairstylesRoutes from "./routes/hairstyles.routes";
import chatRoutes from "./routes/chat.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/services", servicesRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/appointments", appointmentsRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/hairstyles", hairstylesRoutes);
  app.use("/api/chat", chatRoutes);

  app.use((_req, res) => res.status(404).json({ message: "Không tìm thấy tài nguyên" }));

  return app;
}
