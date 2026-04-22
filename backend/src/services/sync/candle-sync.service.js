import { prisma } from "../../lib/prisma.js";
import {
  fetchHistoricalCandles,
  findEarliestCoinbaseCandleTime,
} from "../coinbase/coinbase.service.js";
import { calculateAndSaveIndicators } from "../indicators/indicator.service.js";
import {
  cleanCandleData,
  removeDuplicateCandles,
  fillMissingCandles,
} from "../../utils/dataCleaner.js";

// Cache untuk tracking last update time per symbol
const lastUpdateCache = new Map();
const parsedSyncConcurrency = Number.parseInt(
  process.env.SYNC_CONCURRENCY || "2",
  10,
);
const SYNC_CONCURRENCY = Number.isFinite(parsedSyncConcurrency)
  ? Math.max(1, parsedSyncConcurrency)
  : 2;
// Jumlah aset final yang diproses/sinkron ke DB.
const TARGET_ASSET_LIMIT = Number(process.env.TARGET_ASSET_LIMIT || "10");
// Buffer kandidat dari ranking teratas sebelum dipotong ke target final.
const TARGET_ASSET_BUFFER_LIMIT = Number(
  process.env.TARGET_ASSET_BUFFER_LIMIT || "20",
);
const LISTING_FETCH_CUTOFF_DATE = new Date("2025-01-01T00:00:00.000Z");
const STABLECOIN_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "BUSD",
  "TUSD",
  "USDP",
  "GUSD",
  "USDE",
  "FDUSD",
  "PYUSD",
  "USDD",
  "FRAX",
  "EURC",
]);
const earliestCoinbaseListingCache = new Map();

function isStablecoinPair(symbol = "") {
  const normalized = String(symbol).toUpperCase();
  for (const stable of STABLECOIN_SYMBOLS) {
    if (normalized.startsWith(`${stable}-`)) return true;
  }
  return false;
}

// Kriteria aset yang boleh difetch historis sesuai metodologi skripsi.
function isEligibleForHistoricalFetch(coin, symbol) {
  if (!coin) return false;
  if (!String(symbol || "").includes("-")) return false;
  if (isStablecoinPair(symbol)) return false;
  if (coin.rank == null) return false;
  if (!coin.listingDate) return false;
  if (coin.listingDate >= LISTING_FETCH_CUTOFF_DATE) return false;
  return true;
}

async function resolveEarliestCoinbaseListingDate(symbol) {
  if (earliestCoinbaseListingCache.has(symbol)) {
    return earliestCoinbaseListingCache.get(symbol);
  }

  const earliestTime = await findEarliestCoinbaseCandleTime(symbol);
  const listingDate = earliestTime ? new Date(earliestTime) : null;
  earliestCoinbaseListingCache.set(symbol, listingDate);
  return listingDate;
}

// Pastikan listing date tersimpan berdasarkan data candle Coinbase, bukan asumsi eksternal.
async function syncCoinListingDateFromCoinbase(coinId, symbol) {
  const listingDate = await resolveEarliestCoinbaseListingDate(symbol);

  if (!listingDate) {
    return null;
  }

  await prisma.coin.update({
    where: { id: coinId },
    data: { listingDate },
  });

  return listingDate;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }).map(
    async () => {
      while (true) {
        const index = currentIndex;
        currentIndex += 1;
        if (index >= items.length) break;

        try {
          const value = await worker(items[index], index);
          results[index] = { status: "fulfilled", value };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    },
  );

  await Promise.all(workers);
  return results;
}

/**
 * Update listingDate for a coin based on earliest candle available in Coinbase
 * This should be called after historical data sync to set accurate listing dates
 */
// Perbarui listing date satu simbol berdasarkan candle paling awal di database.
export async function updateListingDateFromCandles(symbol) {
  try {
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true, listingDate: true },
    });

    if (!coin) {
      console.warn(`⚠️ ${symbol}: Coin not found`);
      return null;
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe: "1h" },
      select: { id: true },
    });

    if (!timeframeRecord) {
      console.error('Timeframe "1h" not found');
      return null;
    }

    // Get earliest candle for this coin
    const earliestCandle = await prisma.candle.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
      orderBy: { time: "asc" },
      select: { time: true },
    });

    if (!earliestCandle) {
      console.warn(`⚠️ ${symbol}: No candles found, cannot set listingDate`);
      return null;
    }

    // Convert BigInt timestamp to Date
    const listingDate = new Date(Number(earliestCandle.time));

    // Only update if listingDate is null or different
    if (
      !coin.listingDate ||
      coin.listingDate.getTime() !== listingDate.getTime()
    ) {
      await prisma.coin.update({
        where: { symbol },
        data: { listingDate },
      });

      console.log(
        `📅 ${symbol}: listingDate set to ${listingDate.toISOString().split("T")[0]}`,
      );
    }

    return listingDate;
  } catch (error) {
    console.error(
      `❌ ${symbol}: Failed to update listingDate -`,
      error.message,
    );
    return null;
  }
}

/**
 * Update listing dates for all coins that have candles but no listingDate
 * This is useful for bulk updates after initial sync
 */
// Perbarui listing date untuk semua coin yang relevan secara massal.
export async function updateAllListingDates() {
  console.log(`📅 Updating listing dates for all coins...`);

  try {
    // Get all coins with pairs (contains "-")
    const coins = await prisma.coin.findMany({
      where: {
        symbol: { contains: "-" },
        rank: { not: null },
      },
      select: { symbol: true, listingDate: true },
      orderBy: { rank: "asc" },
    });

    if (coins.length === 0) {
      console.log(`⚠️ No coins found to update`);
      return { updated: 0, skipped: 0, failed: 0 };
    }

    const results = {
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const coin of coins) {
      try {
        const result = await updateListingDateFromCandles(coin.symbol);

        if (result) {
          results.updated++;
        } else if (coin.listingDate) {
          results.skipped++;
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error(`❌ ${coin.symbol}: ${error.message}`);
        results.failed++;
      }
    }

    console.log(`\n📊 Listing Date Update Summary:`);
    console.log(`   Updated: ${results.updated}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    return results;
  } catch (error) {
    console.error(`❌ Failed to update listing dates:`, error.message);
    throw error;
  }
}

// Sinkronisasi candle terbaru untuk kumpulan simbol.
export async function syncLatestCandles(symbols = []) {
  console.log(`🕐 Starting candle sync for ${symbols.length} symbols...`);
  console.log(`⚙️ Sync concurrency: ${SYNC_CONCURRENCY}`);
  const start = Date.now();

  try {
    const results = await runWithConcurrency(
      symbols,
      SYNC_CONCURRENCY,
      (symbol) => syncSymbolCandles(symbol),
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `Candle sync completed: ${successful} success, ${failed} failed (${Date.now() - start}ms)`,
    );
    return { successful, failed, duration: Date.now() - start };
  } catch (error) {
    console.error(`❌ Candle sync error:`, error.message);
    throw error;
  }
}

async function syncSymbolCandles(symbol) {
  try {
    // Get coin and timeframe IDs
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true, rank: true, listingDate: true },
    });

    if (!isEligibleForHistoricalFetch(coin, symbol)) {
      console.log(
        `⏭️ ${symbol}: Skip candle sync (tidak memenuhi kriteria aset historis)`,
      );
      return { symbol, newCandles: 0 };
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe: "1h" },
      select: { id: true },
    });

    if (!timeframeRecord) {
      throw new Error('Timeframe "1h" not found in database');
    }

    // Get last candle time from database
    const lastCandle = await prisma.candle.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
      orderBy: { time: "desc" },
    });

    if (!lastCandle) {
      const coinbaseListingDate = await syncCoinListingDateFromCoinbase(
        coin.id,
        symbol,
      );

      if (
        !coinbaseListingDate ||
        coinbaseListingDate >= LISTING_FETCH_CUTOFF_DATE
      ) {
        console.log(
          `⏭️ ${symbol}: Skip candle sync (listing Coinbase ${coinbaseListingDate ? coinbaseListingDate.toISOString().split("T")[0] : "tidak ditemukan"} tidak memenuhi cutoff)`,
        );
        return { symbol, newCandles: 0 };
      }
    }

    // Calculate start time for fetch (last candle + 1 hour or 7 days ago)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    let startTime;
    if (lastCandle) {
      // Handle BigInt timestamp properly
      const lastCandleTime =
        lastCandle.time instanceof Date
          ? lastCandle.time.getTime()
          : Number(lastCandle.time);
      startTime = lastCandleTime + oneHour;
    } else {
      startTime = now - sevenDays; // Get last 7 days if no data
    }

    // Don't fetch if we're already up to date
    const currentHour = Math.floor(now / oneHour) * oneHour;
    if (startTime >= currentHour) {
      console.log(`⏭️ ${symbol}: Already up to date`);
      return { symbol, newCandles: 0 };
    }

    // Fetch new candles from Coinbase
    const newCandles = await fetchHistoricalCandles(symbol, startTime, now);

    if (newCandles.length === 0) {
      console.log(`📭 ${symbol}: No new candles`);
      return { symbol, newCandles: 0 };
    }

    // Filter only complete hourly candles (exclude current incomplete hour)
    const completeCandles = newCandles.filter((candle) => {
      const candleHour = Math.floor(candle.time / oneHour) * oneHour;
      return candleHour < currentHour;
    });

    if (completeCandles.length === 0) {
      console.log(`⏳ ${symbol}: No complete candles to save`);
      return { symbol, newCandles: 0 };
    }

    // Rapikan data lalu isi gap waktu agar deret waktu tetap konsisten.
    // Tambahkan candle terakhir dari DB sebagai anchor agar gap tepat di batas
    // antara data lama (DB) dan data baru (API) tetap ikut terisi.
    const bridgeInput = lastCandle
      ? [
          {
            time: Number(lastCandle.time),
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
            volume: lastCandle.volume,
          },
          ...completeCandles,
        ]
      : completeCandles;

    const normalizedCandles = cleanCandleData(bridgeInput);
    const uniqueCandles = removeDuplicateCandles(normalizedCandles);
    const candlesWithForwardFill = fillMissingCandles(uniqueCandles, oneHour);

    // Jangan simpan ulang candle anchor lama dari DB.
    const candlesForSave = lastCandle
      ? candlesWithForwardFill.filter((c) => c.time > Number(lastCandle.time))
      : candlesWithForwardFill;

    if (!candlesForSave.length) {
      console.log(`⏭️ ${symbol}: No new candles after bridge normalization`);
      return { symbol, newCandles: 0 };
    }

    // Prepare data for database insert
    const candleData = candlesForSave.map((candle) => ({
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
      time: BigInt(Math.floor(candle.time)),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    // Batch insert with upsert to handle duplicates
    await prisma.candle.createMany({
      data: candleData,
      skipDuplicates: true,
    });

    // AUTOMATICALLY CALCULATE INDICATORS AFTER SAVING CANDLES
    await calculateAndSaveIndicators(symbol, "1h");

    // Update cache
    lastUpdateCache.set(symbol, now);

    console.log(`💾 ${symbol}: Saved ${candleData.length} new candles`);
    return { symbol, newCandles: candleData.length };
  } catch (error) {
    console.error(`❌ ${symbol}: Sync failed -`, error.message);
    throw error;
  }
}

// Ambil daftar simbol aktif yang memenuhi kriteria analisis.
export async function getActiveSymbols() {
  try {
    if (!prisma) {
      console.error("❌ Prisma client not available");
      return [];
    }

    // Filter: Hanya coin dengan listing date sebelum 2025-01-01
    const cutoffDate = new Date("2025-01-01T00:00:00.000Z");
    const stablecoinPrefixFilters = Array.from(STABLECOIN_SYMBOLS).map(
      (symbol) => ({ symbol: { startsWith: `${symbol}-` } }),
    );

    const topCoins = await prisma.topCoin.findMany({
      where: {
        coin: {
          rank: { not: null },
          symbol: { contains: "-" }, // Hanya pair valid
          listingDate: { lt: cutoffDate }, // HANYA coin yang listing sebelum 2025-01-01
          NOT: {
            OR: stablecoinPrefixFilters,
          },
        },
      },
      orderBy: { coin: { rank: "asc" } },
      select: { coin: { select: { symbol: true } } },
      take: TARGET_ASSET_BUFFER_LIMIT,
    });

    // Ambil simbol valid dari buffer, lalu potong ke target final (10 aset).
    const result = topCoins
      .map((item) => item.coin?.symbol)
      .filter(Boolean)
      .slice(0, TARGET_ASSET_LIMIT);

    if (result.length === 0) {
      console.warn("⚠️ No symbols found in database. Please run sync first.");
      return [];
    }

    console.log(
      `Found ${result.length} active symbols from database (buffer ${TARGET_ASSET_BUFFER_LIMIT}, listed before 2025-01-01)`,
    );
    return result;
  } catch (error) {
    console.error("❌ Failed to get active symbols:", error.message);
    return [];
  }
}

// Tampilkan status cache sinkronisasi candle di memori.
export function getCacheStatus() {
  return {
    totalSymbols: lastUpdateCache.size,
    lastUpdates: Object.fromEntries(lastUpdateCache),
  };
}

// Sinkronisasi data historis candle untuk simbol yang dipilih.
export async function syncHistoricalData(
  symbols = [],
  startDate = "2020-01-01",
) {
  console.log(`📚 Starting FAST historical data sync from ${startDate}...`);
  console.log(`📊 Processing ${symbols.length} symbols...`);

  const targetStartTime = new Date(startDate).getTime();
  const currentTime = Date.now();
  const totalDuration = Date.now();

  const results = {
    successful: 0,
    failed: 0,
    totalCandles: 0,
    skipped: 0,
    errors: [],
  };

  // Get timeframe ID once
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe: "1h" },
    select: { id: true },
  });

  if (!timeframeRecord) {
    throw new Error('Timeframe "1h" not found in database');
  }

  // Process symbols one by one to avoid overwhelming the API
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    console.log(`\n[${i + 1}/${symbols.length}] ${symbol}...`);

    try {
      // Get coinId from Coin table
      const coin = await prisma.coin.findUnique({
        where: { symbol },
        select: { id: true, rank: true, listingDate: true },
      });

      if (!isEligibleForHistoricalFetch(coin, symbol)) {
        console.log(
          `⏭️ ${symbol}: Skip historical sync (tidak memenuhi kriteria aset historis)`,
        );
        results.skipped++;
        continue;
      }

      // Quick check: Get ONLY newest candle time
      const newestCandle = await prisma.candle.findFirst({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
        orderBy: { time: "desc" },
        select: { time: true },
      });

      const oneHour = 60 * 60 * 1000;
      const currentHour = Math.floor(currentTime / oneHour) * oneHour;
      let fetchStartTime;
      let fetchEndTime = currentTime;

      if (!newestCandle) {
        const coinbaseListingDate = await syncCoinListingDateFromCoinbase(
          coin.id,
          symbol,
        );

        if (
          !coinbaseListingDate ||
          coinbaseListingDate >= LISTING_FETCH_CUTOFF_DATE
        ) {
          console.log(
            `⏭️ ${symbol}: Skip historical sync (listing Coinbase ${coinbaseListingDate ? coinbaseListingDate.toISOString().split("T")[0] : "tidak ditemukan"} tidak memenuhi cutoff)`,
          );
          results.skipped++;
          continue;
        }

        // No data - fetch everything from start date
        fetchStartTime = targetStartTime;
        console.log(`📥 Fetching from ${startDate} to now`);
      } else {
        // Has data - fetch from last candle onwards
        const newestTime =
          newestCandle.time instanceof Date
            ? newestCandle.time.getTime()
            : Number(newestCandle.time);

        fetchStartTime = newestTime + oneHour; // Start after last candle

        // Check if already up to date
        if (fetchStartTime >= currentHour) {
          console.log(`Already up to date`);
          results.skipped++;
          continue;
        }

        console.log(
          `📥 Fetching from ${new Date(fetchStartTime).toISOString().split("T")[0]} onwards`,
        );
      }

      // Fetch dan simpan per batch agar RAM tidak membengkak.
      let totalCompleteCandles = 0;
      let earliestSavedTime = null;
      let latestSavedTime = null;
      // Simpan candle terakhir batch sebelumnya untuk bridge gap antar-batch.
      let previousBatchTail = null;

      await fetchHistoricalCandles(symbol, fetchStartTime, fetchEndTime, {
        accumulate: false,
        onBatch: async (batchCandles) => {
          const completeCandles = batchCandles.filter((candle) => {
            const candleHour = Math.floor(candle.time / oneHour) * oneHour;
            return candleHour < currentHour;
          });

          if (!completeCandles.length) return;

          // Rapikan data batch lalu isi candle yang hilang dengan forward fill.
          // Tambahkan tail batch sebelumnya supaya gap di batas batch ikut terisi.
          const bridgeInput = previousBatchTail
            ? [previousBatchTail, ...completeCandles]
            : completeCandles;

          const normalizedCandles = cleanCandleData(bridgeInput);
          const uniqueCandles = removeDuplicateCandles(normalizedCandles);
          const candlesWithForwardFill = fillMissingCandles(
            uniqueCandles,
            oneHour,
          );

          // Jangan simpan ulang tail batch sebelumnya.
          const candlesForSave = previousBatchTail
            ? candlesWithForwardFill.filter(
                (c) => c.time > previousBatchTail.time,
              )
            : candlesWithForwardFill;

          if (!candlesForSave.length) return;

          const candleData = candlesForSave.map((candle) => ({
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            time: BigInt(Math.floor(candle.time)),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));

          await prisma.candle.createMany({
            data: candleData,
            skipDuplicates: true,
          });

          totalCompleteCandles += candlesForSave.length;
          if (
            !earliestSavedTime ||
            candlesForSave[0].time < earliestSavedTime
          ) {
            earliestSavedTime = candlesForSave[0].time;
          }

          const batchLastTime = candlesForSave[candlesForSave.length - 1].time;
          if (!latestSavedTime || batchLastTime > latestSavedTime) {
            latestSavedTime = batchLastTime;
          }

          previousBatchTail = candlesForSave[candlesForSave.length - 1];
        },
      });

      if (totalCompleteCandles === 0) {
        console.log(
          `⚠️ No data available from API (pair may not have historical data)`,
        );
        results.skipped++;
        continue;
      }

      // AUTOMATICALLY CALCULATE INDICATORS AFTER SAVING HISTORICAL CANDLES
      console.log(`📊 Calculating indicators for ${symbol}...`);
      await calculateAndSaveIndicators(symbol, "1h");

      // UPDATE LISTING DATE based on earliest candle
      await updateListingDateFromCandles(symbol);

      results.successful++;
      results.totalCandles += totalCompleteCandles;

      const dateRange = `${new Date(earliestSavedTime).toISOString().split("T")[0]} → ${new Date(latestSavedTime).toISOString().split("T")[0]}`;
      console.log(`Saved ${totalCompleteCandles} candles (${dateRange})`);

      // Delay between symbols
      if (i < symbols.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      // Handle 404 specifically (pair tidak ada historical data)
      if (error.response?.status === 404) {
        console.warn(
          `⚠️ ${symbol}: Pair tidak memiliki historical data di Coinbase (404)`,
        );
        results.skipped++;
        continue;
      }

      results.failed++;
      results.errors.push({ symbol, error: error.message });
      console.error(`❌ ${symbol}: ${error.message}`);
      continue;
    }
  }

  const duration = Date.now() - totalDuration;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 SYNC SUMMARY:`);
  console.log(`   Updated: ${results.successful}/${symbols.length}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}/${symbols.length}`);
  console.log(`   ❌ Failed: ${results.failed}/${symbols.length}`);
  console.log(`   💾 Total candles: ${results.totalCandles.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${(duration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`${"=".repeat(60)}\n`);

  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log(`⚠️  Errors:`);
    results.errors.forEach(({ symbol, error }) => {
      console.log(`   - ${symbol}: ${error}`);
    });
  }

  return results;
}
