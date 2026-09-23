import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:mô phỏng] Gửi tới ${to} - ${subject}: ${text}`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM ?? "no-reply@salon.local", to, subject, text });
}
