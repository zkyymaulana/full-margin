// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Tambahkan serializer global agar BigInt aman saat dikirim sebagai JSON.
function registerBigIntSerializer() {
  if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
      // Gunakan string agar tidak terjadi overflow angka besar.
      return this.toString();
    };
  }
}

// Buat instance PrismaClient dengan konfigurasi logging standar backend.
function createPrismaClient() {
  return new PrismaClient({
    log: ["error", "warn"],
    errorFormat: "pretty",
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

// Aktifkan query logging detail saat DEBUG_QUERIES=true.
function registerDebugQueryLogging(client) {
  client.$on("query", (e) => {
    if (process.env.DEBUG_QUERIES === "true") {
      console.log("🧾 Query:", e.query);
      console.log("🧩 Params:", e.params);
      console.log("⏱️ Duration:", e.duration + "ms");
      console.log("-------------------------------------------");
    }
  });
}

registerBigIntSerializer();

// Reuse instance pada mode development agar tidak membuat banyak koneksi.
export const prisma = globalForPrisma.prisma || createPrismaClient();

// Coba koneksi lebih awal supaya kegagalan DB terlihat saat startup.
prisma.$connect().catch((err) => {
  console.error("❌ Failed to connect to database:", err.message);
  process.exit(1);
});

// Simpan instance global saat development (hot reload safe).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  registerDebugQueryLogging(prisma);
}
