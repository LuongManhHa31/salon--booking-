import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// UC009 - Khách hàng/nhân viên xem các thông báo trong ứng dụng (bao gồm nhắc lịch hẹn)
router.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { accountId: req.auth!.accountId, channel: "APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ notifications });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.accountId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy thông báo" });
  }
  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  res.json({ notification: updated });
});

export default router;
