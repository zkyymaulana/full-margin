import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import routes from "./routes/index.route.js";
import { prisma } from "./lib/prisma.js";

// Services
import { seedAdmin, seedTimeframes } from "../prisma/seed.js";
import {
  syncTopCoins,
  syncTopCoinRanksFromCmc,
} from "./services/market/index.js";
import { startAllSchedulers } from "./services/scheduler/index.js";
import {
  initTickerWebsocket,
  shutdownTickerWebsocket,
} from "./services/websocket/websocket.service.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;
const ENV = process.env.NODE_ENV || "development";
const BG_START_DELAY = Number(process.env.BG_START_DELAY || 3000);

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
  const targetBufferedCoins = Number(
    process.env.TARGET_ASSET_BUFFER_LIMIT || "20",
  );

  const steps = [
    ["Seeding timeframes", seedTimeframes],
    ["Seeding admin", seedAdmin],
    [`Sync Top ${targetBufferedCoins} CMC (buffer)`, syncTopCoins],
    ["Sync latest CMC ranks", syncTopCoinRanksFromCmc],
    ["Start automated schedulers", startAllSchedulers],
  ].filter(Boolean);

  for (const [label, fn] of steps) {
    console.log(`${label}...`);
    try {
      await fn();
      console.log(`${label} berhasil`);
    } catch (err) {
      console.error(`${label} gagal:`, err.message);
    }
  }
}

async function runStartupBackgroundJobs() {
  try {
    await initializeSystem();
    console.log("Background service aktif!");
  } catch (err) {
    console.error("Background initialization failed:", err.message);
  }
}

// Jalankan server
server.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);

  // Inisialisasi WebSocket backend + koneksi Coinbase (hanya satu koneksi).
  initTickerWebsocket(server);

  try {
    await prisma.$connect();
    console.log("Database connected");

    setTimeout(runStartupBackgroundJobs, BG_START_DELAY);
  } catch (err) {
    console.error("Init failed:", err.message);
  }
});

// Menangkap error dari Promise yang tidak di-handle (tidak ada .catch)
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

// Menangkap error yang tidak tertangkap sama sekali (crash-level error)
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// Graceful shutdown saat tekan Ctrl + C di terminal (development / manual stop)
process.on("SIGINT", async () => {
  console.log("\n Shutting down gracefully...");

  // Matikan koneksi WebSocket / stream data agar tidak menggantung
  shutdownTickerWebsocket();

  // Tutup koneksi database (Prisma) agar tidak terjadi memory leak / connection leak
  await prisma.$disconnect();
  console.log("Database disconnected. See you!");

  // Keluar dari proses dengan status sukses
  process.exit(0);
});

// Graceful shutdown saat server dimatikan oleh sistem (production / hosting)
process.on("SIGTERM", async () => {
  console.log("\n SIGTERM received, shutting down gracefully...");

  // Matikan WebSocket
  shutdownTickerWebsocket();

  // Tutup koneksi database
  await prisma.$disconnect();
  console.log("Database disconnected. See you!");

  // Keluar dari proses
  process.exit(0);
});
