import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { verifyToken, AuthTokenPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Thiếu token xác thực" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const account = await prisma.account.findUnique({ where: { id: payload.accountId }, select: { locked: true } });
    if (!account) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }
    if (account.locked) {
      return res.status(403).json({ message: "Tài khoản của bạn đã bị khoá, vui lòng liên hệ salon" });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này" });
    }
    next();
  };
}
