// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed timeframes yang diperlukan sistem
 */
export async function seedTimeframes() {
  const timeframes = ["1h", "4h", "1d"];

  for (const tf of timeframes) {
    await prisma.timeframe.upsert({
      where: { timeframe: tf },
      update: {},
      create: { timeframe: tf },
    });
  }

  console.log(`✅ Timeframes seeded: ${timeframes.join(", ")}`);
}

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

  console.log("✅ Admin berhasil dibuat:", { email, password });
  return user;
}

// Jalankan semua seed functions
async function seedAll() {
  console.log("🌱 Starting database seeding...");

  // Seed timeframes first (required by other tables)
  await seedTimeframes();

  // Seed admin user
  await seedAdmin();

  console.log("✅ Database seeding completed!");
}

// Jalankan langsung jika file ini dipanggil manual (node prisma/seed.js)
if (process.argv[1].includes("seed.js")) {
  seedAll()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("❌ Error saat seeding:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
