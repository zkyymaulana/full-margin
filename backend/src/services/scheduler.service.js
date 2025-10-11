import { prisma } from "../lib/prisma.js";
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { getLastSavedCandleTime, saveCandles } from "./candle.service.js";
import {
  getLastClosedHourlyCandleEndTime,
  fmt,
  HOUR_MS,
} from "../utils/time.js";

const START_EPOCH_MS = Date.parse("2020-10-01T00:00:00Z"); // mulai dari Oktober 2020
const ONE_MINUTE_MS = 60 * 1000;
const MIN_EXPECTED_CANDLES = 1000; // Minimum expected candles untuk validasi

// Track active schedulers to prevent duplicates
const activeSchedulers = new Map();

/**
 * 🔍 Cek apakah data candle coin sudah lengkap dan valid
 */
async function validateCoinData(symbol) {
  try {
    const count = await prisma.candle.count({
      where: { coin: { symbol } },
    });

    if (count < MIN_EXPECTED_CANDLES) {
      return {
        isValid: false,
        reason: `Only ${count} candles (expected at least ${MIN_EXPECTED_CANDLES})`,
        needsFullFetch: true,
      };
    }

    // Cek apakah ada gap data yang signifikan
    const firstCandle = await prisma.candle.findFirst({
      where: { coin: { symbol } },
      orderBy: { time: "asc" },
    });

    const lastCandle = await prisma.candle.findFirst({
      where: { coin: { symbol } },
      orderBy: { time: "desc" },
    });

    if (!firstCandle || !lastCandle) {
      return {
        isValid: false,
        reason: "No candles found",
        needsFullFetch: true,
      };
    }

    const firstTime = Number(firstCandle.time);
    const lastTime = Number(lastCandle.time);
    const timeDiff = lastTime - firstTime;
    const expectedCandles = Math.floor(timeDiff / (60 * 60 * 1000)); // hourly candles

    // Jika jumlah candle kurang dari 80% expected, fetch ulang
    if (count < expectedCandles * 0.8) {
      return {
        isValid: false,
        reason: `Data gap detected: ${count} vs expected ~${expectedCandles}`,
        needsFullFetch: true,
      };
    }

    // Cek apakah data terlalu lama (lebih dari 2 jam)
    const now = Date.now();
    const lastCandleAge = now - lastTime;
    if (lastCandleAge > 2 * HOUR_MS) {
      return {
        isValid: true,
        reason: "Data complete but needs update",
        needsFullFetch: false,
      };
    }

    return {
      isValid: true,
      reason: "Data is complete and up-to-date",
      needsFullFetch: false,
    };
  } catch (error) {
    console.error(`❌ Error validating ${symbol}:`, error.message);
    return {
      isValid: false,
      reason: `Validation error: ${error.message}`,
      needsFullFetch: true,
    };
  }
}

/**
 * 🚀 Fetch historical data dengan retry dan error handling
 */
async function fetchHistoricalWithRetry(
  symbol,
  startTime,
  endTime,
  maxRetries = 3
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `🔄 ${symbol}: Attempt ${attempt}/${maxRetries} fetching from ${fmt(startTime)} to ${fmt(endTime)}`
      );

      const candles = await fetchHistoricalCandles(symbol, startTime, endTime);

      if (candles && candles.length > 0) {
        console.log(
          `✅ ${symbol}: Successfully fetched ${candles.length} candles on attempt ${attempt}`
        );
        return candles;
      }

      console.warn(`⚠️ ${symbol}: No candles returned on attempt ${attempt}`);
    } catch (error) {
      lastError = error;
      console.error(`❌ ${symbol}: Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        console.log(`⏳ ${symbol}: Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch after ${maxRetries} attempts`);
}

/**
 * 🚀 Mulai scheduler untuk semua coin yang tersimpan di DB
 */
export async function startAllSchedulers() {
  console.log("🚀 Memulai scheduler untuk semua coin...");

  try {
    // Test database connection first
    await prisma.$connect();
    console.log("✅ Database connection established");

    const coins = await prisma.coin.findMany({
      select: { id: true, symbol: true },
    });

    if (!coins.length) {
      console.warn(
        "⚠️ Tidak ada coin di database. Jalankan pairing terlebih dahulu."
      );
      return;
    }

    console.log(
      `📋 Found ${coins.length} coins in database:`,
      coins.map((c) => c.symbol).join(", ")
    );

    // Validasi dan fetch historical data untuk semua coin terlebih dahulu
    console.log("🔍 Validating historical data for all coins...");

    for (const coin of coins) {
      try {
        console.log(`🔍 Checking ${coin.symbol}...`);

        const validation = await validateCoinData(coin.symbol);
        console.log(`📊 ${coin.symbol}: ${validation.reason}`);

        if (validation.needsFullFetch) {
          console.log(
            `🔄 ${coin.symbol}: Fetching complete historical data...`
          );

          // Delete existing incomplete data
          const deleteResult = await prisma.candle.deleteMany({
            where: { coin: { symbol: coin.symbol } },
          });
          console.log(
            `🗑️ ${coin.symbol}: Deleted ${deleteResult.count} old candles`
          );

          // Fetch complete historical data
          const lastClosedUTC = getLastClosedHourlyCandleEndTime();
          const candles = await fetchHistoricalWithRetry(
            coin.symbol,
            START_EPOCH_MS,
            lastClosedUTC
          );

          if (candles && candles.length > 0) {
            console.log(
              `📈 ${coin.symbol}: Fetched ${candles.length} historical candles`
            );

            const res = await saveCandles(coin.symbol, coin.id, candles);
            if (res.success) {
              console.log(
                `✅ ${coin.symbol}: ${res.count}/${candles.length} candles saved successfully`
              );
            } else {
              console.error(
                `❌ ${coin.symbol}: Failed to save candles: ${res.message}`
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `❌ ${coin.symbol}: Failed to validate/fetch historical data:`,
          error.message
        );
        // Continue with other coins even if one fails
      }
    }

    console.log("✅ Historical data validation/fetch completed for all coins");

    // Sekarang mulai scheduler normal untuk semua coin
    for (const coin of coins) {
      await startCandleAutoUpdater(coin.id, coin.symbol);
    }

    console.log(`✅ Scheduler aktif untuk ${coins.length} coin.`);
  } catch (error) {
    console.error("❌ Failed to start schedulers:", error.message);
    throw error;
  }
}

/**
 * 🔁 Scheduler: jalan tiap 1 menit
 * Hanya untuk update candle baru, bukan untuk fetch historical lengkap
 */
export async function startCandleAutoUpdater(coinId, symbol) {
  // Prevent duplicate schedulers for the same symbol
  if (activeSchedulers.has(symbol)) {
    console.log(`⚠️ Scheduler untuk ${symbol} sudah berjalan, skip...`);
    return;
  }

  console.log(`🕐 Scheduler dimulai untuk ${symbol} (coinId: ${coinId})`);
  activeSchedulers.set(symbol, true);

  const loop = async () => {
    try {
      console.log(`🔄 Processing ${symbol}...`);

      // Verify coin exists in database
      const coin = await prisma.coin.findUnique({
        where: { id: coinId },
        select: { id: true, symbol: true },
      });

      if (!coin) {
        console.error(`❌ Coin with id ${coinId} not found in database`);
        return;
      }

      // Ambil waktu terakhir yang tersimpan di DB (biasanya BigInt)
      let lastSaved = await getLastSavedCandleTime(symbol);
      const lastClosedUTC = getLastClosedHourlyCandleEndTime(); // number

      console.log(
        `📊 ${symbol}: lastSaved=${lastSaved ? fmt(Number(lastSaved)) : "null"}, lastClosed=${fmt(lastClosedUTC)}`
      );

      // ✅ pastikan semuanya number
      lastSaved = lastSaved ? Number(lastSaved) : null;

      // Jika belum ada data sama sekali (ini seharusnya sudah tidak terjadi karena sudah di-handle di startAllSchedulers)
      if (!lastSaved) {
        console.warn(
          `⚠️ ${symbol}: No data found in scheduler loop - this should not happen after validation`
        );
        return;
      }

      // Hanya ambil data baru sejak candle terakhir
      const start = Number(lastSaved) + Number(HOUR_MS);
      const end = Number(lastClosedUTC);

      if (start >= end) {
        console.log(`⏸️ ${symbol} sudah up-to-date. (${fmt(start)})`);
        return;
      }

      console.log(
        `📥 Update ${symbol}: ambil candle baru dari ${fmt(start)} → ${fmt(end)}`
      );

      const candles = await fetchHistoricalCandles(symbol, start, end);

      console.log(`📈 ${symbol}: Fetched ${candles.length} new candles`);

      if (!candles.length) {
        console.log(`⏸️ Tidak ada candle baru untuk ${symbol}.`);
        return;
      }

      const res = await saveCandles(symbol, coinId, candles);
      if (res.success) {
        console.log(
          `✅ ${symbol}: ${res.count}/${candles.length} candle baru disimpan. Last: ${fmt(
            candles.at(-1).time * 1000
          )}`
        );
      } else {
        console.error(
          `❌ ${symbol}: Gagal menyimpan candle baru: ${res.message}`
        );
      }
    } catch (err) {
      console.error(`❌ Scheduler error (${symbol}):`, err.message);
      console.error(err.stack);
    }
  };

  // Jalankan langsung pertama kali
  await loop();

  // Jalankan tiap 1 menit
  const intervalId = setInterval(loop, ONE_MINUTE_MS);

  // Store interval ID for cleanup if needed
  activeSchedulers.set(symbol, intervalId);
}

/**
 * 🛑 Stop scheduler untuk symbol tertentu
 */
export function stopScheduler(symbol) {
  const intervalId = activeSchedulers.get(symbol);
  if (intervalId && typeof intervalId !== "boolean") {
    clearInterval(intervalId);
    activeSchedulers.delete(symbol);
    console.log(`🛑 Scheduler untuk ${symbol} dihentikan`);
  }
}

/**
 * 🛑 Stop semua scheduler
 */
export function stopAllSchedulers() {
  for (const [symbol, intervalId] of activeSchedulers.entries()) {
    if (typeof intervalId !== "boolean") {
      clearInterval(intervalId);
    }
  }
  activeSchedulers.clear();
  console.log("🛑 Semua scheduler dihentikan");
}
