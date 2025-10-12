// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.route.js";
import { prisma } from "./lib/prisma.js";
import { syncTopCoins } from "./services/cmc.service.js";
import {
  getExactMatchedPairs,
  startLivePriceUpdater,
} from "./services/marketcap.service.js";
import { startAllSchedulers } from "./services/scheduler.service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ✅ Routes
app.get("/api", (_, res) =>
  res.json({
    success: true,
    message: "🚀 Crypto Analyze API is running!",
    env: NODE_ENV,
    host: HOST,
    port: PORT,
  })
);
app.use("/api", routes);
app.get("/", (req, res) => res.redirect("/api"));

// ✅ Start Server
app.listen(PORT, async () => {
  console.log("==========================================");
  console.log("🚀 Crypto Analyze Backend is LIVE!");
  console.log(`🌐 http://${HOST}:${PORT}/api`);
  console.log(`🧭 Environment: ${NODE_ENV}`);
  console.log("==========================================");

  try {
    console.log("📊 [1/4] Syncing Top 100 Coins from CMC...");
    await syncTopCoins();

    console.log("🔗 [2/4] Matching pairs on Coinbase...");
    await getExactMatchedPairs();

    console.log("⏰ [3/4] Starting historical data schedulers...");
    await startAllSchedulers();

    console.log("⚡ [4/4] Starting live price updater (5-second interval)...");
    await startLivePriceUpdater();

    console.log("✅ All background services running successfully.");
    console.log("📈 Live prices will update every 5 seconds");
    console.log("📊 Historical data will sync every 1 minute");
  } catch (err) {
    console.error("❌ Failed to initialize services:", err.message);
  }
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🧹 Shutting down gracefully...");
  const { stopLivePriceUpdater } = await import(
    "./services/marketcap.service.js"
  );
  stopLivePriceUpdater();
  await prisma.$disconnect();
  process.exit(0);
});
