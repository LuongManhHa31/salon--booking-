import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() });

// UC025 - Quản trị viên xem báo cáo thống kê doanh thu, số lượt đặt lịch, hiệu suất nhân viên
router.get("/summary", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Tham số không hợp lệ" });

  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(Date.now() - 30 * 24 * 3600_000);
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();

  const appointments = await prisma.appointment.findMany({
    where: { scheduledStart: { gte: from, lte: to } },
    include: { staff: true, payment: true, services: { include: { service: true } } },
  });

  const byStatus: Record<string, number> = {};
  const staffStatsMap = new Map<string, { staffId: string; fullName: string; completedCount: number; revenue: number }>();
  const dailyRevenueMap = new Map<string, number>();
  let totalRevenue = 0;

  for (const appt of appointments) {
    byStatus[appt.status] = (byStatus[appt.status] ?? 0) + 1;

    const paidAmount = appt.payment?.status === "PAID" ? Number(appt.payment.amount) : 0;
    totalRevenue += paidAmount;

    if (paidAmount > 0) {
      const dayKey = appt.scheduledStart.toISOString().slice(0, 10);
      dailyRevenueMap.set(dayKey, (dailyRevenueMap.get(dayKey) ?? 0) + paidAmount);
    }

    if (appt.staff && appt.status === "COMPLETED") {
      const entry = staffStatsMap.get(appt.staff.id) ?? {
        staffId: appt.staff.id,
        fullName: appt.staff.fullName,
        completedCount: 0,
        revenue: 0,
      };
      entry.completedCount += 1;
      entry.revenue += paidAmount;
      staffStatsMap.set(appt.staff.id, entry);
    }
  }

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    totalAppointments: appointments.length,
    totalRevenue,
    byStatus,
    staffPerformance: Array.from(staffStatsMap.values()).sort((a, b) => b.completedCount - a.completedCount),
    dailyRevenue: Array.from(dailyRevenueMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
});

export default router;
