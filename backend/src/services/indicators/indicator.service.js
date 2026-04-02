import { prisma } from "../../lib/prisma.js";
import {
  createSMACalculator,
  createEMACalculator,
  createRSICalculator,
  createMACDCalculator,
  createBollingerBandsCalculator,
  createStochasticCalculator,
  createStochasticRSICalculator,
  createParabolicSARCalculator,
} from "../indicators/index.js";

import { calculateSignals } from "../signals/signalAnalyzer.js";
import { calculateOverallSignal } from "../signals/overallAnalyzer.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const INDICATOR_WARMUP_CANDLES = Math.max(
  60,
  Number(process.env.INDICATOR_WARMUP_CANDLES || "250"),
);

async function getCandlesForIndicatorCalculation(
  coinId,
  timeframeId,
  latestIndicatorTime,
) {
  if (!latestIndicatorTime) {
    return prisma.candle.findMany({
      where: { coinId, timeframeId },
      orderBy: { time: "asc" },
    });
  }

  const latest = Number(latestIndicatorTime);
  const rangeStart = Math.max(
    0,
    latest - INDICATOR_WARMUP_CANDLES * ONE_HOUR_MS,
  );

  return prisma.candle.findMany({
    where: {
      coinId,
      timeframeId,
      time: { gte: BigInt(rangeStart) },
    },
    orderBy: { time: "asc" },
  });
}

// === MAIN CALCULATION FUNCTION WITH BATCH PROCESSING ===
export async function calculateAndSaveIndicators(symbol, timeframe = "1h") {
  // Get coinId and timeframeId first
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    console.log(`No coin found for ${symbol}.`);
    return;
  }

  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.log(`No timeframe found for ${timeframe}.`);
    return;
  }

  const latestIndicator = await prisma.indicator.findFirst({
    where: {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    },
    orderBy: { time: "desc" },
    select: { time: true },
  });

  const candles = await getCandlesForIndicatorCalculation(
    coin.id,
    timeframeRecord.id,
    latestIndicator?.time,
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
      (c, idx) => idx >= 50 && Number(c.time) > latestIndicatorTime,
    );
  } else {
    const existing = await prisma.indicator.findMany({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
      select: { time: true },
    });
    existingTimes = new Set(existing.map((e) => Number(e.time)));
    missingCandles = candles.filter(
      (c, idx) => idx >= 50 && !existingTimes.has(Number(c.time)),
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

// NEW: Batch processing for large datasets
async function calculateInBatches(
  symbol,
  timeframe,
  candles,
  existingTimes,
  coinId,
  timeframeId,
) {
  const start = Date.now();

  // Inisialisasi kalkulator sekali saja
  const calculators = initializeCalculators();

  // Warmup calculators dengan 50 candle pertama
  for (let i = 0; i < Math.min(50, candles.length); i++) {
    const { close, high, low } = candles[i];
    warmupCalculators(calculators, close, high, low);
  }

  let totalSaved = 0;
  const BATCH_SIZE = 1000;
  const results = [];
  let lastPing = Date.now();
  const PING_INTERVAL = 30000; // Ping every 30 seconds

  // Process candles after warmup
  for (let i = 50; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // ✅ Periodic database ping to keep connection alive
    if (Date.now() - lastPing > PING_INTERVAL) {
      await prisma.$queryRaw`SELECT 1`; // Simple ping query
      lastPing = Date.now();
    }

    // Skip if already exists
    if (existingTimes.has(Number(time))) {
      warmupCalculators(calculators, close, high, low);
      continue;
    }

    // Calculate indicators
    const indicators = calculateAllIndicators(calculators, close, high, low);
    const signals = calculateSignals(indicators, close);

    // ✅ Get weights once per symbol (cache it)
    const overallAnalysis = await calculateOverallSignalOptimized(
      signals,
      symbol,
      timeframe,
    );

    results.push({
      coinId,
      timeframeId,
      time,
      ...indicators,
      smaSignal: signals.smaSignal,
      emaSignal: signals.emaSignal,
      rsiSignal: signals.rsiSignal,
      macdSignal: signals.macdSignal,
      bbSignal: signals.bbSignal,
      stochSignal: signals.stochSignal,
      stochRsiSignal: signals.stochRsiSignal,
      psarSignal: signals.psarSignal,
      overallSignal: overallAnalysis.overallSignal,
      signalStrength: overallAnalysis.signalStrength,
      finalScore: overallAnalysis.finalScore,
    });

    // Save in batches
    if (results.length >= BATCH_SIZE) {
      await prisma.indicator.createMany({
        data: results,
        skipDuplicates: true,
      });
      totalSaved += results.length;
      console.log(
        `   💾 ${symbol}: Saved batch ${Math.floor(totalSaved / BATCH_SIZE)} (${totalSaved} total)`,
      );
      results.length = 0; // Clear array
    }
  }

  // Save remaining
  if (results.length > 0) {
    await prisma.indicator.createMany({
      data: results,
      skipDuplicates: true,
    });
    totalSaved += results.length;
  }

  console.log(
    `✅ ${symbol}: ${totalSaved} indicators calculated and saved in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
  return totalSaved;
}

// ✅ NEW: Process normal size datasets
async function processIndicators(
  symbol,
  timeframe,
  candles,
  existingTimes,
  coinId,
  timeframeId,
) {
  const start = Date.now();
  const calculators = initializeCalculators();
  const results = [];

  // Process all candles (including historical for proper warmup)
  for (let i = 0; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // Calculate all indicators
    const sma20Val = calculators.sma20.calculate(close);
    const sma50Val = calculators.sma50.calculate(close);
    const ema20Val = calculators.ema20.calculate(close);
    const ema50Val = calculators.ema50.calculate(close);
    const rsiVal = calculators.rsi.calculate(close);
    const macdVal = calculators.macd.calculate(close);
    const bbVal = calculators.bb.calculate(close);
    const stochVal = calculators.stoch.calculate(high, low, close);
    const stochRSIVal = calculators.stochRSI.calculate(close);
    const psarVal = calculators.psar.calculate(high, low);

    // Hanya simpan jika: sudah melewati warmup (50 period) DAN belum ada di database
    if (i >= 50 && !existingTimes.has(Number(time))) {
      const indicators = {
        sma20: sma20Val,
        sma50: sma50Val,
        ema20: ema20Val,
        ema50: ema50Val,
        rsi: rsiVal,
        macd: macdVal.macd,
        macdSignalLine: macdVal.signalLine,
        macdHist: macdVal.histogram,
        bbUpper: bbVal.upper,
        bbMiddle: bbVal.middle ?? bbVal.sma ?? sma20Val,
        bbLower: bbVal.lower,
        stochK: stochVal["%K"],
        stochD: stochVal["%D"],
        stochRsiK: stochRSIVal["%K"],
        stochRsiD: stochRSIVal["%D"],
        psar: psarVal.value,
      };

      const signals = calculateSignals(indicators, close);
      const overallAnalysis = await calculateOverallSignal(
        signals,
        symbol,
        timeframe,
      );

      results.push({
        coinId,
        timeframeId,
        time,
        ...indicators,
        smaSignal: signals.smaSignal,
        emaSignal: signals.emaSignal,
        rsiSignal: signals.rsiSignal,
        macdSignal: signals.macdSignal,
        bbSignal: signals.bbSignal,
        stochSignal: signals.stochSignal,
        stochRsiSignal: signals.stochRsiSignal,
        psarSignal: signals.psarSignal,
        overallSignal: overallAnalysis.overallSignal,
        signalStrength: overallAnalysis.signalStrength,
        finalScore: overallAnalysis.finalScore,
      });
    }
  }

  if (results.length > 0) {
    await prisma.indicator.createMany({
      data: results,
      skipDuplicates: true,
    });
    console.log(
      `✅ ${symbol}: ${results.length} new indicators calculated and saved (${Date.now() - start}ms)`,
    );
  } else {
    console.log(
      `✅ ${symbol}: No new indicators to save (${Date.now() - start}ms)`,
    );
  }
  return results.length;
}

// ✅ NEW: Helper functions
function initializeCalculators() {
  return {
    sma20: createSMACalculator(20),
    sma50: createSMACalculator(50),
    ema20: createEMACalculator(20),
    ema50: createEMACalculator(50),
    rsi: createRSICalculator(14),
    macd: createMACDCalculator(12, 26, 9),
    bb: createBollingerBandsCalculator(20, 2),
    stoch: createStochasticCalculator(14, 3),
    stochRSI: createStochasticRSICalculator(14, 14, 3, 3),
    psar: createParabolicSARCalculator(0.02, 0.2),
  };
}

function warmupCalculators(calculators, close, high, low) {
  calculators.sma20.calculate(close);
  calculators.sma50.calculate(close);
  calculators.ema20.calculate(close);
  calculators.ema50.calculate(close);
  calculators.rsi.calculate(close);
  calculators.macd.calculate(close);
  calculators.bb.calculate(close);
  calculators.stoch.calculate(high, low, close);
  calculators.stochRSI.calculate(close);
  calculators.psar.calculate(high, low);
}

function calculateAllIndicators(calculators, close, high, low) {
  const sma20Val = calculators.sma20.calculate(close);
  const sma50Val = calculators.sma50.calculate(close);
  const ema20Val = calculators.ema20.calculate(close);
  const ema50Val = calculators.ema50.calculate(close);
  const rsiVal = calculators.rsi.calculate(close);
  const macdVal = calculators.macd.calculate(close);
  const bbVal = calculators.bb.calculate(close);
  const stochVal = calculators.stoch.calculate(high, low, close);
  const stochRSIVal = calculators.stochRSI.calculate(close);
  const psarVal = calculators.psar.calculate(high, low);

  return {
    sma20: sma20Val,
    sma50: sma50Val,
    ema20: ema20Val,
    ema50: ema50Val,
    rsi: rsiVal,
    macd: macdVal.macd,
    macdSignalLine: macdVal.signalLine,
    macdHist: macdVal.histogram,
    bbUpper: bbVal.upper,
    bbMiddle: bbVal.middle ?? bbVal.sma ?? sma20Val,
    bbLower: bbVal.lower,
    stochK: stochVal["%K"],
    stochD: stochVal["%D"],
    stochRsiK: stochRSIVal["%K"],
    stochRsiD: stochRSIVal["%D"],
    psar: psarVal.value,
  };
}

// ✅ Cache untuk weights per symbol
const weightsCache = new Map();

async function calculateOverallSignalOptimized(signals, symbol, timeframe) {
  // Check cache first
  let weights = weightsCache.get(symbol);

  if (!weights) {
    // Get coinId and timeframeId for query
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    // Load weights from database (from indicatorWeight table)
    if (coin && timeframeRecord) {
      const weightRecord = await prisma.indicatorWeight.findFirst({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          weights: true,
        },
      });

      // Use weights or fallback to equal weights
      if (weightRecord?.weights) {
        weights = weightRecord.weights;
      }
    }

    // Fallback to equal weights if no record found
    if (!weights) {
      weights = {
        SMA: 1,
        EMA: 1,
        RSI: 1,
        MACD: 1,
        BollingerBands: 1,
        Stochastic: 1,
        StochasticRSI: 1,
        PSAR: 1,
      };
    }

    weightsCache.set(symbol, weights);
  }

  // Use cached weights to avoid DB query for every indicator
  return calculateOverallSignal(signals, symbol, timeframe, weights);
}

/**
 * Get coin and timeframe IDs from database
 */
export async function getCoinAndTimeframeIds(symbol, timeframe) {
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    throw new Error(`Coin ${symbol} tidak ditemukan.`);
  }

  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

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
  const [latestIndicator, latestWeight, latestCandle] = await Promise.all([
    prisma.indicator.findFirst({
      where: { coinId, timeframeId },
      orderBy: { time: "desc" },
    }),
    prisma.indicatorWeight.findFirst({
      where: { coinId, timeframeId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.candle.findFirst({
      where: { coinId, timeframeId },
      orderBy: { time: "desc" },
      select: { time: true, close: true },
    }),
  ]);

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
 * Format indicators structure from database record
 */
export function formatIndicatorStructure(indicator) {
  return {
    sma: {
      20: indicator.sma20 ?? null,
      50: indicator.sma50 ?? null,
      signal: indicator.smaSignal || "neutral",
    },
    ema: {
      20: indicator.ema20 ?? null,
      50: indicator.ema50 ?? null,
      signal: indicator.emaSignal || "neutral",
    },
    rsi: {
      14: indicator.rsi ?? null,
      signal: indicator.rsiSignal || "neutral",
    },
    macd: {
      macd: indicator.macd ?? null,
      signalLine: indicator.macdSignalLine ?? null,
      histogram: indicator.macdHist ?? null,
      signal: indicator.macdSignal || "neutral",
    },
    bollingerBands: {
      upper: indicator.bbUpper ?? null,
      middle: indicator.bbMiddle ?? null,
      lower: indicator.bbLower ?? null,
      signal: indicator.bbSignal || "neutral",
    },
    stochastic: {
      "%K": indicator.stochK ?? null,
      "%D": indicator.stochD ?? null,
      signal: indicator.stochSignal || "neutral",
    },
    stochasticRsi: {
      "%K": indicator.stochRsiK ?? null,
      "%D": indicator.stochRsiD ?? null,
      signal: indicator.stochRsiSignal || "neutral",
    },
    parabolicSar: {
      value: indicator.psar ?? null,
      signal: indicator.psarSignal || "neutral",
    },
  };
}

/**
 * Format performance data from weight record
 */
export function formatPerformanceData(weightRecord) {
  if (!weightRecord) return null;

  return {
    roi: weightRecord.roi,
    winRate: weightRecord.winRate,
    maxDrawdown: weightRecord.maxDrawdown,
    sharpeRatio: weightRecord.sharpeRatio,
    trades: weightRecord.trades,
    finalCapital: weightRecord.finalCapital,
    trainingPeriod: {
      startDate: Number(weightRecord.startTrain),
      endDate: Number(weightRecord.endTrain),
      startDateReadable: formatReadableDate(Number(weightRecord.startTrain)),
      endDateReadable: formatReadableDate(Number(weightRecord.endTrain)),
    },
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
  const skip = (page - 1) * limit;

  const queryOptions = {
    where: { coinId, timeframeId },
    orderBy: { time: "desc" },
    select: {
      time: true,
      sma20: true,
      sma50: true,
      ema20: true,
      ema50: true,
      rsi: true,
      macd: true,
      macdSignalLine: true,
      macdHist: true,
      bbUpper: true,
      bbMiddle: true,
      bbLower: true,
      stochK: true,
      stochD: true,
      stochRsiK: true,
      stochRsiD: true,
      psar: true,
      smaSignal: true,
      emaSignal: true,
      rsiSignal: true,
      macdSignal: true,
      bbSignal: true,
      stochSignal: true,
      stochRsiSignal: true,
      psarSignal: true,
      overallSignal: true,
      signalStrength: true,
      finalScore: true,
    },
  };

  if (!showAll) {
    queryOptions.skip = skip;
    queryOptions.take = limit;
  }

  return await prisma.indicator.findMany(queryOptions);
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
  const skip = (page - 1) * limit;

  return await prisma.candle.findMany({
    where: { coinId, timeframeId },
    orderBy: { time: "desc" },
    ...(showAll ? {} : { skip, take: limit }),
    select: { time: true, close: true },
  });
}

/**
 * Organize indicator data with prices
 */
export function organizeIndicatorData(indicators, priceMap) {
  return indicators.map((d) => {
    const bbMiddle =
      d.bbMiddle ??
      (d.bbUpper && d.bbLower
        ? (d.bbUpper + d.bbLower) / 2
        : (d.sma20 ?? null));

    return {
      time: Number(d.time),
      price: priceMap.get(Number(d.time)) ?? null,
      indicators: {
        sma: {
          20: d.sma20 ?? null,
          50: d.sma50 ?? null,
          signal: d.smaSignal ?? "neutral",
        },
        ema: {
          20: d.ema20 ?? null,
          50: d.ema50 ?? null,
          signal: d.emaSignal ?? "neutral",
        },
        rsi: {
          14: d.rsi ?? null,
          signal: d.rsiSignal ?? "neutral",
        },
        macd: {
          macd: d.macd ?? null,
          signalLine: d.macdSignalLine ?? null,
          histogram: d.macdHist ?? null,
          signal: d.macdSignal ?? "neutral",
        },
        bollingerBands: {
          upper: d.bbUpper ?? null,
          middle: bbMiddle,
          lower: d.bbLower ?? null,
          signal: d.bbSignal ?? "neutral",
        },
        stochastic: {
          "%K": d.stochK ?? null,
          "%D": d.stochD ?? null,
          signal: d.stochSignal ?? "neutral",
        },
        stochasticRsi: {
          "%K": d.stochRsiK ?? null,
          "%D": d.stochRsiD ?? null,
          signal: d.stochRsiSignal ?? "neutral",
        },
        parabolicSar: {
          value: d.psar ?? null,
          signal: d.psarSignal ?? "neutral",
        },
      },
      overallSignal: d.overallSignal ?? "neutral",
      signalStrength: d.signalStrength ?? 0.5,
    };
  });
}

/**
 * Build pagination metadata
 */
export function buildIndicatorPagination(
  req,
  page,
  totalPages,
  limit,
  showAll,
) {
  if (showAll) return null;

  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

  return {
    next: hasNext
      ? { page: page + 1, url: `${baseUrl}?page=${page + 1}` }
      : null,
    prev: hasPrev
      ? { page: page - 1, url: `${baseUrl}?page=${page - 1}` }
      : null,
  };
}

/**
 * Helper: Format readable date
 */
function formatReadableDate(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

/**
 * Build latest signal object
 */
export function buildLatestSignal(
  latestIndicator,
  latestWeight,
  priceMap,
  formatMultiSignalFromDB,
  formatIndicatorStructure,
) {
  if (!latestIndicator) return null;

  const latestPrice = priceMap.get(Number(latestIndicator.time)) ?? null;
  const multiSignal = formatMultiSignalFromDB(
    latestIndicator,
    latestWeight?.weights,
  );
  const indicators = formatIndicatorStructure(latestIndicator);

  return {
    time: Number(latestIndicator.time),
    price: latestPrice,
    multiSignal,
    weights: latestWeight?.weights ?? null,
    performance: latestWeight
      ? {
          roi: latestWeight.roi,
          winRate: latestWeight.winRate,
          maxDrawdown: latestWeight.maxDrawdown,
          sharpeRatio: latestWeight.sharpeRatio,
        }
      : null,
    indicators,
  };
}

/**
 * Build metadata for paginated response
 */
export function buildResponseMetadata(organized, totalIndicators, showAll) {
  const formatDate = (time) => {
    if (!time) return null;
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(time));
  };

  const rangeStart = formatDate(Number(organized[organized.length - 1]?.time));
  const rangeEnd = formatDate(Number(organized[0]?.time));
  const coveragePercent = ((organized.length / totalIndicators) * 100).toFixed(
    1,
  );

  return {
    coverage: `${organized.length}/${totalIndicators}`,
    coveragePercent: showAll ? "100%" : `${coveragePercent}%`,
    range: { start: rangeStart, end: rangeEnd },
    source: "database",
  };
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
  const [data, candlePrices, latestIndicator, latestWeight] = await Promise.all(
    [
      getPaginatedIndicators(coinId, timeframeId, page, limit, showAll),
      getCandlePrices(coinId, timeframeId, page, limit, showAll),
      prisma.indicator.findFirst({
        where: { coinId, timeframeId },
        orderBy: { time: "desc" },
      }),
      prisma.indicatorWeight.findFirst({
        where: { coinId, timeframeId },
        orderBy: { updatedAt: "desc" },
      }),
    ],
  );

  return {
    indicators: data,
    prices: candlePrices,
    latestIndicator,
    latestWeight,
  };
}
