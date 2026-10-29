import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { withDbTimeout } from "../utils/dbTimeout";
import { FALLBACK_CUSTOMERS, MOCK_APPOINTMENTS } from "../utils/mockStore";

const router = Router();

const searchQuerySchema = z.object({ q: z.string().optional() });

// UC022 - Quản trị viên tìm kiếm và quản lý danh sách khách hàng
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  const q = parsed.success ? parsed.data.q : undefined;

  try {
    const customers = await withDbTimeout(
      prisma.account.findMany({
        where: {
          role: "CUSTOMER",
          ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
        },
        select: { id: true, fullName: true, phone: true, email: true, locked: true, isQuickProfile: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      2000
    );
    if (customers && customers.length > 0) {
      return res.json({ customers });
    }
  } catch (err) {
    // DB offline, fallback to mock store
  }

  let matched = FALLBACK_CUSTOMERS;
  if (q) {
    const lower = q.toLowerCase();
    matched = matched.filter(
      (c) =>
        c.fullName.toLowerCase().includes(lower) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(lower))
    );
  }
  return res.json({ customers: matched });
});

// UC017 - Nhân viên xem thông tin và lịch sử dịch vụ của khách hàng đang phục vụ
// UC022 - Quản trị viên xem chi tiết một khách hàng
router.get("/:id", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res) => {
  let customer: any = null;
  try {
    customer = await withDbTimeout(
      prisma.account.findUnique({
        where: { id: req.params.id },
        select: { id: true, fullName: true, phone: true, email: true, locked: true, createdAt: true, role: true },
      }),
      2000
    );
  } catch (err) {
    // DB offline
  }

  if (!customer) {
    customer = FALLBACK_CUSTOMERS.find((c) => c.id === req.params.id) ?? null;
  }

  if (!customer) {
    return res.status(404).json({ message: "Không tìm thấy khách hàng" });
  }

  let appointments: any[] = [];
  try {
    appointments = await withDbTimeout(
      prisma.appointment.findMany({
        where: { customerId: customer.id },
        include: { services: { include: { service: true } }, staff: true },
        orderBy: { scheduledStart: "desc" },
        take: 20,
      }),
      2000
    );
  } catch (err) {
    // DB offline
  }

  if (appointments.length === 0) {
    appointments = MOCK_APPOINTMENTS.filter((a) => a.customerId === customer.id || a.customer.phone === customer.phone);
  }

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
