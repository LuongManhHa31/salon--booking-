import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const searchQuerySchema = z.object({ q: z.string().optional() });

// UC022 - Quản trị viên tìm kiếm và quản lý danh sách khách hàng
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  const q = parsed.success ? parsed.data.q : undefined;

  const customers = await prisma.account.findMany({
    where: {
      role: "CUSTOMER",
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, fullName: true, phone: true, email: true, locked: true, isQuickProfile: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ customers });
});

// UC017 - Nhân viên xem thông tin và lịch sử dịch vụ của khách hàng đang phục vụ
// UC022 - Quản trị viên xem chi tiết một khách hàng
router.get("/:id", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res) => {
  const customer = await prisma.account.findUnique({
    where: { id: req.params.id },
    select: { id: true, fullName: true, phone: true, email: true, locked: true, createdAt: true, role: true },
  });
  if (!customer || customer.role !== "CUSTOMER") {
    return res.status(404).json({ message: "Không tìm thấy khách hàng" });
  }

  if (req.auth!.role === "STAFF") {
    const hasServedBefore = await prisma.appointment.findFirst({
      where: { customerId: customer.id, staffId: req.auth!.accountId },
    });
    if (!hasServedBefore) {
      return res.status(403).json({ message: "Bạn chỉ có thể xem thông tin khách hàng đang được bạn phục vụ" });
    }
  }

  const appointments = await prisma.appointment.findMany({
    where: { customerId: customer.id },
    include: { services: { include: { service: true } }, staff: true },
    orderBy: { scheduledStart: "desc" },
    take: 20,
  });

  res.json({ customer, appointments });
});

const lockSchema = z.object({ locked: z.boolean() });

// UC022 - Quản trị viên khoá/mở tài khoản khách hàng
router.patch("/:id/lock", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = lockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Tham số không hợp lệ" });

  try {
    const customer = await prisma.account.update({ where: { id: req.params.id }, data: { locked: parsed.data.locked } });
    res.json({ customer });
  } catch {
    res.status(404).json({ message: "Không tìm thấy khách hàng" });
  }
});

export default router;
