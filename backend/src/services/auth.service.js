import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwt.js";

const prisma = new PrismaClient();

/**
 * 🔐 Login admin
 */
export async function loginService(email, password, ipAddress, userAgent) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User tidak ditemukan");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Password salah");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  await prisma.authLog.create({
    data: {
      userId: user.id,
      action: "login",
      ipAddress,
      userAgent,
    },
  });

  const token = generateToken(user);
  return { token, user };
}

/**
 * 🚪 Logout admin
 */
export async function logoutService(userId, ipAddress, userAgent) {
  await prisma.authLog.create({
    data: {
      userId,
      action: "logout",
      ipAddress,
      userAgent,
    },
  });
  return { message: "Logout berhasil" };
}
