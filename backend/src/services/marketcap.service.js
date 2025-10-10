import axios from "axios";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const COINBASE_API =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam

const BASE_PRIORITY = ["USD", "USDT", "EUR", "CEN"];

/**
 * 🧩 Helper: Konversi BigInt agar bisa diserialisasi ke JSON
 */
function convertBigIntToNumber(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

/**
 * 🔹 Ambil semua pair aktif di Coinbase
 */
async function fetchCoinbasePairs() {
  const { data } = await axios.get(`${COINBASE_API}/products`, {
    timeout: API_TIMEOUT,
  });
  return data
    .filter((p) => p.status === "online" && !p.trading_disabled)
    .map((p) => p.id.toUpperCase());
}

/**
 * 🔹 Ambil candle terakhir 1 jam terakhir dari Coinbase
 */
async function fetchLastCandle(symbol) {
  try {
    const now = new Date();
    const end = now.toISOString();
    const start = new Date(
      now.getTime() - GRANULARITY_SECONDS * 1000
    ).toISOString();

    const { data } = await axios.get(
      `${COINBASE_API}/products/${symbol}/candles`,
      {
        params: { start, end, granularity: GRANULARITY_SECONDS },
        timeout: API_TIMEOUT,
      }
    );

    if (!data?.length) return null;
    const [time, low, high, open, close, volume] = data[0];
    return {
      time: new Date(time * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    };
  } catch (err) {
    console.error(`❌ Gagal fetch candle untuk ${symbol}: ${err.message}`);
    return null;
  }
}

/**
 * 🔹 Sinkronkan coin dari tabel TopCoin
 *    - Hanya simpan coin yang punya pair aktif di Coinbase
 *    - Maksimum total 100 coin di database
 *    - Jika sudah penuh, kirim daftar isi DB sebagai respons
 */
export async function getExactMatchedPairs() {
  try {
    console.log("🚀 Mengecek data TopCoin di database...");

    const existingCount = await prisma.coin.count();
    console.log(`📦 Jumlah coin saat ini di DB: ${existingCount}`);

    // ✅ Jika sudah penuh, tampilkan isi DB berdasarkan ranking CMC
    if (existingCount >= 100) {
      console.log(
        "⏹️ Sudah ada 100 coin di database. Pairing baru dihentikan."
      );

      const [existingCoins, topCoins] = await Promise.all([
        prisma.coin.findMany({
          include: {
            candles: {
              orderBy: { time: "desc" },
              take: 1,
            },
          },
        }),
        prisma.topCoin.findMany({
          orderBy: { rank: "asc" },
          take: 200,
        }),
      ]);

      // 🧩 Urutkan sesuai rank di CoinMarketCap
      const sorted = topCoins
        .map((top) => {
          const coin = existingCoins.find((c) =>
            c.symbol.startsWith(`${top.symbol}-`)
          );
          if (!coin) return null;
          return { ...coin, rank: top.rank };
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank);

      const cleanData = convertBigIntToNumber(sorted);

      return {
        success: true,
        message: "Database sudah penuh (100 coin).",
        total: cleanData.length,
        data: cleanData,
      };
    }

    // 🔹 Ambil data dari TopCoin
    const topCoins = await prisma.topCoin.findMany({
      orderBy: { rank: "asc" },
      take: 200,
    });

    if (!topCoins.length) {
      console.warn(
        "⚠️ Tidak ada data di tabel TopCoin. Jalankan syncTopCoins() terlebih dahulu."
      );
      return { success: false, message: "No data in TopCoin" };
    }

    console.log(
      `📊 Ditemukan ${topCoins.length} aset dari TopCoin. Mengecek pair di Coinbase...`
    );
    const coinbasePairs = await fetchCoinbasePairs();
    const cbSet = new Set(coinbasePairs);
    const matched = [];
    let totalSaved = existingCount;

    for (const coin of topCoins) {
      if (totalSaved >= 100) break;

      // 🔍 Cari pair terbaik
      let pair = null;
      for (const base of BASE_PRIORITY) {
        const candidate = `${coin.symbol}-${base}`;
        if (cbSet.has(candidate)) {
          pair = candidate;
          break;
        }
      }

      if (!pair) {
        console.log(`⚠️ Tidak ada pair untuk ${coin.symbol}, dilewati`);
        continue;
      }

      // 💡 Cek apakah pair sudah ada
      const exists = await prisma.coin.findUnique({
        where: { symbol: pair },
      });
      if (exists) {
        console.log(`⏩ Pair ${pair} sudah ada di database, dilewati`);
        continue;
      }

      // 🔹 Ambil candle terakhir
      const lastCandle = await fetchLastCandle(pair);
      if (!lastCandle) {
        console.log(`⚠️ Tidak ada candle untuk ${pair}, dilewati`);
        continue;
      }

      // 💾 Simpan coin baru
      const savedCoin = await prisma.coin.create({
        data: {
          symbol: pair,
          name: coin.name,
        },
      });

      // 💾 Simpan candle terakhir
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

      matched.push({ ...coin, pair, lastCandle });
      totalSaved++;
      console.log(`✅ [${totalSaved}/100] Disimpan: ${pair}`);
    }

    // 🔹 Ambil hasil akhir dan urutkan berdasarkan rank CMC
    const [finalCoins, updatedTopCoins] = await Promise.all([
      prisma.coin.findMany({
        include: {
          candles: {
            orderBy: { time: "desc" },
            take: 1,
          },
        },
      }),
      prisma.topCoin.findMany({
        orderBy: { rank: "asc" },
        take: 200,
      }),
    ]);

    const sortedFinal = updatedTopCoins
      .map((top) => {
        const coin = finalCoins.find((c) =>
          c.symbol.startsWith(`${top.symbol}-`)
        );
        if (!coin) return null;
        return { ...coin, rank: top.rank };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank);

    const cleanData = convertBigIntToNumber(sortedFinal);

    console.log(
      `🎯 Total coin valid di database sekarang: ${cleanData.length}`
    );

    return {
      success: true,
      total: cleanData.length,
      data: cleanData,
    };
  } catch (err) {
    console.error("❌ Error:", err.message);
    return {
      success: false,
      message: "Gagal mengambil data marketcap",
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
}
