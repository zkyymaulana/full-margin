/**
 * 📊 COMPARISON SERVICE (Academic-Validated Version)
 * ---------------------------------------------------------------
 * Based on: Sukma & Namahoot (2025)
 * “Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading”
 */

import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../indicators/indicator-backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/multiIndicator-backtest.service.js";

/* ==========================================================
   🧮 HELPER FUNCTIONS
========================================================== */

/** Mean & standard deviation for Sharpe/Sortino */
function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function stddev(arr) {
  const m = mean(arr);
  const variance =
    arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length || 1);
  return Math.sqrt(variance);
}

/** Sharpe Ratio: reward vs volatility */
function calcSharpe(returns, riskFree = 0.02) {
  if (!returns.length) return 0;
  const avg = mean(returns);
  const sd = stddev(returns);
  return sd ? (avg - riskFree) / sd : 0;
}

/** Sortino Ratio: reward vs downside risk */
function calcSortino(returns, riskFree = 0.02) {
  const neg = returns.filter((r) => r < 0);
  const downside = stddev(neg);
  const avg = mean(returns);
  return downside ? (avg - riskFree) / downside : 0;
}

/** Sanitize numeric metrics */
function cleanResult(result) {
  if (!result) return null;

  const cleaned = {
    roi: +Number(result.roi || 0).toFixed(2),
    winRate: +Number(result.winRate || 0).toFixed(2),
    maxDrawdown: +Number(result.maxDrawdown || 0).toFixed(2),
    trades: result.trades || 0,
    finalCapital: result.finalCapital
      ? +Number(result.finalCapital).toFixed(2)
      : undefined,
  };

  // Realistic academic constraints
  if (cleaned.roi < -100) cleaned.roi = -100;
  if (cleaned.roi > 150) cleaned.roi = 150; // normalized ROI limit
  if (cleaned.winRate < 0) cleaned.winRate = 0;
  if (cleaned.winRate > 100) cleaned.winRate = 100;
  if (cleaned.maxDrawdown < 0) cleaned.maxDrawdown = 0;
  if (cleaned.maxDrawdown > 100) cleaned.maxDrawdown = 100;

  return cleaned;
}

/** Merge candle prices into indicator data */
function mergeIndicatorsWithCandles(indicators, candles) {
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  return indicators
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }))
    .filter((i) => i.close != null);
}

/** Prefer rule-based optimized weights */
async function getBestWeights(symbol, timeframe) {
  const all = await prisma.indicatorWeight.findMany({
    where: { symbol, timeframe },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (!all.length)
    return {
      weights: defaultWeights(),
      source: "default",
    };

  // Cari yang dibuat oleh metode Rule-Based
  const ruleBased = all.find((r) =>
    (r.methodology || "").includes("Rule-Based")
  );

  if (ruleBased)
    return {
      weights: ruleBased.weights,
      source: "rule-based",
      optimizedAt: ruleBased.updatedAt,
    };

  // fallback: ambil terbaik ROI
  const best = all.sort((a, b) => b.roi - a.roi)[0];
  return {
    weights: best.weights || defaultWeights(),
    source: "database",
    optimizedAt: best.updatedAt,
  };
}

/** Default equal weights */
function defaultWeights() {
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
  return Object.fromEntries(keys.map((k) => [k, 1]));
}

/* ==========================================================
   🎯 MAIN COMPARISON FUNCTION
========================================================== */
export async function compareStrategies(symbol, startDate, endDate) {
  console.log(`📊 Comparison started for ${symbol}`);
  const timeframe = "1h";
  const start = BigInt(new Date(startDate).getTime());
  const end = BigInt(new Date(endDate).getTime());

  // 1️⃣ Load indicator & candle data
  const [indicators, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: { symbol, timeframe, time: { gte: start, lte: end } },
      orderBy: { time: "asc" },
    }),
    prisma.candle.findMany({
      where: { symbol, timeframe, time: { gte: start, lte: end } },
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  if (!indicators.length || !candles.length)
    return {
      success: false,
      message: `No data found for ${symbol} in the specified period`,
    };

  const data = mergeIndicatorsWithCandles(indicators, candles);
  if (!data.length)
    return { success: false, message: "Unable to merge indicator data" };

  // 2️⃣ Load best multi-indicator weights
  const { weights: bestWeights, source: weightSource } = await getBestWeights(
    symbol,
    timeframe
  );

  console.log(`✅ Using ${weightSource} weights`, bestWeights);

  // 3️⃣ Run single indicator backtests
  console.log("🚀 Running single indicator backtests...");
  const singleResults = await backtestAllIndicators(data, { fastMode: true });

  // 4️⃣ Run multi indicator backtest
  console.log("🚀 Running multi indicator backtest...");
  const multiResult = await backtestWithWeights(data, bestWeights, {
    fastMode: true,
  });

  // 5️⃣ Format results
  const singleFormatted = {};
  if (singleResults.results) {
    for (const r of singleResults.results) {
      if (r.success && r.testPerformance) {
        singleFormatted[r.indicator] = cleanResult({
          ...r.testPerformance,
        });
      }
    }
  }

  const multiFormatted = cleanResult(multiResult);

  // 6️⃣ Identify best single indicator
  const bestSingle = singleResults.results
    ?.filter((r) => r.success && r.testPerformance)
    .reduce(
      (best, cur) =>
        cur.testPerformance.roi > (best?.testPerformance?.roi ?? -Infinity)
          ? cur
          : best,
      null
    );

  const bestSingleData = bestSingle
    ? {
        indicator: bestSingle.indicator,
        roi: bestSingle.testPerformance.roi,
        winRate: bestSingle.testPerformance.winRate,
        maxDrawdown: bestSingle.testPerformance.maxDrawdown,
        trades: bestSingle.testPerformance.trades,
      }
    : null;

  // 7️⃣ Compute Sharpe & Sortino for multi
  const returns = (multiResult.equityCurve || [])
    .slice(1)
    .map(
      (v, i) => (v - multiResult.equityCurve[i]) / multiResult.equityCurve[i]
    );

  multiFormatted.sharpeRatio = +calcSharpe(returns).toFixed(2);
  multiFormatted.sortinoRatio = +calcSortino(returns).toFixed(2);

  // 8️⃣ Comparative analysis
  const startObj = new Date(Number(candles[0].time));
  const endObj = new Date(Number(candles[candles.length - 1].time));
  const days = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

  const multiBeats = bestSingleData
    ? multiFormatted.roi > bestSingleData.roi
    : false;

  const analysis = {
    periodDays: days,
    candles: candles.length,
    dataPoints: data.length,
    bestSingle: bestSingleData,
    multiBeatsBestSingle: multiBeats,
    roiDifference: bestSingleData
      ? +(multiFormatted.roi - bestSingleData.roi).toFixed(2)
      : null,
    winRateComparison: bestSingleData
      ? {
          multi: multiFormatted.winRate,
          bestSingle: bestSingleData.winRate,
          difference: +(
            multiFormatted.winRate - bestSingleData.winRate
          ).toFixed(2),
        }
      : null,
  };

  console.log("✅ Comparison finished successfully");
  console.log(
    `Best single: ${bestSingleData?.indicator} (${bestSingleData?.roi}%)`
  );
  console.log(`Multi-indicator ROI: ${multiFormatted.roi}%`);

  // 9️⃣ Unified return object
  return {
    success: true,
    symbol,
    timeframe,
    period: {
      start: startObj.toISOString(),
      end: endObj.toISOString(),
      days,
    },
    comparison: {
      single: singleFormatted,
      multi: multiFormatted,
      bestStrategy: multiBeats ? "multi" : "single",
    },
    bestWeights,
    weightSource,
    analysis,
    timestamp: new Date().toISOString(),
  };
}
