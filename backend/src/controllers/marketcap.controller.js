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
 * Data diambil langsung dari TopCoin table
 */
export async function getCoinSymbols(req, res) {
  try {
    // Ambil Top 20 dari TopCoin dengan JOIN ke Coin untuk ambil logo
    const symbols = await prisma.topCoin.findMany({
      where: {
        symbol: { contains: "-" }, //  Hanya pair valid seperti BTC-USD, ETH-USD
      },
      select: {
        symbol: true,
        name: true,
        rank: true,
      },
      orderBy: {
        rank: "asc", // Urutkan berdasarkan rank dari kecil ke besar
      },
      take: 20, // Ambil maksimal 20 symbols
    });

    //  Ambil logo dari tabel Coin untuk setiap symbol
    const symbolsWithLogo = await Promise.all(
      symbols.map(async (item) => {
        const coin = await prisma.coin.findUnique({
          where: { symbol: item.symbol },
          select: { logo: true },
        });

        return {
          ...item,
          logo: coin?.logo || null, //  Tambahkan logo, default null jika tidak ada
        };
      })
    );

    console.log(` Found ${symbolsWithLogo.length} symbols in database`);

    res.json({
      success: true,
      message: "Berhasil mengambil daftar symbol coin.",
      total: symbolsWithLogo.length,
      symbols: symbolsWithLogo,
    });
  } catch (err) {
    console.error("Get coin symbols error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
