import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";
import { generateOtpCode, otpExpiryDate } from "../utils/otp";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8).max(15),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

// UC002 - Đăng ký tài khoản (khách hàng)
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin đăng ký không hợp lệ", errors: parsed.error.flatten() });
  }
  const { fullName, phone, email, password } = parsed.data;

  const existing = await prisma.account.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing && !existing.isQuickProfile) {
    return res.status(409).json({ message: "Số điện thoại hoặc email đã được sử dụng" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const account = existing
    ? await prisma.account.update({
        where: { id: existing.id },
        data: { fullName, email, passwordHash, isQuickProfile: false },
      })
    : await prisma.account.create({
        data: { fullName, phone, email, passwordHash, role: "CUSTOMER" },
      });

  const token = signToken({ accountId: account.id, role: account.role });
  return res.status(201).json({
    token,
    account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
  });
});

const loginSchema = z.object({
  identifier: z.string().min(3), // phone or email
  password: z.string().min(1),
});

// UC003 - Đăng nhập khách hàng, và UC013 - Đăng nhập nhân viên (dùng chung endpoint)
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin đăng nhập" });
  }
  const { identifier, password } = parsed.data;

  const account = await prisma.account.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
  });
  if (!account || !account.passwordHash) {
    return res.status(401).json({ message: "Sai thông tin đăng nhập" });
  }
  if (account.locked) {
    return res.status(403).json({ message: "Tài khoản của bạn đã bị khoá, vui lòng liên hệ salon" });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Sai thông tin đăng nhập" });
  }

  const token = signToken({ accountId: account.id, role: account.role });
  return res.json({
    token,
    account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
  });
});

const otpRequestSchema = z.object({ phone: z.string().min(8).max(15) });

// UC001 - Yêu cầu gửi mã OTP để đặt lịch nhanh không cần tài khoản
router.post("/otp/request", async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
  }
  const { phone } = parsed.data;

  const account = await prisma.account.findUnique({ where: { phone } });
  if (account?.locked) {
    return res.status(403).json({ message: "Số điện thoại này đã bị khoá, vui lòng liên hệ salon" });
  }

  const code = generateOtpCode();
  await prisma.otpCode.create({ data: { phone, code, expiresAt: otpExpiryDate() } });

  // Chưa tích hợp SMS gateway thật (cần thêm nhà cung cấp SMS ở giai đoạn triển khai thực tế).
  console.log(`[OTP:mô phỏng] Gửi mã ${code} đến số điện thoại ${phone}`);

  return res.json({
    message: "Đã gửi mã OTP",
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

const otpVerifySchema = z.object({
  phone: z.string().min(8).max(15),
  code: z.string().length(6),
  fullName: z.string().min(2).optional(),
});

// UC001 - Xác thực mã OTP, tạo hồ sơ khách hàng nhanh (nếu chưa có) và đăng nhập
router.post("/otp/verify", async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin xác thực không hợp lệ" });
  }
  const { phone, code, fullName } = parsed.data;

  const otp = await prisma.otpCode.findFirst({
    where: { phone, code, consumed: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn" });
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  let account = await prisma.account.findUnique({ where: { phone } });
  if (!account) {
    account = await prisma.account.create({
      data: { phone, fullName: fullName ?? "Khách hàng", role: "CUSTOMER", isQuickProfile: true },
    });
  }

  const token = signToken({ accountId: account.id, role: account.role });
  return res.json({
    token,
    account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
  });
});

// Lấy thông tin tài khoản hiện tại (dùng để khôi phục phiên đăng nhập ở frontend)
router.get("/me", requireAuth, async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.auth!.accountId } });
  if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });
  return res.json({
    account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
    hasPassword: Boolean(account.passwordHash),
  });
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

// UC012 - Cập nhật thông tin cá nhân (kèm CN-02: hoàn thiện tài khoản, đặt mật khẩu lần đầu)
router.put("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin không hợp lệ", errors: parsed.error.flatten() });
  }
  const { fullName, email, currentPassword, newPassword } = parsed.data;

  const account = await prisma.account.findUnique({ where: { id: req.auth!.accountId } });
  if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

  let passwordHash = account.passwordHash;
  if (newPassword) {
    if (account.passwordHash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, account.passwordHash))) {
        return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
      }
    }
    passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (email) {
    const emailTaken = await prisma.account.findFirst({ where: { email, NOT: { id: account.id } } });
    if (emailTaken) return res.status(409).json({ message: "Email đã được sử dụng" });
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { fullName, email, passwordHash, isQuickProfile: passwordHash ? false : account.isQuickProfile },
  });

  return res.json({
    account: { id: updated.id, fullName: updated.fullName, phone: updated.phone, email: updated.email, role: updated.role },
  });
});

export default router;
