import { prisma } from "../../lib/prisma.js";
import {
  calculateBacktest,
  genSingleSignals,
  genMultiSignals,
} from "./backtest.service.js";

/**
 * 🔹 Convert Date String → BigInt Timestamp
 */
const toBigInt = (date) => BigInt(new Date(date).getTime());

/**
 * 🎯 Compare Multi vs Single Indicator (Academic Style)
 * - Evaluates ROI, WinRate, MaxDrawdown only
 * - No balance, SL, or TP used
 */
export async function compareStrategies(symbol, start, end) {
  const s = toBigInt(start),
    e = toBigInt(end);

  const data = await prisma.indicator.findMany({
    where: { symbol, time: { gte: s, lte: e } },
    orderBy: { time: "asc" },
  });

  const candles = await prisma.candle.findMany({
    where: { symbol, time: { gte: s, lte: e } },
    orderBy: { time: "asc" },
  });

  if (!data.length || !candles.length)
    return { success: false, message: "No data found" };

  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const indicators = [
    "RSI",
    "MACD",
    "SMA",
    "EMA",
    "BollingerBands",
    "ParabolicSAR",
    "StochasticRSI",
  ];

  // === SINGLE STRATEGIES ===
  const single = Object.fromEntries(
    indicators.map((ind) => {
      const sig = genSingleSignals(data, map, ind);
      const res = calculateBacktest(sig, map, data);
      return [ind, res];
    })
  );

  // === MULTI STRATEGY ===
  const multi = calculateBacktest(genMultiSignals(data, map), map, data);

  // === BEST SINGLE ===
  const best = Object.entries(single).reduce(
    (a, [k, v]) => (v.roi > a.roi ? { indicator: k, ...v } : a),
    { indicator: "none", roi: -Infinity }
  );

  return {
    success: true,
    symbol,
    comparison: {
      single,
      multi,
      bestStrategy: multi.roi > best.roi ? "multi" : "single",
      bestSingleIndicator: best.indicator,
    },
  };
}
