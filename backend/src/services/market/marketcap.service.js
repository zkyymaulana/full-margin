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
    // ✅ syncTopCoins sudah dipanggil di initialization, tidak perlu panggil lagi
    // Langsung ambil data dari database saja

    // Ambil TopCoin dengan JOIN ke Coin untuk dapat rank, name, symbol, logo
    const topCoins = await prisma.topCoin.findMany({
      where: {
        coin: {
          rank: { lte: 30 }, // Hanya ambil rank <= 30 dari tabel Coin
        },
      },
      include: {
        coin: true, // Include data dari tabel Coin
      },
      take: 20, // Ambil maksimal 20
    });

    // Sort berdasarkan rank dari tabel Coin
    const sortedCoins = topCoins.sort(
      (a, b) => (a.coin.rank || 999) - (b.coin.rank || 999)
    );

    const coinsWithLogo = sortedCoins.map((topCoin) => ({
      rank: topCoin.coin.rank,
      name: topCoin.coin.name,
      symbol: topCoin.coin.symbol,
      price: topCoin.price,
      marketCap: topCoin.marketCap,
      volume24h: topCoin.volume24h,
      logo: topCoin.coin.logo, // Logo dari tabel Coin
    }));

    return {
      success: true,
      total: coinsWithLogo.length,
      message: `Berhasil pairing ${coinsWithLogo.length} coin dengan rank dari CMC`,
      coins: coinsWithLogo,
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
 * Summary dan data SELALU menampilkan 20 coin teratas
 *
 * FILTERING LOGIC:
 * - Uses listingDate from Coin table which represents EARLIEST CANDLE DATE from Coinbase
 * - This is the actual date when historical data becomes available on Coinbase
 * - We filter by launch date < Jan 1, 2025 to ensure coins have sufficient historical data
 * - Coins without listingDate (new coins) will be included until historical sync sets it
 */
export async function getMarketcapLive() {
  try {
    // Get timeframe ID for "1h"
    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe: "1h" },
      select: { id: true },
    });

    if (!timeframeRecord) {
      return {
        success: false,
        message: 'Timeframe "1h" not found in database.',
      };
    }

    // ✅ Filter coins by earliest candle date from Coinbase
    // This ensures we only analyze coins with sufficient historical data
    // Note: listingDate = earliest candle date from Coinbase, NOT from CoinMarketCap
    const cutoffDate = new Date("2025-01-01T00:00:00.000Z");

    const top20Coins = await prisma.topCoin.findMany({
      where: {
        coin: {
          symbol: { contains: "-" }, // Hanya pair valid
          OR: [
            { listingDate: { lt: cutoffDate } }, // Coins with historical data before cutoff
            { listingDate: null }, // New coins without listingDate yet (will be set after sync)
          ],
        },
      },
      include: {
        coin: true,
      },
      take: 20,
    });

    if (!top20Coins.length) {
      return {
        success: false,
        message: "Belum ada coin pair di DB. Jalankan /api/marketcap dulu.",
      };
    }

    // ✅ Fetch live data dari Coinbase untuk semua coin
    const top20WithCoinbaseVolume = [];

    for (const topCoin of top20Coins) {
      const liveData = await fetchTicker(topCoin.coin.symbol);

      if (liveData && liveData.price != null && liveData.volume != null) {
        const rawPrice = Number(liveData.price);
        const rawVolume = Number(liveData.volume);
        const rawOpen = Number(liveData.open || rawPrice);
        const rawMarketCap = topCoin.marketCap || 0;

        const change24h =
          rawOpen > 0
            ? Number((((rawPrice - rawOpen) / rawOpen) * 100).toFixed(2))
            : 0;

        const coinbaseVolume24h = rawVolume * rawPrice;

        top20WithCoinbaseVolume.push({
          rank: topCoin.coin.rank,
          name: topCoin.coin.name || topCoin.coin.symbol.split("-")[0],
          symbol: topCoin.coin.symbol,
          coinId: topCoin.coin.id,
          price: rawPrice,
          volume: rawVolume,
          marketCap: rawMarketCap,
          change24h,
          open: rawOpen,
          coinbaseVolume24h,
        });
      } else {
        console.warn(
          `⚠️ ${topCoin.coin.symbol}: Failed to fetch live data from Coinbase`
        );
      }
    }

    // ✅ Sort berdasarkan Market Cap (dari CMC)
    const sortedTop20 = top20WithCoinbaseVolume.sort((a, b) => {
      return b.marketCap - a.marketCap;
    });

    // STEP 4: Calculate summary dari 20 coin teratas
    const totalMarketCap = sortedTop20.reduce(
      (sum, coin) => sum + coin.marketCap,
      0
    );
    const totalVolume24h = sortedTop20.reduce(
      (sum, coin) => sum + coin.coinbaseVolume24h,
      0
    );

    const btcCoin = sortedTop20.find(
      (coin) => coin.symbol.startsWith("BTC-") || coin.symbol === "BTC"
    );
    const btcDominance =
      btcCoin && totalMarketCap > 0
        ? Number(((btcCoin.marketCap / totalMarketCap) * 100).toFixed(2))
        : 0;

    // Summary statistics berdasarkan 20 coin
    const activeCoins = sortedTop20.length;
    const gainers = sortedTop20.filter((coin) => coin.change24h > 0).length;
    const losers = sortedTop20.filter((coin) => coin.change24h < 0).length;

    // STEP 5: Build detail data untuk 20 coin
    const detailedData = [];

    for (const coinSummary of sortedTop20) {
      // Get last 10 candles for history chart
      const historyCandles = await prisma.candle.findMany({
        where: {
          coinId: coinSummary.coinId,
          timeframeId: timeframeRecord.id,
        },
        orderBy: { time: "desc" },
        take: 10,
      });

      // Fetch ticker untuk data high/low yang up-to-date
      const liveDetailData = await fetchTicker(coinSummary.symbol);

      const rawPrice = coinSummary.price;
      const rawVolume = coinSummary.volume;
      const rawOpen = coinSummary.open;
      const rawMarketCap = coinSummary.marketCap;
      const change24h = coinSummary.change24h;

      // Ambil high/low dari live data jika tersedia
      const rawHigh = liveDetailData
        ? Number(liveDetailData.high || rawPrice)
        : rawPrice;
      const rawLow = liveDetailData
        ? Number(liveDetailData.low || rawPrice)
        : rawPrice;

      const chartColor = rawPrice >= rawOpen ? "green" : "red";

      // Format history dengan desimal dinamis
      const history = historyCandles
        .reverse()
        .map((c) => formatPrice(Number(c.close)));

      // Ambil logo dari tabel Coin
      const coinData = await prisma.coin.findUnique({
        where: { symbol: coinSummary.symbol },
        select: { logo: true },
      });

      detailedData.push({
        rank: coinSummary.rank,
        name: coinSummary.name,
        symbol: coinSummary.symbol,
        logo: coinData?.logo || null,
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

    // Return 20 coin dengan summary yang konsisten
    return {
      success: true,
      total: detailedData.length,
      count: detailedData.length,
      summary: {
        totalMarketCap: Number(totalMarketCap.toFixed(2)),
        totalVolume24h: Number(totalVolume24h.toFixed(2)),
        btcDominance,
        activeCoins,
        gainers,
        losers,
      },
      data: detailedData,
    };
  } catch (e) {
    console.error("Live error:", e.message);
    return { success: false, message: e.message };
  }
}
