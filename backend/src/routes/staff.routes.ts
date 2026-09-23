import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// UC006 - Danh sách nhân viên khả dụng để khách hàng chọn khi đặt lịch (public, thông tin rút gọn)
router.get("/", async (req, res) => {
  const staff = await prisma.account.findMany({
    where: { role: "STAFF", staffProfile: { active: true } },
    select: { id: true, fullName: true, staffProfile: { select: { specialties: true } } },
    orderBy: { fullName: "asc" },
  });
  res.json({ staff });
});

const createStaffSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8).max(15),
  email: z.string().email().optional(),
  password: z.string().min(6),
  specialties: z.string().optional(),
});

// UC021 - Quản trị viên thêm nhân viên (tạo tài khoản + hồ sơ)
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin nhân viên không hợp lệ", errors: parsed.error.flatten() });
  }
  const { fullName, phone, email, password, specialties } = parsed.data;

  const existing = await prisma.account.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
  if (existing) {
    return res.status(409).json({ message: "Số điện thoại hoặc email đã được sử dụng" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const account = await prisma.account.create({
    data: {
      fullName,
      phone,
      email,
      passwordHash,
      role: "STAFF",
      staffProfile: { create: { specialties } },
    },
    include: { staffProfile: true },
  });
  res.status(201).json({ staff: account });
});

// UC021 - Quản trị viên xem danh sách đầy đủ nhân viên (kể cả đã khoá)
router.get("/admin", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const staff = await prisma.account.findMany({
    where: { role: "STAFF" },
    include: { staffProfile: true },
    orderBy: { fullName: "asc" },
  });
  res.json({ staff });
});

const updateStaffSchema = z.object({
  fullName: z.string().min(2).optional(),
  specialties: z.string().optional(),
  active: z.boolean().optional(),
});

// UC021 - Quản trị viên sửa thông tin / khoá-mở tài khoản nhân viên
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = updateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin không hợp lệ", errors: parsed.error.flatten() });
  }
  const { fullName, specialties, active } = parsed.data;

  const account = await prisma.account.findUnique({ where: { id: req.params.id }, include: { staffProfile: true } });
  if (!account || account.role !== "STAFF" || !account.staffProfile) {
    return res.status(404).json({ message: "Không tìm thấy nhân viên" });
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      fullName,
      staffProfile: { update: { specialties, active } },
    },
    include: { staffProfile: true },
  });
  res.json({ staff: updated });
});

export default router;
