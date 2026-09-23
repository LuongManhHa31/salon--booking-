import { prisma } from "../prisma";
import { sendEmail } from "./mailer";

export async function notifyAccount(params: {
  accountId: string;
  appointmentId?: string;
  title: string;
  body: string;
  email?: string | null;
}): Promise<void> {
  const { accountId, appointmentId, title, body, email } = params;

  await prisma.notification.create({
    data: { accountId, appointmentId, title, body, channel: "APP" },
  });

  if (email) {
    await prisma.notification.create({
      data: { accountId, appointmentId, title, body, channel: "EMAIL" },
    });
    await sendEmail(email, title, body).catch((err) => console.error("Gửi email nhắc lịch thất bại:", err));
  }
}
