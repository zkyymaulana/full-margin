import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateToken } from "../../utils/jwt.js";

const prisma = new PrismaClient();

export async function loginService(email, password, ipAddress, userAgent) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User tidak ditemukan");

  if (!(await bcrypt.compare(password, user.passwordHash)))
    throw new Error("Password salah");

  await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }),
    prisma.authLog.create({
      data: { userId: user.id, action: "login", ipAddress, userAgent },
    }),
  ]);

  return { token: generateToken(user), user };
}

export async function logoutService(userId, ipAddress, userAgent) {
  await prisma.authLog.create({
    data: { userId, action: "logout", ipAddress, userAgent },
  });
  return { message: "Logout berhasil" };
}
