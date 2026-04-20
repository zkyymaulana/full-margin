// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

// Reuse instance pada mode development agar tidak membuat banyak koneksi.
const prismaBaseClient =
  globalForPrisma.prismaBaseClient ||
  new PrismaClient({
    log: ["error", "warn"],
    errorFormat: "pretty",
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

export const prisma = new Proxy(prismaBaseClient, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (value !== undefined) {
      return typeof value === "function" ? value.bind(target) : value;
    }

    if (prop === "indicator" && Reflect.has(target, "indicators")) {
      return Reflect.get(target, "indicators", receiver);
    }

    return undefined;
  },
});

// Coba koneksi lebih awal supaya kegagalan DB terlihat saat startup.
prismaBaseClient.$connect().catch((err) => {
  console.error("❌ Failed to connect to database:", err.message);
  process.exit(1);
});

// Simpan instance global saat development (hot reload safe).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBaseClient = prismaBaseClient;
  globalForPrisma.prisma = prisma;

  prismaBaseClient.$on("query", (e) => {
    if (process.env.DEBUG_QUERIES === "true") {
      console.log("🧾 Query:", e.query);
      console.log("🧩 Params:", e.params);
      console.log("⏱️ Duration:", e.duration + "ms");
      console.log("-------------------------------------------");
    }
  });
}
