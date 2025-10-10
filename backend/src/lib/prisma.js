// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // log: ["query", "info", "warn", "error"], // aktifkan jika perlu debug
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
