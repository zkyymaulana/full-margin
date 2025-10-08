/**
 * 🚀 Crypto MarketCap API (Minimal Thesis Version)
 * Menampilkan 100 coin teratas berdasarkan market cap (CoinGecko + Coinbase)
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getTop100WithCache } from "./services/marketcap.service.js";
import {
  getHistoricalData,
  getCoinbaseHourlyLoop,
} from "./services/data.service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";

// =================== MIDDLEWARE ===================
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// =================== HEALTH CHECK ===================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Crypto MarketCap API is running",
    environment: NODE_ENV,
    port: PORT,
  });
});

// =================== TOP 100 MARKET CAP ===================
app.get("/api/marketcap", async (req, res) => {
  try {
    const refresh = req.query.refresh === "true";
    const result = await getTop100WithCache(refresh);

    if (!result.success || !result.pairs?.length) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch top 100 market cap data",
      });
    }

    res.json({
      success: true,
      message: "Top 100 market cap coins available on Coinbase",
      totalMatched: result.total || result.pairs.length,
      matchRate: result.metadata?.matchRate || "N/A",
      updatedAt: result.timestamp,
      samplePairs: result.pairs?.slice(0, 10) || [],
      details: result.details?.slice(0, 100) || [],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving market cap data",
      error: err.message,
    });
  }
});

// =================== HISTORICAL DATA (K-line) ===================
app.get("/api/kline/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol; // contoh: BTC-USD
    const startTime = new Date("2020-10-01").getTime();
    const data = await getHistoricalData(symbol, startTime);

    res.json({
      success: true,
      symbol,
      candles: data.slice(-10), // tampilkan 10 candle terakhir
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data historis",
      error: err.message,
    });
  }
});

// =================== BTC-USD HOURLY DATA LOOP ===================
app.get("/api/btc-hourly-loop", async (req, res) => {
  try {
    console.log("🚀 Starting BTC-USD hourly data collection...");
    const allCandles = await getCoinbaseHourlyLoop();

    res.json({
      success: true,
      message: "BTC-USD hourly data collection completed",
      totalCandles: allCandles.length,
      firstCandle: allCandles[0],
      lastCandle: allCandles[allCandles.length - 1],
      savedTo: "./data/data-btcusd-1h.json",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to collect BTC-USD hourly data",
      error: err.message,
    });
  }
});

// =================== ROOT & 404 HANDLER ===================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Crypto MarketCap API",
    docs: "/api/marketcap",
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// =================== START SERVER ===================
app.listen(PORT, HOST, async () => {
  console.log(`✅ Server running on http://${HOST}:${PORT} (${NODE_ENV})`);

  try {
    const result = await getTop100WithCache();
    console.log(`💎 Loaded ${result.pairs.length} top CMC coins from Coinbase`);
  } catch (err) {
    console.error("⚠️ Failed to load market data:", err.message);
  }
});
