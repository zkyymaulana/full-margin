// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

/**
 * 🧩 Prisma Client Setup
 * - Reuses instance in dev mode to prevent connection leaks (Next.js/Hot reload)
 * - Adds optional query logging for debugging
 * - Fixes BigInt serialization issue in JSON responses
 */

const globalForPrisma = globalThis;

/**
 * 🧠 Global BigInt Fix
 * JSON.stringify() tidak tahu cara meng-serialize BigInt.
 * Dengan ini, semua BigInt otomatis diubah ke string agar tidak error saat res.json().
 */
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    // Convert to string (bukan Number untuk mencegah overflow)
    return this.toString();
  };
}

/**
 * 🚀 Prisma Client initialization with connection pool configuration
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"], // tampilkan hanya error dan warning
    errorFormat: "pretty", // tampilkan format error yang lebih rapi
    // ✅ Connection pool configuration to prevent timeout
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// ✅ Configure connection pool timeout (10 minutes instead of default 60 seconds)
prisma.$connect().catch((err) => {
  console.error("❌ Failed to connect to database:", err.message);
  process.exit(1);
});

/**
 * 🧰 Reuse Prisma instance in development (Hot Reload Safe)
 * Kalau tidak, akan muncul error “PrismaClient is already running”
 */
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;

  // Optional: enable detailed query logging (aktifkan lewat .env)
  prisma.$on("query", (e) => {
    if (process.env.DEBUG_QUERIES === "true") {
      console.log("🧾 Query:", e.query);
      console.log("🧩 Params:", e.params);
      console.log("⏱️ Duration:", e.duration + "ms");
      console.log("-------------------------------------------");
    }
  });
}

/**
 * ✅ Example usage:
 * import { prisma } from "../lib/prisma.js";
 * const users = await prisma.user.findMany();
 */
