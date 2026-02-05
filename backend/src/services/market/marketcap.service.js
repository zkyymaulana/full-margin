// pairing & live marketcap summary
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { syncTopCoins } from "./syncTopCoins.service.js";
import { fetchTicker } from "./coinbase.service.js";

dotenv.config();

/**
 * Format harga dengan desimal dinamis untuk menangani aset dengan harga sangat kecil
 * (seperti SHIB, PEPE, dll) agar tidak dibulatkan menjadi 0
 *
 * - value >= 1      → 2 decimal places (e.g., 100.00)
 * - 0.01 <= value < 1 → 4 decimal places (e.g., 0.0123)
 * - value < 0.01    → 6 decimal places (e.g., 0.000123)
 */
function formatPrice(value) {
  if (value == null) return null;

  if (value >= 1) return Number(value.toFixed(2));
  if (value >= 0.01) return Number(value.toFixed(4));
  return Number(value.toFixed(6));
}

/**
 * Ambil Top 30 dari CMC → Pairing Top 20 dengan Coinbase → Simpan ke DB
 * Include logo dari tabel Coin
 */
export async function getMarketcapRealtime() {
  try {
    // syncTopCoins sudah handle: fetch 30, pair 20, save to TopCoin
    const cmc = await syncTopCoins();

    if (!cmc.success) {
      throw new Error(cmc.error || "Gagal mengambil data dari CMC.");
    }

    const topCoins = await prisma.topCoin.findMany({
      where: { rank: { lte: 30 } }, // Hanya ambil rank <= 30
      orderBy: { rank: "asc" },
      take: 20, // Ambil maksimal 20
    });

    // Ambil logo dari tabel Coin untuk setiap symbol
    const coinsWithLogo = await Promise.all(
      topCoins.map(async (coin) => {
        const coinData = await prisma.coin.findUnique({
          where: { symbol: coin.symbol },
          select: { logo: true },
        });

        return {
          rank: coin.rank,
          name: coin.name,
          symbol: coin.symbol,
          price: coin.price,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
          logo: coinData?.logo || null, // Include logo
        };
      })
    );

    return {
      success: true,
      total: coinsWithLogo.length,
      message: `Berhasil pairing ${coinsWithLogo.length} coin dengan rank dari CMC`,
      coins: coinsWithLogo, // Return coins with logo
    };
  } catch (e) {
    console.error("Sync error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Ambil harga live + candle terakhir untuk coin teratas + history + summary
 * Return ONLY Top 20 paired coins (guaranteed count)
 * Filter hanya symbol dengan format BASE-QUOTE (mengandung "-")
 * Summary statistics berdasarkan 20 coin teratas, data coin berdasarkan limit
 */
export async function getMarketcapLive(limit = 20) {
  try {
    // Memastikan (memaksa) batas maksimum adalah 20
    const requestedLimit = Math.max(1, Math.min(Number(limit) || 20, 20));

    // 1. Ambil 20 coin teratas untuk summary statistics
    const top20Coins = await prisma.topCoin.findMany({
      where: {
        symbol: { contains: "-" }, // Hanya pair valid seperti BTC-USD, ETH-USD
      },
      orderBy: { rank: "asc" },
      take: 20, // Hanya ambil 20 coin teratas
    });

    if (!top20Coins.length) {
      return {
        success: false,
        message: "Belum ada coin pair di DB. Jalankan /api/marketcap dulu.",
      };
    }

    // STEP 2: Fetch live data untuk 20 coin teratas untuk summary
    const top20LiveData = [];
    for (const coin of top20Coins) {
      const liveData = await fetchTicker(coin.symbol);

      if (liveData && liveData.price != null && liveData.volume != null) {
        const rawPrice = Number(liveData.price);
        const rawVolume = Number(liveData.volume);
        const rawOpen = Number(liveData.open || rawPrice);
        const rawMarketCap = rawVolume * rawPrice;
        const change24h =
          rawOpen > 0
            ? Number((((rawPrice - rawOpen) / rawOpen) * 100).toFixed(2))
            : 0;

        top20LiveData.push({
          rank: coin.rank,
          name: coin.name || coin.symbol.split("-")[0],
          symbol: coin.symbol,
          price: rawPrice,
          volume: rawVolume,
          marketCap: rawMarketCap,
          change24h,
        });
      }
    }

    // STEP 3: Calculate summary dari 20 coin teratas
    const totalMarketCap = top20LiveData.reduce(
      (sum, coin) => sum + coin.marketCap,
      0
    );
    const totalVolume24h = top20LiveData.reduce(
      (sum, coin) => sum + coin.volume * coin.price,
      0
    );

    const btcCoin = top20LiveData.find(
      (coin) => coin.symbol.startsWith("BTC-") || coin.symbol === "BTC"
    );
    const btcDominance =
      btcCoin && totalMarketCap > 0
        ? Number(((btcCoin.marketCap / totalMarketCap) * 100).toFixed(2))
        : 0;

    const activeCoins = top20LiveData.length;
    const gainers = top20LiveData.filter((coin) => coin.change24h > 0).length;
    const losers = top20LiveData.filter((coin) => coin.change24h < 0).length;

    // 🎯 STEP 4: Ambil hanya coin sesuai limit untuk display dengan detail lengkap
    const displayCoins = top20LiveData.slice(0, requestedLimit);
    const detailedData = [];

    for (const coinSummary of displayCoins) {
      // Fetch ticker lagi untuk data detail (bisa di-cache di masa depan)
      const liveData = await fetchTicker(coinSummary.symbol);

      if (!liveData || liveData.price == null) {
        continue;
      }

      // Get last 10 candles for history chart
      const historyCandles = await prisma.candle.findMany({
        where: { symbol: coinSummary.symbol },
        orderBy: { time: "desc" },
        take: 10,
      });

      const rawPrice = Number(liveData.price);
      const rawVolume = Number(liveData.volume);
      const rawOpen = Number(liveData.open || rawPrice);
      const rawHigh = Number(liveData.high || rawPrice);
      const rawLow = Number(liveData.low || rawPrice);
      const rawMarketCap = rawVolume * rawPrice;
      const change24h =
        rawOpen > 0
          ? Number((((rawPrice - rawOpen) / rawOpen) * 100).toFixed(2))
          : 0;
      const chartColor = rawPrice >= rawOpen ? "green" : "red";

      // Format history dengan desimal dinamis
      const history = historyCandles
        .reverse()
        .map((c) => formatPrice(Number(c.close)));

      detailedData.push({
        rank: coinSummary.rank,
        name: coinSummary.name,
        symbol: coinSummary.symbol,
        logo: null, // Akan diisi nanti
        price: formatPrice(rawPrice),
        volume: Number(rawVolume.toFixed(2)),
        marketCap: Number(rawMarketCap.toFixed(2)),
        open: formatPrice(rawOpen),
        high: formatPrice(rawHigh),
        low: formatPrice(rawLow),
        change24h,
        chartColor,
        history,
      });
    }

    // Ambil logo dari tabel Coin untuk setiap symbol
    const dataWithLogo = await Promise.all(
      detailedData.map(async (item) => {
        const coinData = await prisma.coin.findUnique({
          where: { symbol: item.symbol },
          select: { logo: true },
        });

        return {
          ...item,
          logo: coinData?.logo || null,
        };
      })
    );

    return {
      success: true,
      requestedLimit,
      total: dataWithLogo.length,
      count: dataWithLogo.length,
      summary: {
        totalMarketCap: Number(totalMarketCap.toFixed(2)),
        totalVolume24h: Number(totalVolume24h.toFixed(2)),
        btcDominance,
        activeCoins,
        gainers,
        losers,
      },
      data: dataWithLogo,
    };
  } catch (e) {
    console.error("Live error:", e.message);
    return { success: false, message: e.message };
  }
}
