// src/controllers/marketcap.controller.js
import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

// Sinkronisasi Top Coin dari CoinMarketCap + pairing dengan Coinbase.
export async function getCoinMarketcap(req, res) {
  try {
    console.log("🔄 Memulai proses sinkronisasi marketcap...");
    const result = await getMarketcapRealtime();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "Gagal sinkronisasi data marketcap.",
      });
    }

    res.json({
      success: true,
      message: result.message,
      total: result.total,
      coins: result.coins,
    });
  } catch (err) {
    console.error("❌ Marketcap sync error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil data harga & candle live dari Coinbase untuk top coin.
export async function getMarketcapLiveController(req, res) {
  try {
    const limit = Number(req.query.limit) || 20;
    const result = await getMarketcapLive(limit);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "Gagal mengambil data live ticker.",
      });
    }

    res.json({
      success: true,
      message: "Berhasil mengambil data market cap dengan history.",
      timestamp: new Date().toISOString(),
      summary: result.summary,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    console.error("❌ Live ticker error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Mengambil daftar semua symbol coin dari database.
export async function getCoinSymbols(req, res) {
  try {
    console.log("📋 Mengambil daftar symbol coin dari database...");

    const coins = await prisma.coin.findMany({
      select: {
        symbol: true,
        name: true,
        rank: true,
      },
      orderBy: {
        rank: "asc",
      },
    });

    res.json({
      success: true,
      message: "Berhasil mengambil daftar symbol coin.",
      total: coins.length,
      symbols: coins,
    });
  } catch (err) {
    console.error("❌ Get coin symbols error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
