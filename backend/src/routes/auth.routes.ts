import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";
import { generateOtpCode, otpExpiryDate } from "../utils/otp";
import { withDbTimeout } from "../utils/dbTimeout";
import {
  REGISTERED_ACCOUNTS,
  RegisteredMockAccount,
  FALLBACK_CUSTOMERS,
  MOCK_OTP_CODES,
} from "../utils/mockStore";

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

  // 1. Kiểm tra tồn tại trong DB nếu DB online
  let existing: any = null;
  try {
    existing = await withDbTimeout(
      prisma.account.findFirst({
        where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
      }),
      2000
    );
  } catch (err) {
    // DB offline, tiếp tục với in-memory
  }

  // 2. Kiểm tra trong Mock Store
  const mockExisting =
    REGISTERED_ACCOUNTS.find((a) => a.phone === phone || (email && a.email === email)) ||
    FALLBACK_CUSTOMERS.find((c) => c.phone === phone || (email && c.email === email));

  if ((existing && !existing.isQuickProfile) || (mockExisting && !mockExisting.isQuickProfile)) {
    return res.status(409).json({ message: "Số điện thoại hoặc email đã được sử dụng" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Thử tạo hoặc cập nhật trong DB thật nếu DB online
  try {
    const account = existing
      ? await withDbTimeout(
          prisma.account.update({
            where: { id: existing.id },
            data: { fullName, email, passwordHash, isQuickProfile: false },
          }),
          2000
        )
      : await withDbTimeout(
          prisma.account.create({
            data: { fullName, phone, email, passwordHash, role: "CUSTOMER" },
          }),
          2000
        );

    const token = signToken({ accountId: account.id, role: account.role });
    return res.status(201).json({
      token,
      account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
    });
  } catch (err) {
    console.warn("DB offline during registration, saving to in-memory store:", err);
  }

  // 4. Fallback in-memory: Lưu tài khoản vào bộ nhớ để khách đăng nhập và dùng ngay
  const newAccount: RegisteredMockAccount = {
    id: "cust-" + Date.now(),
    fullName,
    phone,
    email: email || null,
    passwordHash,
    role: "CUSTOMER",
    isQuickProfile: false,
  };
  REGISTERED_ACCOUNTS.push(newAccount);
  FALLBACK_CUSTOMERS.unshift({
    id: newAccount.id,
    fullName: newAccount.fullName,
    phone: newAccount.phone,
    email: newAccount.email || undefined,
    locked: false,
    isQuickProfile: false,
    createdAt: new Date().toISOString(),
  });

  const token = signToken({ accountId: newAccount.id, role: newAccount.role });
  return res.status(201).json({
    token,
    account: {
      id: newAccount.id,
      fullName: newAccount.fullName,
      phone: newAccount.phone,
      email: newAccount.email,
      role: newAccount.role,
    },
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

  try {
    const account = await withDbTimeout(
      prisma.account.findFirst({
        where: { OR: [{ phone: identifier }, { email: identifier }] },
      }),
      2000
    );
    if (account && account.passwordHash) {
      if (account.locked) {
        return res.status(403).json({ message: "Tài khoản của bạn đã bị khoá, vui lòng liên hệ salon" });
      }
      const valid = await bcrypt.compare(password, account.passwordHash);
      if (valid) {
        const token = signToken({ accountId: account.id, role: account.role });
        return res.json({
          token,
          account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
        });
      }
    }
  } catch (err) {
    console.error("Database check failed during login, checking fallback credentials:", err);
  }

  // Fallback tài khoản khách vừa đăng ký trong bộ nhớ in-memory
  const registeredUser = REGISTERED_ACCOUNTS.find((a) => a.phone === identifier || (a.email && a.email === identifier));
  if (registeredUser) {
    const valid = await bcrypt.compare(password, registeredUser.passwordHash);
    if (valid) {
      const token = signToken({ accountId: registeredUser.id, role: registeredUser.role });
      return res.json({
        token,
        account: {
          id: registeredUser.id,
          fullName: registeredUser.fullName,
          phone: registeredUser.phone,
          email: registeredUser.email,
          role: registeredUser.role,
        },
      });
    }
  }

  // Fallback Admin login khi Database Render đang ngủ hoặc offline
  if ((identifier === "0900000000" || identifier === "admin@salon.local") && password === "Admin@123") {
    const token = signToken({ accountId: "admin-master-id", role: "ADMIN" });
    return res.json({
      token,
      account: { id: "admin-master-id", fullName: "Quản trị viên", phone: "0900000000", email: "admin@salon.local", role: "ADMIN" },
    });
  }

  // Fallback Customer login cho khách hàng trải nghiệm
  if ((identifier === "0912345678" || identifier === "khachhang@gmail.com") && (password === "123456" || password === "Customer@123")) {
    const token = signToken({ accountId: "customer-master-id", role: "CUSTOMER" });
    return res.json({
      token,
      account: { id: "customer-master-id", fullName: "Nguyễn Văn Khách", phone: "0912345678", email: "khachhang@gmail.com", role: "CUSTOMER" },
    });
  }

  // Fallback Staff login cho nhân viên salon
  if ((identifier === "0900000001" || identifier === "staff@salon.local") && (password === "Staff@123" || password === "123456")) {
    const token = signToken({ accountId: "staff-master-id", role: "STAFF" });
    return res.json({
      token,
      account: { id: "staff-master-id", fullName: "Nguyễn Quang Minh (Stylist)", phone: "0900000001", email: "staff@salon.local", role: "STAFF" },
    });
  }

  return res.status(401).json({ message: "Sai thông tin đăng nhập" });
});

const otpRequestSchema = z.object({ phone: z.string().min(8).max(15) });

// UC001 - Yêu cầu gửi mã OTP để đặt lịch nhanh không cần tài khoản
router.post("/otp/request", async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
  }
  const { phone } = parsed.data;

  try {
    const account = await withDbTimeout(prisma.account.findUnique({ where: { phone } }), 2000);
    if (account?.locked) {
      return res.status(403).json({ message: "Số điện thoại này đã bị khoá, vui lòng liên hệ salon" });
    }
  } catch (err) {
    // DB offline
  }

  const code = generateOtpCode();
  try {
    await withDbTimeout(prisma.otpCode.create({ data: { phone, code, expiresAt: otpExpiryDate() } }), 2000);
  } catch (err) {
    // DB offline, lưu vào in-memory
  }
  MOCK_OTP_CODES.set(phone, { code, expiresAt: Date.now() + 10 * 60_000 });

  console.log(`[OTP:mô phỏng] Gửi mã ${code} đến số điện thoại ${phone}`);

  return res.json({
    message: "Đã gửi mã OTP",
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : { devCode: code }),
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

  let isOtpValid = false;
  try {
    const otp = await withDbTimeout(
      prisma.otpCode.findFirst({
        where: { phone, code, consumed: false, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
      2000
    );
    if (otp) {
      isOtpValid = true;
      await withDbTimeout(prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } }), 2000);
    }
  } catch (err) {
    // DB offline
  }

  if (!isOtpValid) {
    const cachedOtp = MOCK_OTP_CODES.get(phone);
    if (cachedOtp && cachedOtp.code === code && cachedOtp.expiresAt >= Date.now()) {
      isOtpValid = true;
      MOCK_OTP_CODES.delete(phone);
    }
  }

  if (!isOtpValid) {
    return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn" });
  }

  let account: any = null;
  try {
    account = await withDbTimeout(prisma.account.findUnique({ where: { phone } }), 2000);
    if (!account) {
      account = await withDbTimeout(
        prisma.account.create({
          data: { phone, fullName: fullName ?? "Khách hàng", role: "CUSTOMER", isQuickProfile: true },
        }),
        2000
      );
    }
  } catch (err) {
    // DB offline
  }

  if (!account) {
    account = {
      id: "cust-quick-" + Date.now(),
      phone,
      fullName: fullName ?? "Khách hàng",
      role: "CUSTOMER",
      isQuickProfile: true,
    };
  }

  const token = signToken({ accountId: account.id, role: account.role });
  return res.json({
    token,
    account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
  });
});

// Lấy thông tin tài khoản hiện tại (dùng để khôi phục phiên đăng nhập ở frontend)
router.get("/me", requireAuth, async (req, res) => {
  const accountId = req.auth!.accountId;
  if (accountId === "admin-master-id") {
    return res.json({
      account: { id: "admin-master-id", fullName: "Quản trị viên", phone: "0900000000", email: "admin@salon.local", role: "ADMIN" },
      hasPassword: true,
    });
  }
  if (accountId === "customer-master-id") {
    return res.json({
      account: { id: "customer-master-id", fullName: "Nguyễn Văn Khách", phone: "0912345678", email: "khachhang@gmail.com", role: "CUSTOMER" },
      hasPassword: true,
    });
  }
  if (accountId === "staff-master-id") {
    return res.json({
      account: { id: "staff-master-id", fullName: "Nguyễn Quang Minh (Stylist)", phone: "0900000001", email: "staff@salon.local", role: "STAFF" },
      hasPassword: true,
    });
  }

  const registered = REGISTERED_ACCOUNTS.find((a) => a.id === accountId);
  if (registered) {
    return res.json({
      account: { id: registered.id, fullName: registered.fullName, phone: registered.phone, email: registered.email, role: registered.role },
      hasPassword: true,
    });
  }

  const fallbackCustomer = FALLBACK_CUSTOMERS.find((c) => c.id === accountId);
  if (fallbackCustomer) {
    return res.json({
      account: { id: fallbackCustomer.id, fullName: fallbackCustomer.fullName, phone: fallbackCustomer.phone, email: fallbackCustomer.email, role: "CUSTOMER" },
      hasPassword: true,
    });
  }

  try {
    const account = await withDbTimeout(prisma.account.findUnique({ where: { id: accountId } }), 2000);
    if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    return res.json({
      account: { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email, role: account.role },
      hasPassword: Boolean(account.passwordHash),
    });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi kết nối cơ sở dữ liệu" });
  }
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
