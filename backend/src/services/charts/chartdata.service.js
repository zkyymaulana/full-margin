import { prisma } from "../../lib/prisma.js";
import { formatMultiSignalFromDB } from "../../utils/multiSignal-formater.js";

function getIndicatorDelegate() {
  // Support both Prisma model naming variants: `Indicator` and `Indicators`.
  return prisma.indicator || prisma.indicators;
}

/** Ambil waktu candle terakhir untuk symbol */
export async function getLastCandleTime(symbol) {
  try {
    const last = await prisma.candle.findFirst({
      where: {
        coin: { symbol },
      },
      orderBy: { time: "desc" },
      select: { time: true },
    });
    return last ? Number(last.time) : null;
  } catch (err) {
    console.error(`❌ getLastCandleTime error (${symbol}):`, err.message);
    return null;
  }
}

/** Hitung total candle yang tersimpan untuk symbol tertentu */
export async function getCandleCount(symbol) {
  try {
    return await prisma.candle.count({
      where: {
        coin: { symbol },
        timeframe: { timeframe: "1h" },
      },
    });
  } catch (err) {
    console.error(`getCandleCount error (${symbol}):`, err.message);
    return 0;
  }
}

/** Ambil candle dari DB dengan pagination */
export async function getChartData(symbol, limit = 500, offset = 0) {
  const total = await getCandleCount(symbol);
  const candles = await prisma.candle.findMany({
    where: {
      coin: { symbol },
      timeframe: { timeframe: "1h" },
    },
    orderBy: { time: "asc" },
    skip: offset,
    take: limit,
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // format BigInt asli dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/** Ambil candle dari DB dengan pagination - Data Terbaru Dulu */
export async function getChartDataNewest(symbol, limit = 1000, offset = 0) {
  const total = await getCandleCount(symbol);
  const candles = await prisma.candle.findMany({
    where: {
      coin: { symbol },
      timeframe: { timeframe: "1h" },
    },
    orderBy: { time: "desc" }, // DESC untuk data terbaru dulu
    skip: offset,
    take: limit,
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // Gunakan format BigInt asli dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/** Simpan candles ke DB (dipakai scheduler otomatis) */
export async function saveCandlesToDB(symbol, coinId, candles) {
  try {
    if (!candles?.length) return { success: false, message: "No candles" };

    // Get timeframeId for "1h"
    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe: "1h" },
    });

    if (!timeframeRecord) {
      throw new Error('Timeframe "1h" not found in database');
    }

    const data = candles.map((c) => ({
      coinId,
      timeframeId: timeframeRecord.id,
      time: BigInt(c.time), // Langsung gunakan milidetik dari candle.time
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    await prisma.candle.createMany({ data, skipDuplicates: true });
    console.log(`💾 ${symbol}: ${data.length} candle disimpan`);
    return { success: true, count: data.length };
  } catch (err) {
    console.error(`❌ saveCandlesToDB error (${symbol}):`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Get coin and timeframe records from database
 */
export async function getCoinAndTimeframe(symbol, timeframe) {
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true, name: true, logo: true },
  });

  if (!coin) {
    throw new Error(`Coin ${symbol} not found in database`);
  }

  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    throw new Error(`Timeframe ${timeframe} not found in database`);
  }

  return { coin, timeframeRecord };
}

/**
 * Get latest indicator weights for a coin
 */
export async function getLatestWeights(coinId, timeframeId) {
  const weightRecord = await prisma.indicatorWeight.findFirst({
    where: { coinId, timeframeId },
    orderBy: { updatedAt: "desc" },
  });

  return weightRecord?.weights || null;
}

/**
 * Get or recalculate indicators for time range
 */
export async function getIndicatorsForTimeRange(
  symbol,
  timeframe,
  coinId,
  timeframeId,
  minTime,
  maxTime,
  expectedCount,
) {
  const indicatorDelegate = getIndicatorDelegate();
  if (!indicatorDelegate?.findMany) {
    throw new Error(
      "Indicator model delegate is not available in Prisma client",
    );
  }

  let indicators = await indicatorDelegate.findMany({
    where: {
      coinId,
      timeframeId,
      time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
    },
    orderBy: { time: "asc" },
  });

  const coverageBefore = indicators.length;

  if (coverageBefore < expectedCount) {
    console.log(
      `[AUTO] Indicator coverage ${coverageBefore}/${expectedCount} → recalculating...`,
    );
    try {
      const { calculateAndSaveIndicators } = await import(
        "../indicators/indicator.service.js"
      );
      await calculateAndSaveIndicators(symbol, timeframe, minTime, maxTime);

      indicators = await indicatorDelegate.findMany({
        where: {
          coinId,
          timeframeId,
          time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
        },
        orderBy: { time: "asc" },
      });
      console.log(
        `Found ${indicators.length}/${expectedCount} indicators after recalc.`,
      );
    } catch (err) {
      console.error(`Indicator calculation failed:`, err.message);
    }
  }

  return indicators;
}

/**
 * Merge candles with indicators and format response
 */
export function mergeChartData(candles, indicators, weights) {
  const indicatorMap = new Map(indicators.map((i) => [Number(i.time), i]));

  return candles.map((c) => {
    const ind = indicatorMap.get(Number(c.time));
    const multiSignal = formatMultiSignalFromDB(ind, weights);

    return {
      time: c.time.toString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      multiSignal,
      indicators: ind ? formatIndicators(ind) : null,
    };
  });
}

/**
 * Format individual indicators from database
 */
function formatIndicators(ind) {
  return {
    sma: {
      20: ind.sma20,
      50: ind.sma50,
      signal: ind.smaSignal || "neutral",
    },
    ema: {
      20: ind.ema20,
      50: ind.ema50,
      signal: ind.emaSignal || "neutral",
    },
    rsi: {
      14: ind.rsi,
      signal: ind.rsiSignal || "neutral",
    },
    macd: {
      macd: ind.macd,
      signalLine: ind.macdSignalLine,
      histogram: ind.macdHist,
      signal: ind.macdSignal || "neutral",
    },
    bollingerBands: {
      upper: ind.bbUpper,
      middle: ind.bbMiddle,
      lower: ind.bbLower,
      signal: ind.bbSignal || "neutral",
    },
    stochastic: {
      "%K": ind.stochK,
      "%D": ind.stochD,
      signal: ind.stochSignal || "neutral",
    },
    stochasticRsi: {
      "%K": ind.stochRsiK,
      "%D": ind.stochRsiD,
      signal: ind.stochRsiSignal || "neutral",
    },
    parabolicSar: {
      value: ind.psar,
      signal: ind.psarSignal || "neutral",
    },
  };
}

/**
 * Calculate metadata statistics
 */
export function calculateMetadata(merged, minTime, maxTime) {
  const withIndicators = merged.filter((m) => m.indicators).length;
  const coverage = (withIndicators / merged.length) * 100;

  // Strong signal tetap dihitung sebagai arah buy/sell agar distribusi konsisten.
  const signalStats = {
    buy: merged.filter((m) =>
      ["buy", "strong_buy"].includes(m.multiSignal?.signal),
    ).length,
    sell: merged.filter((m) =>
      ["sell", "strong_sell"].includes(m.multiSignal?.signal),
    ).length,
    neutral: merged.filter((m) => m.multiSignal?.signal === "neutral").length,
    missing: merged.filter((m) => !m.multiSignal).length,
  };

  return {
    coverage: `${withIndicators}/${merged.length}`,
    coveragePercent: `${coverage.toFixed(1)}%`,
    signalDistribution: signalStats,
    source: "database",
    range: {
      start: new Date(minTime).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      end: new Date(maxTime).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  };
}

/**
 * Build pagination URLs
 */
export function buildPagination(req, page, totalPages, limit, timeframe) {
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

  const next =
    page < totalPages
      ? {
          page: page + 1,
          url: `${baseUrl}?page=${page + 1}&limit=${limit}&timeframe=${timeframe}`,
        }
      : null;

  const prev =
    page > 1
      ? {
          page: page - 1,
          url: `${baseUrl}?page=${page - 1}&limit=${limit}&timeframe=${timeframe}`,
        }
      : null;

  return { next, prev };
}
