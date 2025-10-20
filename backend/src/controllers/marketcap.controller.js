// src/controllers/marketcap.controller.js
import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

/**
 * GET /api/marketcap
 * 🔹 Sinkronisasi top 200 coin dari CMC, pairing dengan Coinbase,
 * lalu simpan 100 coin valid ke database.
 * Mengembalikan daftar coin + symbol.
 */
export async function getMarketcap(req, res) {
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

/**
 * GET /api/marketcap/live
 * 🔹 Mengambil data harga dan candle live untuk 100 coin dari database,
 * berdasarkan data Coinbase (ticker & OHLC).
 */
export async function getMarketcapLiveController(req, res) {
  try {
    console.log("⚡ Mengambil data live ticker...");
    const result = await getMarketcapLive();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "Gagal mengambil data live ticker.",
      });
    }

    res.json({
      success: true,
      message: "Berhasil mengambil data live ticker.",
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

/**
 * GET /api/marketcap/symbol
 * 🔹 Mengambil daftar semua symbol coin yang ada di database
 */
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
