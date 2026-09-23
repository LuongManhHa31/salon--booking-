import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const paySchema = z.object({ method: z.enum(["ONLINE", "OFFLINE"]) });

// UC011 - Khách hàng thanh toán (trực tuyến mô phỏng qua cổng thanh toán, hoặc chọn trả tại salon)
router.post("/:appointmentId", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Hình thức thanh toán không hợp lệ" });

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: { services: true, payment: true },
  });
  if (!appointment || appointment.customerId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
  }
  if (appointment.status === "CANCELLED") {
    return res.status(409).json({ message: "Lịch hẹn đã bị huỷ, không thể thanh toán" });
  }
  if (appointment.payment && appointment.payment.status === "PAID") {
    return res.status(409).json({ message: "Lịch hẹn này đã được thanh toán" });
  }

  const amount = appointment.services.reduce((sum, s) => sum + Number(s.priceAtBooking), 0);

  // Chưa tích hợp cổng thanh toán thật (VD: VNPay, Momo) - mô phỏng giao dịch thành công ngay lập tức
  // để phục vụ demo luồng nghiệp vụ; khi triển khai thật cần thay bằng redirect/callback cổng thanh toán.
  const payment = await prisma.payment.upsert({
    where: { appointmentId: appointment.id },
    update: {
      method: parsed.data.method,
      status: parsed.data.method === "ONLINE" ? "PAID" : "PENDING",
      amount,
      transactionRef: parsed.data.method === "ONLINE" ? crypto.randomUUID() : null,
      paidAt: parsed.data.method === "ONLINE" ? new Date() : null,
    },
    create: {
      appointmentId: appointment.id,
      method: parsed.data.method,
      status: parsed.data.method === "ONLINE" ? "PAID" : "PENDING",
      amount,
      transactionRef: parsed.data.method === "ONLINE" ? crypto.randomUUID() : null,
      paidAt: parsed.data.method === "ONLINE" ? new Date() : null,
    },
  });

  res.status(201).json({ payment });
});

router.get("/:appointmentId", requireAuth, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: { payment: true },
  });
  if (!appointment) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });

  const isOwner = appointment.customerId === req.auth!.accountId;
  const isStaffOrAdmin = req.auth!.role === "STAFF" || req.auth!.role === "ADMIN";
  if (!isOwner && !isStaffOrAdmin) return res.status(403).json({ message: "Không có quyền xem" });

  res.json({ payment: appointment.payment });
});

// UC024 - Quản trị viên xác nhận đã thu tiền cho giao dịch thanh toán trực tiếp tại salon
router.patch("/:paymentId/settle", requireAuth, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } });
  if (!payment) return res.status(404).json({ message: "Không tìm thấy giao dịch" });
  if (payment.status === "PAID") return res.status(409).json({ message: "Giao dịch đã được xử lý" });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  res.json({ payment: updated });
});

// UC024 - Quản trị viên theo dõi, đối soát các giao dịch thanh toán/hoá đơn của salon
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      appointment: {
        include: { customer: true, services: { include: { service: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ payments });
});

export default router;
