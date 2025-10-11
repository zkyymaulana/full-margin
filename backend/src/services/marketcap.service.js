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
 * ⚡ Ambil data live berdasarkan tabel Coin
 * - Urutan tetap (rank tetap)
 * - Selalu 100 data
 * - Jika fetch gagal → pakai harga terakhir di DB
 */
export async function getMarketcapLive() {
  console.log("⚡ Mengambil harga live berdasarkan tabel Coin...");

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

    const updatedData = [];

    for (let i = 0; i < coins.length; i += BATCH_SIZE) {
      const batch = coins.slice(i, i + BATCH_SIZE);

      const responses = await Promise.allSettled(
        batch.map(async (coin) => {
          const live = await fetchLivePrice(coin.symbol);

          const candle = live
            ? {
                time: live.time,
                close: live.price,
                volume: live.volume,
              }
            : coin.candles?.[0]
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
        })
      );

      updatedData.push(
        ...responses.filter((r) => r.status === "fulfilled").map((r) => r.value)
      );

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`✅ Live data diperbarui (${updatedData.length} aset total)`);

    return {
      success: true,
      total: updatedData.length,
      data: updatedData,
    };
  } catch (err) {
    console.error("❌ Error getMarketcapLive:", err.message);
    return { success: false, message: err.message };
  }
}
