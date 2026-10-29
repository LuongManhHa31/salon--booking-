import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const FALLBACK_SERVICES = [
  { id: "srv-1", name: "Cắt tóc nam", description: "Cắt gọn gàng theo yêu cầu, tạo kiểu", price: 100000, durationMinutes: 30, isActive: true },
  { id: "srv-2", name: "Cắt tóc nữ", description: "Cắt tạo kiểu theo dáng mặt, layer, bob", price: 150000, durationMinutes: 45, isActive: true },
  { id: "srv-3", name: "Nhuộm tóc", description: "Nhuộm màu thời trang cao cấp", price: 500000, durationMinutes: 90, isActive: true },
  { id: "srv-4", name: "Uốn tóc", description: "Uốn tạo kiểu bồng bềnh, uốn xoăn sóng", price: 600000, durationMinutes: 120, isActive: true },
  { id: "srv-5", name: "Duỗi tóc", description: "Duỗi thẳng, phục hồi keratin", price: 550000, durationMinutes: 100, isActive: true },
  { id: "srv-6", name: "Gội đầu dưỡng sinh", description: "Thư giãn, massage da đầu bấm huyệt", price: 80000, durationMinutes: 30, isActive: true },
  { id: "srv-7", name: "Lấy ráy tai êm", description: "Làm sạch tai êm ái, chuyên nghiệp", price: 50000, durationMinutes: 20, isActive: true },
];

// UC004 - Xem danh sách dịch vụ (public)
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const services = await prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
    if (services && services.length > 0) {
      return res.json({ services });
    }
    return res.json({ services: FALLBACK_SERVICES });
  } catch (err) {
    console.error("Database error in /services, returning fallback services:", err);
    return res.json({ services: FALLBACK_SERVICES });
  }
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
