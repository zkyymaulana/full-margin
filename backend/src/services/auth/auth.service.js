import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateToken } from "../../utils/jwt.js";

const prisma = new PrismaClient();

export async function registerService(email, password, name) {
  // Validasi input
  if (!email || !password || !name) {
    throw new Error("Email, password, dan nama wajib diisi");
  }

  const emailTrimmed = String(email).trim().toLowerCase();
  const nameTrimmed = String(name).trim();
  const passwordStr = String(password);

  // Validasi format
  if (nameTrimmed.length < 2) {
    throw new Error("Nama minimal 2 karakter");
  }

  if (passwordStr.length < 6) {
    throw new Error("Password minimal 6 karakter");
  }

  // Cek apakah email sudah terdaftar
  const existingUser = await prisma.user.findUnique({
    where: { email: emailTrimmed },
  });

  if (existingUser) {
    throw new Error("Email sudah terdaftar");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(passwordStr, 10);

  // Buat user baru
  const user = await prisma.user.create({
    data: {
      email: emailTrimmed,
      name: nameTrimmed,
      passwordHash,
      lastLogin: new Date(),
    },
  });

  // Log registrasi
  await prisma.authLog.create({
    data: { userId: user.id, action: "register" },
  });

  return { token: generateToken(user), user };
}

export async function loginService(email, password) {
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
      data: { userId: user.id, action: "login" },
    }),
  ]);

  return { token: generateToken(user), user };
}

export async function logoutService(userId) {
  await prisma.authLog.create({
    data: { userId, action: "logout" },
  });
  return { message: "Logout berhasil" };
}
