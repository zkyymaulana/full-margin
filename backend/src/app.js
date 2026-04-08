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
  getMarketcapRealtime,
} from "./services/market/index.js";
import { startAllSchedulers } from "./services/scheduler/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
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
  }),
);

app.use("/api", routes);
app.get("/", (_, res) => res.redirect("/api"));

// 🔥 Background init (NON-BLOCKING)
async function initializeSystem() {
  const schedulerAutoStart =
    (process.env.SCHEDULER_AUTO_START ?? "true").toLowerCase() === "true";

  const steps = [
    ["⏱️ Seeding timeframes", seedTimeframes],
    ["👤 Seeding admin", seedAdmin],

    // ⚠️ kalau masih berat, nanti bisa dimatikan dulu
    ["📊 Sync Top 20 CMC", syncTopCoins],
    ["🏷️ Sync latest CMC ranks", syncTopCoinRanksFromCmc],
    ["🔗 Matching pairs Coinbase", getMarketcapRealtime],

    schedulerAutoStart
      ? ["⏰ Start automated schedulers", startAllSchedulers]
      : null,
  ].filter(Boolean);

  for (const [label, fn] of steps) {
    console.log(`${label}...`);
    try {
      await fn();
      console.log(`✅ ${label} berhasil`);
    } catch (err) {
      console.error(`❌ ${label} gagal:`, err.message);
    }
  }

  console.log("✅ Background service selesai");
}

// 🚀 START SERVER (TIDAK BOLEH BLOCKING)
app.listen(PORT, "0.0.0.0", async () => {
  console.log("==========================================");
  console.log("🚀 Server LIVE");
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🧭 Environment: ${ENV}`);
  console.log("==========================================");

  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    // 🔥 PENTING: JANGAN await
    setTimeout(() => {
      initializeSystem();
    }, 3000);
  } catch (err) {
    console.error("❌ Init error:", err.message);
  }
});
