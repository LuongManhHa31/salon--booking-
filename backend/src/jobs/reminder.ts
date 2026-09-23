import { prisma } from "../prisma";
import { notifyAccount } from "../utils/notifications";

const REMINDER_WINDOW_MINUTES = 60;
const CHECK_INTERVAL_MS = 5 * 60_000;

// UC009 - Kiểm tra định kỳ các lịch hẹn sắp đến giờ và gửi thông báo nhắc lịch
async function checkUpcomingAppointments() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000);

  const dueAppointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null,
      scheduledStart: { gte: now, lte: windowEnd },
    },
    include: { customer: true, services: { include: { service: true } } },
  });

  for (const appt of dueAppointments) {
    const time = appt.scheduledStart.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    const serviceNames = appt.services.map((s) => s.service.name).join(", ");
    try {
      await notifyAccount({
        accountId: appt.customerId,
        appointmentId: appt.id,
        title: "Nhắc lịch hẹn salon",
        body: `Bạn có lịch hẹn (${serviceNames}) vào lúc ${time}. Vui lòng đến đúng giờ.`,
        email: appt.customer.email,
      });
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } });
    } catch (err) {
      console.error(`Gửi nhắc lịch thất bại cho lịch hẹn ${appt.id}:`, err);
    }
  }
}

export function startReminderJob() {
  checkUpcomingAppointments().catch((err) => console.error("Lỗi kiểm tra nhắc lịch:", err));
  setInterval(() => {
    checkUpcomingAppointments().catch((err) => console.error("Lỗi kiểm tra nhắc lịch:", err));
  }, CHECK_INTERVAL_MS);
}
