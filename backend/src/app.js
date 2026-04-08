import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.route.js";
import { prisma } from "./lib/prisma.js";

// Services
import { seedAdmin, seedTimeframes } from "../prisma/seed.js";
import {
  syncTopCoins,
  syncTopCoinRanksFromCmc,
} from "./services/market/index.js";
import { getMarketcapRealtime } from "./services/market/index.js";
import { startAllSchedulers } from "./services/scheduler/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "localhost";
const ENV = process.env.NODE_ENV || "development";
const STARTUP_BG_DELAY_MS = Number(process.env.STARTUP_BG_DELAY_MS || 3000);
const ENABLE_STARTUP_BACKGROUND_JOBS =
  (process.env.ENABLE_STARTUP_BACKGROUND_JOBS ?? "true").toLowerCase() ===
  "true";
let isStartupInitRunning = false;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.get("/api", (_, res) =>
  res.json({
    success: true,
    message: "🚀 Crypto Analyze API is running!",
    env: ENV,
  }),
);
app.use("/api", routes);
app.get("/", (_, res) => res.redirect("/api"));

// Helper: Jalankan langkah inisialisasi bertahap
async function initializeSystem() {
  const schedulerAutoStart =
    (process.env.SCHEDULER_AUTO_START ?? "true").toLowerCase() === "true";

  const steps = [
    ["⏱️ Seeding timeframes", seedTimeframes],
    ["👤 Seeding admin", seedAdmin],
    ["📊 Sync Top 20 CMC", syncTopCoins],
    ["🏷️ Sync latest CMC ranks", syncTopCoinRanksFromCmc],
    ["🔗 Matching pairs Coinbase", getMarketcapRealtime],
    schedulerAutoStart
      ? ["⏰ Start automated schedulers", startAllSchedulers]
      : null,
  ].filter(Boolean);

  if (!schedulerAutoStart) {
    console.log(
      "⏸️ Scheduler auto-start disabled by SCHEDULER_AUTO_START=false",
    );
  }

  for (const [label, fn] of steps) {
    console.log(`${label}...`);
    try {
      await fn();
      console.log(`✅ ${label} berhasil`);
    } catch (err) {
      console.error(`❌ ${label} gagal:`, err.message);
    }
  }

  console.log("Background service aktif!");
}

async function runStartupBackgroundJobs() {
  if (!ENABLE_STARTUP_BACKGROUND_JOBS) {
    console.log(
      "⏸️ Startup background jobs disabled by ENABLE_STARTUP_BACKGROUND_JOBS=false",
    );
    return;
  }

  if (isStartupInitRunning) {
    console.log(
      "ℹ️ Startup background jobs already running. Skip duplicate trigger.",
    );
    return;
  }

  isStartupInitRunning = true;
  console.log("🛠️ Starting background initialization jobs...");

  try {
    await initializeSystem();
    console.log("✅ Background initialization jobs finished");
  } catch (err) {
    console.error("❌ Background initialization failed:", err.message);
  } finally {
    isStartupInitRunning = false;
  }
}

// Jalankan server
app.listen(PORT, "0.0.0.0", async () => {
  console.log("==========================================");
  console.log("🚀 Crypto Analyze Backend is LIVE!");
  console.log(`🌐 http://${HOST}:${PORT}/api`);
  console.log(`🧭 Environment: ${ENV}`);
  console.log("==========================================");

  try {
    // Prisma tetap dikoneksikan di startup agar background jobs punya koneksi DB yang valid.
    await prisma.$connect();
    console.log("✅ Database connected");

    // Jalankan inisialisasi berat secara non-blocking setelah server siap menerima request.
    console.log(
      `⏳ Scheduling background initialization in ${STARTUP_BG_DELAY_MS}ms...`,
    );
    setTimeout(() => {
      void runStartupBackgroundJobs();
    }, STARTUP_BG_DELAY_MS);
  } catch (err) {
    console.error("❌ Gagal inisialisasi sistem:", err.message);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

// Graceful shutdown (Ctrl + C)
process.on("SIGINT", async () => {
  console.log("\n Shutting down gracefully...");
  await prisma.$disconnect();
  console.log("Database disconnected. See you!");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n SIGTERM received, shutting down gracefully...");
  await prisma.$disconnect();
  console.log("Database disconnected. See you!");
  process.exit(0);
});
