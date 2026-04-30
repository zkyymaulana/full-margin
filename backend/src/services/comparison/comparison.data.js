import { prisma } from "../../lib/prisma.js";

/**
 * Gabungkan indikator dengan close price dari candle.
 */
export function mergeIndicatorsWithCandles(indicators, candles) {
  // Buat map agar lookup time -> close cepat.
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));

  // Gabungkan data dan buang yang tidak punya close.
  return indicators
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }))
    .filter((i) => i.close != null);
}

/**
 * Ambil bobot terbaik dari database.
 * Jika tidak ada, pakai bobot default yang sama rata.
 */
export async function getBestWeights(symbol, timeframe) {
  // Ambil id coin dari database.
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    console.log(`⚠️ ${symbol}: Coin not found in database`);
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // Ambil id timeframe dari database.
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.log(`⚠️ Timeframe ${timeframe} not found in database`);
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // Ambil hasil optimasi terbaru berdasarkan updatedAt.
  const latest = await prisma.indicatorWeight.findFirst({
    where: {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!latest) {
    console.log(
      `⚠️ No optimized weights found for ${symbol}, using default equal weights`,
    );
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // Log detail optimasi.
  console.log(
    `Using latest optimization for ${symbol} (updated: ${latest.updatedAt.toISOString()})`,
  );
  console.log(
    `ROI: ${latest.roi.toFixed(2)}%, WinRate: ${latest.winRate.toFixed(2)}%`,
  );

  return {
    weights: latest.weights,
    source: "latest_optimization",
    optimizedAt: latest.updatedAt,
    performance: {
      roi: latest.roi,
      winRate: latest.winRate,
      maxDrawdown: latest.maxDrawdown,
      sharpeRatio: latest.sharpeRatio,
    },
  };
}

/**
 * Bobot default untuk 8 indikator (semua sama rata).
 */
export function defaultWeights() {
  const keys = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];
  // Set semua bobot ke 1.
  return Object.fromEntries(keys.map((k) => [k, 1]));
}
