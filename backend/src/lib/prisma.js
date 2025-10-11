// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"], // Enable error and warning logs for debugging
    errorFormat: "pretty",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;

  // Enable query logs in development for debugging
  prisma.$on("query", (e) => {
    if (process.env.DEBUG_QUERIES === "true") {
      console.log("Query:", e.query);
      console.log("Params:", e.params);
      console.log("Duration:", e.duration + "ms");
    }
  });
}
