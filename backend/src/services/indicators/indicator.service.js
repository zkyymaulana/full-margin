import { INDICATOR_WARMUP_CANDLES, timeframeToMs } from "./indicator.calc.js";
import { calculateInBatches, processIndicators } from "./indicator.batch.js";
import {
  findCandlesAsc,
  findCandlesAscFromTime,
  findCoinBySymbolWithListing,
  findIndicatorTimes,
  findLatestIndicatorTime,
  findLatestSignalDataBundle,
  findPaginatedCandlePrices,
  findPaginatedIndicators,
  findPaginatedSignalDataBundle,
  findTimeframeByValue,
} from "./indicator.repository.js";
import {
  buildIndicatorPagination,
  buildLatestSignal,
  buildResponseMetadata,
  formatIndicatorStructure,
  formatPerformanceData,
  organizeIndicatorData,
} from "./indicator.formatter.js";
import { clearWeightsCache, invalidateWeightsCache } from "./weights.cache.js";

// File service indikator (orchestrator).
// Tujuan: mengatur alur bisnis tingkat tinggi tanpa membawa detail query/kalkulasi berat.

const LISTING_FETCH_CUTOFF_DATE = new Date("2025-01-01T00:00:00.000Z");

async function getCandlesForIndicatorCalculation(
  coinId,
  timeframeId,
  latestIndicatorTime,
  timeframe,
) {
  if (!latestIndicatorTime) {
    return findCandlesAsc(coinId, timeframeId);
  }

  const latest = Number(latestIndicatorTime);
  // Ambil buffer candle sesuai timeframe supaya warmup konsisten lintas timeframe.
  const timeframeMs = timeframeToMs(timeframe);
  const rangeStart = Math.max(
    0,
    latest - INDICATOR_WARMUP_CANDLES * timeframeMs,
  );

  return findCandlesAscFromTime(coinId, timeframeId, rangeStart);
}

// === MAIN CALCULATION FUNCTION WITH BATCH PROCESSING ===
export async function calculateAndSaveIndicators(symbol, timeframe = "1h") {
  // Get coinId and timeframeId first
  const coin = await findCoinBySymbolWithListing(symbol);

  if (!coin) {
    console.log(`No coin found for ${symbol}.`);
    return;
  }

  if (coin.listingDate && coin.listingDate > LISTING_FETCH_CUTOFF_DATE) {
    console.log(
      `⏭️ ${symbol}: Skip indicator calculation (listingDate ${coin.listingDate.toISOString().split("T")[0]} > 2025-01-01)`,
    );
    return;
  }

  const timeframeRecord = await findTimeframeByValue(timeframe);

  if (!timeframeRecord) {
    console.log(`No timeframe found for ${timeframe}.`);
    return;
  }

  const latestIndicator = await findLatestIndicatorTime(
    coin.id,
    timeframeRecord.id,
  );

  const candles = await getCandlesForIndicatorCalculation(
    coin.id,
    timeframeRecord.id,
    latestIndicator?.time,
    timeframe,
  );

  if (!candles.length) {
    console.log(`No candles found for ${symbol}.`);
    return;
  }

  let existingTimes;
  let missingCandles;

  if (latestIndicator?.time) {
    const latestIndicatorTime = Number(latestIndicator.time);
    existingTimes = new Set([latestIndicatorTime]);
    missingCandles = candles.filter(
      (c, idx) =>
        idx >= INDICATOR_WARMUP_CANDLES && Number(c.time) > latestIndicatorTime,
    );
  } else {
    const existing = await findIndicatorTimes(coin.id, timeframeRecord.id);
    existingTimes = new Set(existing.map((e) => Number(e.time)));
    missingCandles = candles.filter(
      (c, idx) =>
        idx >= INDICATOR_WARMUP_CANDLES && !existingTimes.has(Number(c.time)),
    );
  }

  if (missingCandles.length === 0) {
    console.log(`✅ ${symbol}: All indicators up to date.`);
    return;
  }

  console.log(
    `${symbol}: Found ${missingCandles.length} candles without indicators`,
  );

  // BATCH PROCESSING: Jika terlalu banyak, proses secara bertahap
  const BATCH_SIZE = 1000; // Process 1000 indicators at a time
  if (missingCandles.length > BATCH_SIZE) {
    console.log(`${symbol}: Processing in batches of ${BATCH_SIZE}...`);
    return await calculateInBatches(
      symbol,
      timeframe,
      candles,
      existingTimes,
      coin.id,
      timeframeRecord.id,
    );
  }

  // Process normal (< 1000 missing candles)
  return await processIndicators(
    symbol,
    timeframe,
    candles,
    existingTimes,
    coin.id,
    timeframeRecord.id,
  );
}

/**
 * Get coin and timeframe IDs from database
 */
export async function getCoinAndTimeframeIds(symbol, timeframe) {
  const coin = await findCoinBySymbolWithListing(symbol);

  if (!coin) {
    throw new Error(`Coin ${symbol} tidak ditemukan.`);
  }

  const timeframeRecord = await findTimeframeByValue(timeframe);

  if (!timeframeRecord) {
    throw new Error(`Timeframe ${timeframe} tidak ditemukan.`);
  }

  return {
    coinId: coin.id,
    timeframeId: timeframeRecord.id,
  };
}

/**
 * Get latest signal data for a symbol
 */
export async function getLatestSignalData(coinId, timeframeId) {
  const { latestIndicator, latestWeight, latestCandle } =
    await findLatestSignalDataBundle(coinId, timeframeId);

  if (!latestIndicator) {
    throw new Error("No indicator data found");
  }

  return {
    indicator: latestIndicator,
    weight: latestWeight,
    price: latestCandle?.close ?? null,
  };
}

/**
 * Get paginated indicator data
 */
export async function getPaginatedIndicators(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  return findPaginatedIndicators(coinId, timeframeId, page, limit, showAll);
}

/**
 * Get candle prices for indicators
 */
export async function getCandlePrices(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  return findPaginatedCandlePrices(coinId, timeframeId, page, limit, showAll);
}

/**
 * Get all paginated data in one call (parallel)
 */
export async function getPaginatedSignalData(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  return findPaginatedSignalDataBundle(
    coinId,
    timeframeId,
    page,
    limit,
    showAll,
  );
}

export {
  invalidateWeightsCache,
  clearWeightsCache,
  formatIndicatorStructure,
  formatPerformanceData,
  organizeIndicatorData,
  buildIndicatorPagination,
  buildLatestSignal,
  buildResponseMetadata,
};
