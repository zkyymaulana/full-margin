// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedAdmin() {
  const email = "admin@crypto.com";
  const password = "admin123";
  const name = "Admin";

  // Cek apakah admin sudah ada
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Buat user baru
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  console.log("Admin berhasil dibuat:", { email, password });
  return user;
}

// Jalankan langsung jika file ini dipanggil manual (node prisma/seed.js)
if (process.argv[1].includes("seed.js")) {
  seedAdmin()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("Error saat seeding:", err);
      prisma.$disconnect();
    });
}
