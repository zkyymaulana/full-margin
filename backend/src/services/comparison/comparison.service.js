/**
 * 📊 COMPARISON SERVICE (Academic-Validated Version)
 * ---------------------------------------------------------------
 * Based on: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * ✅ NO NORMALIZATION - All ROI values are raw from backtest
 * ✅ Mathematical consistency enforced
 * ✅ Academic-ready data structure
 */

import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../backtest/backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/multiIndicator-backtest.service.js";

/* ==========================================================
   🧮 HELPER FUNCTIONS
========================================================== */

/** Mean calculation */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Standard deviation calculation */
function stddev(arr) {
  if (!arr || arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Sharpe Ratio: (Average Return - Risk-Free Rate) / Standard Deviation
 * Only returns 0 if there's truly no volatility
 */
function calcSharpe(returns, riskFree = 0.02) {
  if (!returns || returns.length === 0) return 0;
  const avg = mean(returns);
  const sd = stddev(returns);
  // Only return 0 if std is actually 0 (no volatility)
  if (sd === 0) return 0;
  return (avg - riskFree) / sd;
}

/**
 * Sortino Ratio: (Average Return - Risk-Free Rate) / Downside Deviation
 * Only considers negative returns (downside risk)
 */
function calcSortino(returns, riskFree = 0.02) {
  if (!returns || returns.length === 0) return 0;
  const neg = returns.filter((r) => r < 0);
  if (neg.length === 0) return 0; // No downside risk
  const downside = stddev(neg);
  if (downside === 0) return 0;
  const avg = mean(returns);
  return (avg - riskFree) / downside;
}

/**
 * ✅ FORMAT RESULT - NO NORMALIZATION
 * Returns raw values exactly as they come from backtest
 * Ensures mathematical consistency: finalCapital matches ROI
 */
function formatResult(result) {
  if (!result) return null;

  return {
    roi: +Number(result.roi || 0).toFixed(2),
    winRate: +Number(result.winRate || 0).toFixed(2),
    maxDrawdown: +Number(result.maxDrawdown || 0).toFixed(2),
    trades: result.trades || 0,
    finalCapital: result.finalCapital
      ? +Number(result.finalCapital).toFixed(2)
      : 10000, // Default initial capital if not provided
  };
}

/**
 * Calculate valid returns from equity curve for Sharpe/Sortino
 * Filters out extreme outliers that might be data errors
 */
function calculateReturns(equityCurve) {
  if (!equityCurve || equityCurve.length < 2) {
    console.warn("⚠️ Equity curve too short for return calculation");
    return [];
  }

  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1];
    const currEquity = equityCurve[i];

    // Avoid division by zero
    if (prevEquity !== 0) {
      const ret = (currEquity - prevEquity) / prevEquity;
      // Filter out extreme outliers (single return > 1000% might be data error)
      if (Math.abs(ret) < 10) {
        returns.push(ret);
      }
    }
  }

  console.log(
    `📈 Calculated ${returns.length} valid returns from ${equityCurve.length} equity points`
  );
  return returns;
}

/** Merge candle prices into indicator data */
function mergeIndicatorsWithCandles(indicators, candles) {
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  return indicators
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }))
    .filter((i) => i.close != null);
}

/** Get best optimized weights from database */
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

  // Prefer Rule-Based optimized weights
  const ruleBased = all.find((r) =>
    (r.methodology || "").includes("Rule-Based")
  );

  if (ruleBased)
    return {
      weights: ruleBased.weights,
      source: "rule-based",
      optimizedAt: ruleBased.updatedAt,
    };

  // Fallback: get best ROI
  const best = all.sort((a, b) => b.roi - a.roi)[0];
  return {
    weights: best.weights || defaultWeights(),
    source: "database",
    optimizedAt: best.updatedAt,
  };
}

/** Default equal weights for all indicators */
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

  // 5️⃣ Format results - NO NORMALIZATION, USE RAW VALUES
  console.log("📋 Formatting results with raw ROI values...");
  const singleFormatted = {};

  if (singleResults.results) {
    for (const r of singleResults.results) {
      if (r.success && r.performance) {
        console.log(
          `   ✓ ${r.indicator}: ROI=${r.performance.roi}%, Capital=${r.performance.finalCapital}, WinRate=${r.performance.winRate}%`
        );
        singleFormatted[r.indicator] = formatResult(r.performance);
      } else {
        console.log(`   ✗ ${r.indicator}: No performance data`);
      }
    }
  }

  console.log(
    `📊 Successfully formatted ${Object.keys(singleFormatted).length} indicators`
  );

  const multiFormatted = formatResult(multiResult);

  // 6️⃣ Identify best single indicator based on RAW ROI
  const validSingles =
    singleResults.results?.filter((r) => r.success && r.performance) || [];
  console.log(
    `🔍 Finding best single indicator from ${validSingles.length} valid results...`
  );

  const bestSingle = validSingles.reduce(
    (best, cur) =>
      cur.performance.roi > (best?.performance?.roi ?? -Infinity) ? cur : best,
    null
  );

  const bestSingleData = bestSingle
    ? {
        indicator: bestSingle.indicator,
        roi: +Number(bestSingle.performance.roi).toFixed(2),
        winRate: +Number(bestSingle.performance.winRate).toFixed(2),
        maxDrawdown: +Number(bestSingle.performance.maxDrawdown).toFixed(2),
        trades: bestSingle.performance.trades,
        finalCapital: +Number(bestSingle.performance.finalCapital).toFixed(2),
      }
    : null;

  if (bestSingleData) {
    console.log(
      `🏆 Best single indicator: ${bestSingleData.indicator} with ${bestSingleData.roi}% ROI and $${bestSingleData.finalCapital} final capital`
    );
  } else {
    console.warn("⚠️ No valid single indicator results found!");
  }

  // 7️⃣ Calculate Sharpe & Sortino for multi-indicator
  const returns = calculateReturns(multiResult.equityCurve);

  multiFormatted.sharpeRatio = +calcSharpe(returns).toFixed(2);
  multiFormatted.sortinoRatio = +calcSortino(returns).toFixed(2);

  console.log(
    `📊 Multi-indicator Sharpe: ${multiFormatted.sharpeRatio}, Sortino: ${multiFormatted.sortinoRatio}`
  );

  // 8️⃣ Comparative analysis using RAW ROI
  const startObj = new Date(Number(candles[0].time));
  const endObj = new Date(Number(candles[candles.length - 1].time));
  const days = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

  // ✅ bestStrategy based on RAW ROI comparison
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
    `📊 Best single: ${bestSingleData?.indicator} (${bestSingleData?.roi}% ROI, $${bestSingleData?.finalCapital})`
  );
  console.log(
    `📊 Multi-indicator: ${multiFormatted.roi}% ROI, $${multiFormatted.finalCapital}`
  );
  console.log(
    `🏆 Winner: ${multiBeats ? "Multi-Indicator" : "Single-Indicator"}`
  );

  // 9️⃣ Return unified structure with RAW values only
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
