// src/controllers/marketcap.controller.js
import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

// Sinkronisasi 20 Top Coin dari CoinMarketCap + pairing dengan Coinbase.
export async function getCoinMarketcap(req, res) {
  try {
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
    console.error("Marketcap sync error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil data harga & candle live dari Coinbase untuk top coin.
export async function getMarketcapLiveController(req, res) {
  try {
    const result = await getMarketcapLive();

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
    console.error("Live ticker error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Mengambil daftar symbol coin dari database (hanya Top 20)
 * Data diambil dari TopCoin dengan JOIN ke Coin untuk ambil symbol, name, rank, logo
 *
 * FILTERING LOGIC:
 * - Hanya menampilkan coin dengan listingDate < 1 Januari 2025
 * - listingDate = earliest candle date dari Coinbase (bukan CMC launch date)
 * - Coin tanpa listingDate (null) juga ditampilkan (akan di-set setelah historical sync)
 * - Filter hanya pair valid dengan format BASE-QUOTE (mengandung "-")
 */
export async function getCoinSymbols(req, res) {
  try {
    // Define cutoff date: 1 Januari 2025
    const cutoffDate = new Date("2025-01-01T00:00:00.000Z");

    // Ambil Top 20 dari TopCoin dengan JOIN ke Coin
    // Filter: listing date < 2025-01-01 ATAU listingDate null (belum sync)
    const topCoins = await prisma.topCoin.findMany({
      where: {
        coin: {
          symbol: { contains: "-" }, // Hanya pair valid seperti BTC-USD, ETH-USD
          OR: [
            { listingDate: { lt: cutoffDate } }, // Coin dengan data historis sebelum cutoff
            { listingDate: null }, // Coin baru tanpa listingDate (akan di-set setelah sync)
          ],
        },
      },
      include: {
        coin: {
          select: {
            symbol: true,
            name: true,
            rank: true,
            logo: true,
            listingDate: true, // Include untuk debugging
          },
        },
      },
      take: 20, // Ambil maksimal 20 symbols
    });

    // Sort berdasarkan rank
    const sortedCoins = topCoins.sort(
      (a, b) => (a.coin.rank || 999) - (b.coin.rank || 999)
    );

    // Map ke format yang dibutuhkan
    const symbols = sortedCoins.map((topCoin) => ({
      symbol: topCoin.coin.symbol,
      name: topCoin.coin.name,
      rank: topCoin.coin.rank,
      logo: topCoin.coin.logo,
      listingDate: topCoin.coin.listingDate, // Include untuk frontend info (optional)
    }));

    console.log(
      `✅ Found ${symbols.length} symbols in database (listed before Jan 1, 2025)`
    );

    res.json({
      success: true,
      message: "Berhasil mengambil daftar symbol coin.",
      total: symbols.length,
      symbols: symbols,
    });
  } catch (err) {
    console.error("Get coin symbols error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
