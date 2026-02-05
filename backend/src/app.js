import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.route.js";
import { prisma } from "./lib/prisma.js";

// Services
import { seedAdmin } from "../prisma/seed.js";
import { syncTopCoins } from "./services/market/syncTopCoins.service.js";
import { getMarketcapRealtime } from "./services/market/marketcap.service.js";
import { startAllSchedulers } from "./services/scheduler/scheduler.service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "localhost";
const ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.get("/api", (_, res) =>
  res.json({
    success: true,
    message: "🚀 Crypto Analyze API is running!",
    env: ENV,
  })
);
app.use("/api", routes);
app.get("/", (_, res) => res.redirect("/api"));

// Helper: Jalankan langkah inisialisasi bertahap
async function initializeSystem() {
  const steps = [
    ["👤 Seeding admin", seedAdmin],
    ["📊 Sync Top 20 CMC", syncTopCoins],
    ["🔗 Matching pairs Coinbase", getMarketcapRealtime],
    ["⏰ Start automated schedulers", startAllSchedulers],
  ];

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

// Jalankan server
app.listen(PORT, async () => {
  console.log("==========================================");
  console.log("🚀 Crypto Analyze Backend is LIVE!");
  console.log(`🌐 http://${HOST}:${PORT}/api`);
  console.log(`🧭 Environment: ${ENV}`);
  console.log("==========================================");

  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    await initializeSystem();
  } catch (err) {
    console.error("❌ Gagal inisialisasi sistem:", err.message);
  }
});

// Graceful shutdown (Ctrl + C)
process.on("SIGINT", async () => {
  console.log("\n Shutting down gracefully...");
  await prisma.$disconnect();
  console.log("Database disconnected. See you!");
  process.exit(0);
});
