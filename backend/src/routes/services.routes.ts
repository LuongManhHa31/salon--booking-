import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// UC004 - Xem danh sách dịch vụ (public)
router.get("/", async (req, res) => {
  const includeInactive = req.query.all === "true";
  const services = await prisma.service.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json({ services });
});

// UC004 - Xem chi tiết dịch vụ (public)
router.get("/:id", async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ" });
  res.json({ service });
});

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean().optional(),
});

// UC020 - Quản trị viên thêm dịch vụ
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin dịch vụ không hợp lệ", errors: parsed.error.flatten() });
  }
  const duplicate = await prisma.service.findFirst({ where: { name: parsed.data.name } });
  if (duplicate) {
    return res.status(409).json({ message: "Tên dịch vụ đã tồn tại" });
  }
  const service = await prisma.service.create({ data: parsed.data });
  res.status(201).json({ service });
});

// UC020 - Quản trị viên sửa dịch vụ
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = serviceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin dịch vụ không hợp lệ", errors: parsed.error.flatten() });
  }
  try {
    const service = await prisma.service.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ service });
  } catch {
    res.status(404).json({ message: "Không tìm thấy dịch vụ" });
  }
});

// UC020 - Quản trị viên ẩn/hiện hoặc xoá dịch vụ
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.service.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Không tìm thấy dịch vụ" });
  }
});

export default router;
