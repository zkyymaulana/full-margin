// src/services/marketcap.service.js
// Mencocokkan coin di DB dengan pair aktif di Coinbase dan menyimpan candle terakhirnya.
import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma.js";
import { toISO } from "../utils/time.js";

dotenv.config(); // pastikan env variabel terbaca di Node

// 🧩 Ambil konfigurasi langsung dari env
const COINBASE_API_URL =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam (1h timeframe)
const BASE_PRIORITY = ["USD", "USDT", "EUR", "CEN"];

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
 * 🔹 Ambil candle terakhir dari Coinbase (1h)
 * @param {string} symbol Contoh: "BTC-USD"
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
    return { time: toISO(time * 1000), open, high, low, close, volume };
  } catch (err) {
    console.error(`❌ Gagal fetch candle ${symbol}: ${err.message}`);
    return null;
  }
}

/**
 * 📊 Sinkronisasi top 100 coin yang punya pair aktif di Coinbase
 * - Ambil data dari tabel `TopCoin`
 * - Cocokkan dengan pair aktif di Coinbase
 * - Simpan ke tabel `Coin` + 1 candle terakhir
 */
export async function getExactMatchedPairs() {
  try {
    console.log("🚀 Sinkronisasi pair antara TopCoin dan Coinbase...");

    // Hitung coin yang sudah tersimpan
    const existingCount = await prisma.coin.count();
    if (existingCount >= 100) {
      console.log(
        "⏹️ Database sudah berisi 100 coin. Tidak perlu sinkron ulang."
      );
      return;
    }

    // Ambil data top 200 dari tabel TopCoin
    const topCoins = await prisma.topCoin.findMany({
      orderBy: { rank: "asc" },
      take: 200,
    });

    if (!topCoins.length) {
      console.warn(
        "⚠️ Tidak ada data di tabel TopCoin. Jalankan syncTopCoins() terlebih dahulu."
      );
      return;
    }

    // Ambil semua pair aktif dari Coinbase
    const coinbasePairs = new Set(await fetchCoinbasePairs());
    let totalSaved = existingCount;

    for (const coin of topCoins) {
      if (totalSaved >= 100) break;

      // 🔍 Cari pair terbaik berdasarkan prioritas BASE
      const pair = BASE_PRIORITY.map((base) => `${coin.symbol}-${base}`).find(
        (p) => coinbasePairs.has(p)
      );

      if (!pair) continue;

      // Cek apakah pair sudah ada di DB
      const exists = await prisma.coin.findUnique({ where: { symbol: pair } });
      if (exists) continue;

      // Ambil candle terakhir dari Coinbase
      const lastCandle = await fetchLastCandle(pair);
      if (!lastCandle) continue;

      // 💾 Simpan coin baru
      const savedCoin = await prisma.coin.create({
        data: { symbol: pair, name: coin.name },
      });

      // 💾 Simpan candle terakhir ke DB
      await prisma.candle.create({
        data: {
          symbol: pair,
          timeframe: "1h",
          time: BigInt(new Date(lastCandle.time).getTime()),
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
    console.error("❌ Gagal sinkronisasi pair:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
