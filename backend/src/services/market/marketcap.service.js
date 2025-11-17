// pairing & live marketcap summary
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { syncTopCoins } from "./cmcTopCoins.service.js";
import { fetchPairs, fetchTicker } from "./coinbase.service.js";

dotenv.config();

const BASES = ["USD", "USDT", "EUR", "USDC"];

/**
 * Ambil top 200 dari CMC → Pairing dengan Coinbase → Simpan top 100 ke DB
 */
export async function getMarketcapRealtime() {
  try {
    console.log("🚀 Syncing Top 200 dari CoinMarketCap...");
    const cmc = await syncTopCoins(200);
    if (!cmc.success) throw new Error("Gagal mengambil data dari CMC.");

    const pairs = await fetchPairs();
    if (pairs.size === 0) throw new Error("Tidak ada pair aktif di Coinbase.");

    const top = await prisma.topCoin.findMany({
      orderBy: { rank: "asc" },
      take: 200,
    });

    const matched = [];
    for (const coin of top) {
      if (matched.length >= 100) break;
      const pair = BASES.map((b) => `${coin.symbol}-${b}`).find((p) =>
        pairs.has(p)
      );
      if (!pair) continue;

      // Sertakan rank saat upsert
      await prisma.coin.upsert({
        where: { symbol: pair },
        update: {
          name: coin.name,
          rank: coin.rank,
        },
        create: {
          symbol: pair,
          name: coin.name,
          rank: coin.rank,
        },
      });

      console.log(`✅ ${pair}: rank ${coin.rank} - ${coin.name}`);

      matched.push({
        rank: coin.rank,
        name: coin.name,
        symbol: pair,
        // price: +coin.price.toFixed(4),
        // marketCap: Math.round(coin.marketCap),
      });
    }

    console.log(
      `✅ Pairing selesai (${matched.length} coin cocok dengan rank).`
    );
    return {
      success: true,
      total: matched.length,
      message: `Berhasil pairing ${matched.length} coin dengan rank dari CMC`,
      coins: matched,
    };
  } catch (e) {
    console.error("❌ Sync error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * ⚡ Ambil harga live + candle terakhir untuk coin teratas + history + summary
 * Data 100% dari Coinbase (price, volume, marketCap calculated from Coinbase data)
 */
export async function getMarketcapLive(limit = 20) {
  try {
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));

    // Ambil hanya coin teratas berdasarkan rank
    const coins = await prisma.coin.findMany({
      where: { rank: { not: null } },
      orderBy: { rank: "asc" },
      take,
    });

    if (!coins.length)
      return {
        success: false,
        message: "⚠️ Belum ada coin di DB. Jalankan /api/marketcap dulu.",
      };

    console.log(
      `⚡ Mengambil data live dari Coinbase untuk ${coins.length} coins...`
    );

    // Fetch LIVE data from Coinbase ticker untuk semua coins
    const data = [];
    let successCount = 0;
    let failedCount = 0;

    for (const coin of coins) {
      const liveData = await fetchTicker(coin.symbol);

      if (!liveData || !liveData.price || !liveData.volume) {
        console.warn(`⚠️ Data tidak lengkap untuk ${coin.symbol}, skip...`);
        failedCount++;
        continue; // Skip jika data tidak valid
      }

      // Get last 10 candles for history chart (oldest to newest)
      const historyCandles = await prisma.candle.findMany({
        where: { symbol: coin.symbol },
        orderBy: { time: "desc" },
        take: 10,
      });

      // Reverse to get oldest → newest, extract close prices
      const history = historyCandles
        .reverse()
        .map((c) => Number(c.close.toFixed(2)));

      // ✅ Calculate market cap from Coinbase data only
      const price = Number(liveData.price);
      const volume = Number(liveData.volume);
      const marketCap = Number((volume * price).toFixed(2));

      // ✅ Calculate change24h using Coinbase LIVE data
      const open = Number(liveData.open);
      const change24h =
        open > 0 ? Number((((price - open) / open) * 100).toFixed(2)) : 0;

      // ✅ Determine chart color based on price vs open
      const chartColor = price >= open ? "green" : "red";

      data.push({
        rank: coin.rank,
        name: coin.name || coin.symbol.split("-")[0],
        symbol: coin.symbol,
        price: Number(price.toFixed(2)),
        volume: Number(volume.toFixed(2)),
        marketCap, // Calculated from Coinbase volume * price
        open: Number(open.toFixed(2)),
        high: Number(liveData.high.toFixed(2)),
        low: Number(liveData.low.toFixed(2)),
        change24h,
        chartColor,
        history, // Historical data dari database untuk chart
      });

      successCount++;
    }

    if (data.length === 0) {
      return {
        success: false,
        message: "Tidak ada data valid dari Coinbase",
      };
    }

    // ✅ Calculate summary metrics from Coinbase data only
    const totalMarketCap = data.reduce((sum, coin) => sum + coin.marketCap, 0);
    const totalVolume24h = data.reduce((sum, coin) => sum + coin.volume, 0);

    // Find BTC for dominance calculation
    const btcCoin = data.find(
      (coin) => coin.symbol.startsWith("BTC-") || coin.symbol === "BTC"
    );
    const btcDominance =
      btcCoin && totalMarketCap > 0
        ? Number(((btcCoin.marketCap / totalMarketCap) * 100).toFixed(2))
        : 0;

    const activeCoins = data.length;
    const gainers = data.filter((coin) => coin.change24h > 0).length;
    const losers = data.filter((coin) => coin.change24h < 0).length;

    console.log(
      `✅ ${successCount} coins berhasil (${failedCount} gagal) - Data 100% dari Coinbase`
    );

    return {
      success: true,
      total: data.length,
      summary: {
        totalMarketCap: Number(totalMarketCap.toFixed(2)),
        totalVolume24h: Number(totalVolume24h.toFixed(2)),
        btcDominance,
        activeCoins,
        gainers,
        losers,
      },
      data,
    };
  } catch (e) {
    console.error("❌ Live error:", e.message);
    return { success: false, message: e.message };
  }
}
