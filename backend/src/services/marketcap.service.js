import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma.js";

dotenv.config();

const COINBASE_API_URL =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam (untuk candle)
const BASE_PRIORITY = ["USD", "USDT", "EUR", "CEN"];
const BATCH_SIZE = 10; // untuk batching fetch agar tidak overload
const LIVE_UPDATE_INTERVAL = 5000; // 5 detik untuk live update

// Track live updater status
let liveUpdaterInterval = null;
let isLiveUpdaterRunning = false;

/**
 * 🔹 Ambil semua pair aktif di Coinbase
 */
async function fetchCoinbasePairs() {
  try {
    const { data } = await axios.get(`${COINBASE_API_URL}/products`, {
      timeout: API_TIMEOUT,
    });

    return data
      .filter((p) => p.status === "online" && !p.trading_disabled)
      .map((p) => p.id.toUpperCase());
  } catch (err) {
    console.error(`❌ Gagal fetch pair Coinbase: ${err.message}`);
    return [];
  }
}

/**
 * 🔹 Ambil candle terakhir (1 jam terakhir) dari Coinbase
 */
async function fetchLastCandle(symbol) {
  try {
    const now = new Date();
    const end = now.toISOString();
    const start = new Date(
      now.getTime() - GRANULARITY_SECONDS * 1000
    ).toISOString();

    const { data } = await axios.get(
      `${COINBASE_API_URL}/products/${symbol}/candles`,
      {
        params: { start, end, granularity: GRANULARITY_SECONDS },
        timeout: API_TIMEOUT,
      }
    );

    if (!data?.length) return null;
    const [time, low, high, open, close, volume] = data[0];
    return { time: new Date(time * 1000), open, high, low, close, volume };
  } catch (err) {
    console.error(`❌ Gagal fetch candle ${symbol}: ${err.message}`);
    return null;
  }
}

/**
 * 🔹 Ambil harga live (ticker) dari Coinbase
 */
async function fetchLivePrice(symbol) {
  try {
    const { data } = await axios.get(
      `${COINBASE_API_URL}/products/${symbol}/ticker`,
      { timeout: API_TIMEOUT }
    );

    return {
      price: parseFloat(data.price),
      volume: parseFloat(data.volume || 0),
      time: new Date(data.time).getTime(),
    };
  } catch (err) {
    console.error(`❌ Gagal fetch harga live ${symbol}: ${err.message}`);
    return null;
  }
}

/**
 * 📊 Sinkronisasi TopCoin → Coin (hanya sekali)
 */
export async function getExactMatchedPairs() {
  try {
    console.log("🚀 Sinkronisasi pair antara TopCoin dan Coinbase...");
    const existingCount = await prisma.coin.count();
    if (existingCount >= 100) {
      console.log("✅ Sudah ada 100 coin di DB, lewati sinkronisasi.");
      return;
    }

    const topCoins = await prisma.topCoin.findMany({
      orderBy: { rank: "asc" },
      take: 200,
    });

    const coinbasePairs = new Set(await fetchCoinbasePairs());
    let totalSaved = existingCount;

    for (const coin of topCoins) {
      if (totalSaved >= 100) break;

      const pair = BASE_PRIORITY.map((base) => `${coin.symbol}-${base}`).find(
        (p) => coinbasePairs.has(p)
      );
      if (!pair) continue;

      const exists = await prisma.coin.findUnique({ where: { symbol: pair } });
      if (exists) continue;

      const lastCandle = await fetchLastCandle(pair);
      if (!lastCandle) continue;

      const savedCoin = await prisma.coin.create({
        data: { symbol: pair, name: coin.name },
      });

      await prisma.candle.create({
        data: {
          symbol: pair,
          timeframe: "1h",
          time: BigInt(lastCandle.time.getTime()),
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
          volume: lastCandle.volume,
          coinId: savedCoin.id,
        },
      });

      totalSaved++;
      console.log(`✅ [${totalSaved}/100] ${pair} tersimpan`);
    }

    console.log(`🎯 Total coin valid sekarang: ${totalSaved}`);
  } catch (err) {
    console.error("❌ Gagal sinkronisasi:", err.message);
  }
}

/**
 * 📊 Marketcap dari DB (non-realtime)
 */
export async function getMarketcapRealtime() {
  try {
    const coins = await prisma.coin.findMany({
      orderBy: { id: "asc" },
      take: 100,
      include: {
        candles: { orderBy: { time: "desc" }, take: 1 },
      },
    });

    if (!coins.length) {
      return {
        success: false,
        message: "⚠️ Tidak ada coin di database. Jalankan pairing dulu.",
      };
    }

    const cleanData = coins.map((coin) => ({
      ...coin,
      candles: coin.candles.map((c) => ({
        time: Number(c.time),
        close: c.close,
        volume: c.volume,
      })),
    }));

    return { success: true, total: cleanData.length, data: cleanData };
  } catch (err) {
    console.error("❌ Error getMarketcapRealtime:", err.message);
    return { success: false, message: err.message };
  }
}

/**
 * ⚡ Ambil data dari DB saja (ringan dan cepat)
 * - Tidak fetch live dari Coinbase untuk semua coin
 * - Hanya ambil candle terakhir dari database
 * - Background sync akan update data secara otomatis
 */
export async function getMarketcapLive() {
  console.log("⚡ Mengambil data terbaru dari database...");

  try {
    const coins = await prisma.coin.findMany({
      orderBy: { id: "asc" },
      take: 100,
      include: {
        candles: { orderBy: { time: "desc" }, take: 1 },
      },
    });

    if (!coins.length) {
      return {
        success: false,
        message: "⚠️ Coin belum ada di DB. Jalankan pairing terlebih dahulu.",
      };
    }

    const data = coins.map((coin) => {
      const candle = coin.candles?.[0]
        ? {
            time: Number(coin.candles[0].time),
            close: coin.candles[0].close,
            volume: coin.candles[0].volume,
          }
        : {
            time: Date.now(),
            close: null,
            volume: null,
          };

      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        candles: [candle],
      };
    });

    console.log(`✅ Data terbaru dari DB (${data.length} aset total)`);

    return {
      success: true,
      total: data.length,
      data: data,
    };
  } catch (err) {
    console.error("❌ Error getMarketcapLive:", err.message);
    return { success: false, message: err.message };
  }
}

/**
 * ⚡ Fetch live price untuk coin tertentu (untuk detail chart)
 * - Hanya digunakan saat user klik detail coin
 * - Trigger sinkronisasi data untuk coin spesifik
 */
export async function getCoinLiveDetail(symbol) {
  console.log(`⚡ Mengambil detail live untuk ${symbol}...`);

  try {
    // Fetch live price dari Coinbase
    const liveData = await fetchLivePrice(symbol);

    if (!liveData) {
      // Fallback ke data terakhir di DB
      const coin = await prisma.coin.findUnique({
        where: { symbol },
        include: {
          candles: { orderBy: { time: "desc" }, take: 1 },
        },
      });

      if (!coin?.candles?.[0]) {
        return {
          success: false,
          message: `Tidak ada data untuk ${symbol}`,
        };
      }

      return {
        success: true,
        data: {
          symbol,
          price: coin.candles[0].close,
          volume: coin.candles[0].volume,
          time: Number(coin.candles[0].time),
          source: "database",
        },
      };
    }

    return {
      success: true,
      data: {
        symbol,
        price: liveData.price,
        volume: liveData.volume,
        time: liveData.time,
        source: "live",
      },
    };
  } catch (err) {
    console.error(`❌ Error getCoinLiveDetail ${symbol}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * 🔄 Background live price updater - runs every 5 seconds
 * Updates latest candle data for all coins from Coinbase
 */
export async function startLivePriceUpdater() {
  if (isLiveUpdaterRunning) {
    console.log("⚠️ Live price updater already running");
    return;
  }

  console.log("🚀 Starting live price updater (every 5 seconds)...");
  isLiveUpdaterRunning = true;

  const updateLivePrices = async () => {
    try {
      const coins = await prisma.coin.findMany({
        orderBy: { id: "asc" },
        take: 100,
        select: { id: true, symbol: true },
      });

      if (!coins.length) {
        console.log("⚠️ No coins found for live update");
        return;
      }

      console.log(`🔄 Updating live prices for ${coins.length} coins...`);
      let successCount = 0;
      let errorCount = 0;

      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < coins.length; i += BATCH_SIZE) {
        const batch = coins.slice(i, i + BATCH_SIZE);

        const updatePromises = batch.map(async (coin) => {
          try {
            const livePrice = await fetchLivePrice(coin.symbol);

            if (!livePrice) {
              return false;
            }

            // Update or create latest candle with live price
            const currentHour = new Date();
            currentHour.setMinutes(0, 0, 0);
            const hourTimestamp = BigInt(currentHour.getTime());

            await prisma.candle.upsert({
              where: {
                symbol_timeframe_time: {
                  symbol: coin.symbol,
                  timeframe: "1h",
                  time: hourTimestamp,
                },
              },
              update: {
                close: livePrice.price,
                volume: livePrice.volume,
                high: { increment: 0 }, // Keep existing high if higher
                low: livePrice.price, // Update low if this price is lower
              },
              create: {
                symbol: coin.symbol,
                timeframe: "1h",
                time: hourTimestamp,
                open: livePrice.price,
                high: livePrice.price,
                low: livePrice.price,
                close: livePrice.price,
                volume: livePrice.volume,
                coinId: coin.id,
              },
            });

            return true;
          } catch (error) {
            console.error(`❌ Failed to update ${coin.symbol}:`, error.message);
            return false;
          }
        });

        const results = await Promise.allSettled(updatePromises);
        const batchSuccess = results.filter(
          (r) => r.status === "fulfilled" && r.value === true
        ).length;

        successCount += batchSuccess;
        errorCount += batch.length - batchSuccess;

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < coins.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `✅ Live update completed: ${successCount} success, ${errorCount} errors`
      );
    } catch (error) {
      console.error("❌ Live price updater error:", error.message);
    }
  };

  // Run immediately
  await updateLivePrices();

  // Then run every 5 seconds
  liveUpdaterInterval = setInterval(updateLivePrices, LIVE_UPDATE_INTERVAL);

  console.log("✅ Live price updater started successfully");
}

/**
 * 🛑 Stop live price updater
 */
export function stopLivePriceUpdater() {
  if (liveUpdaterInterval) {
    clearInterval(liveUpdaterInterval);
    liveUpdaterInterval = null;
    isLiveUpdaterRunning = false;
    console.log("🛑 Live price updater stopped");
  }
}

/**
 * 📊 Get live updater status
 */
export function getLiveUpdaterStatus() {
  return {
    isRunning: isLiveUpdaterRunning,
    interval: LIVE_UPDATE_INTERVAL,
  };
}
