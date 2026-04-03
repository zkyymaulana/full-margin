// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Ambil konfigurasi akun admin dari environment dengan fallback aman untuk development.
function getAdminSeedConfig() {
  return {
    email: process.env.SEED_ADMIN_EMAIL || "admin@crypto.com",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
    name: process.env.SEED_ADMIN_NAME || "Admin",
  };
}

// Cek apakah file dieksekusi langsung via command `node prisma/seed.js`.
function isDirectRun() {
  return (process.argv[1] || "").includes("seed.js");
}

// Seed daftar timeframe utama yang dipakai sistem.
export async function seedTimeframes() {
  // Timeframe wajib agar relasi data candle/indikator valid.
  const timeframes = ["1h", "4h", "1d"];

  // Gunakan upsert agar proses seed aman dijalankan berulang.
  for (const tf of timeframes) {
    await prisma.timeframe.upsert({
      where: { timeframe: tf },
      update: {},
      create: { timeframe: tf },
    });
  }

  console.log(`✅ Timeframes seeded: ${timeframes.join(", ")}`);
}

// Seed user admin default jika belum ada.
export async function seedAdmin() {
  const { email, password, name } = getAdminSeedConfig();

  // Cek apakah admin sudah terdaftar berdasarkan email.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("ℹ️ Admin sudah ada, proses seed admin dilewati.");
    return existing;
  }

  // Hash password sebelum disimpan ke database.
  const passwordHash = await bcrypt.hash(password, 10);

  // Buat akun admin baru.
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  console.log("✅ Admin berhasil dibuat:", { email, password });
  return user;
}

// Jalankan seluruh proses seeding berurutan.
async function seedAll() {
  console.log("🌱 Starting database seeding...");

  // Seed timeframe terlebih dahulu karena dibutuhkan tabel lain.
  await seedTimeframes();

  // Lanjutkan seed akun admin.
  await seedAdmin();

  console.log("✅ Database seeding completed!");
}

// Eksekusi langsung hanya saat file dipanggil manual.
if (isDirectRun()) {
  seedAll()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("❌ Error saat seeding:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
