// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getAdminSeedConfig() {
  return {
    email: "admin@crypto.com",
    password: "admin123",
    name: "Admin",
  };
}

// Seed daftar timeframe utama yang dipakai sistem.
export async function seedTimeframes() {
  await prisma.timeframe.upsert({
    where: { timeframe: "1h" },
    update: {},
    create: { timeframe: "1h" },
  });
}

// Seed user admin default jika belum ada.
export async function seedAdmin() {
  const { email, password, name } = getAdminSeedConfig();

  // Cek apakah admin sudah terdaftar berdasarkan email.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin sudah ada, proses seed admin dilewati.");
    return existing;
  }

  // Hash password sebelum disimpan ke database.
  const passwordHash = await bcrypt.hash(password, 10);

  // Buat akun admin baru.
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  console.log("Admin berhasil dibuat:", { email, password });
  return user;
}
