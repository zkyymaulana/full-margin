import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

// Sinkronisasi top coin dari CoinMarketCap lalu simpan hasil ke database.
export async function getCoinMarketcap(req, res) {
  try {
    // Proses sinkronisasi penuh dilakukan di service.
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

// Ambil data market cap dan candle live untuk top coin.
export async function getMarketcapLiveController(req, res) {
  try {
    // Ambil data live market dari service agar controller tetap tipis.
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

// Ambil simbol top coin dari database dengan filter listing date yang valid.
export async function getCoinSymbols(req, res) {
  try {
    // Batasi coin yang listing sebelum 1 Januari 2025.
    const cutoffDate = new Date("2025-01-01T00:00:00.000Z");

    // Ambil data top coin beserta detail coin melalui relasi.
    const topCoins = await prisma.topCoin.findMany({
      where: {
        coin: {
          // Pastikan format pair valid seperti BTC-USD.
          symbol: { contains: "-" },
          listingDate: {
            not: null,
            lt: cutoffDate,
          },
        },
      },
      include: {
        coin: {
          select: {
            symbol: true,
            name: true,
            rank: true,
            logo: true,
            listingDate: true,
          },
        },
      },
      take: 20,
    });

    // Urutkan hasil berdasarkan ranking coin.
    const sortedCoins = topCoins.sort(
      (a, b) => (a.coin.rank || 999) - (b.coin.rank || 999),
    );

    // Bentuk payload sederhana untuk response API.
    const symbols = sortedCoins.map((topCoin) => ({
      symbol: topCoin.coin.symbol,
      name: topCoin.coin.name,
      rank: topCoin.coin.rank,
      logo: topCoin.coin.logo,
      listingDate: topCoin.coin.listingDate,
    }));

    // Logging ringkas untuk membantu monitoring hasil query.
    console.log(
      `✅ Found ${symbols.length} symbols in database (listed before Jan 1, 2025)`,
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
