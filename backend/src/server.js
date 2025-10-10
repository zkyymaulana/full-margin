import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.route.js";
import { startAllSchedulers } from "./services/scheduler.service.js";
import { syncTopCoins } from "./services/cmc.service.js";
import { getExactMatchedPairs } from "./services/marketcap.service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ✅ Routes
app.use("/api", routes);

app.get("/api", (req, res) => {
  res.json({
    success: true,
    status: "running",
    message: "Server sudah berjalan. Selamat datang di Crypto Analyze 🚀",
    environment: NODE_ENV,
    port: PORT,
  });
});

app.get("/", (req, res) => {
  res.redirect("/api");
});

// ✅ Jalankan server
app.listen(PORT, HOST, async () => {
  console.log("==========================================");
  console.log("🚀 Crypto Analyze API is LIVE!");
  console.log(`🌐 Server running at: http://${HOST}:${PORT}/api`);
  console.log(`🧭 Environment: ${NODE_ENV}`);
  console.log("==========================================");

  try {
    console.log("📊 Menyinkronkan Top 100 Coin dari CMC...");
    await syncTopCoins();

    console.log("⏰ Menjalankan semua scheduler...");
    // await startAllSchedulers();
    await getExactMatchedPairs();
    console.log("✅ Semua service aktif!");
  } catch (err) {
    console.error("❌ Gagal memulai service:", err.message);
  }
});
