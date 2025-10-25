/**
 * 📊 COMPARISON SERVICE (Clean Architecture)
 * ---------------------------------------------------------------
 * Based on Academic Standards: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * Purpose: Compare multi-indicator ensemble strategy performance
 * against best single-indicator baseline to validate academic hypothesis.
 *
 * Clean Architecture Principles:
 * - Pure business logic (no HTTP handling)
 * - Reusable across different modules
 * - Consistent data structures
 * - Proper error handling with descriptive messages
 * - Helper utilities for modularity
 */

import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../indicators/indicator-backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/multiIndicator-backtest.service.js";

/* ==========================================================
   🛠️ HELPER UTILITIES
========================================================== */

/**
 * Clean and validate result object
 * Ensures metrics are within realistic ranges and properly formatted
 */
function cleanResult(result) {
  if (!result) return null;

  const cleaned = {
    roi: +Number(result.roi || 0).toFixed(2),
    winRate: +Number(result.winRate || 0).toFixed(2),
    maxDrawdown: +Number(result.maxDrawdown || 0).toFixed(2),
    trades: result.trades || 0,
  };

  // Add finalCapital if present
  if (result.finalCapital != null) {
    cleaned.finalCapital = +Number(result.finalCapital).toFixed(2);
  }

  // Add sharpeRatio if present
  if (result.sharpeRatio != null) {
    cleaned.sharpeRatio = +Number(result.sharpeRatio).toFixed(2);
  }

  // Add sortinoRatio if present
  if (result.sortinoRatio != null) {
    cleaned.sortinoRatio = +Number(result.sortinoRatio).toFixed(2);
  }

  // Validate realistic ranges for academic research
  if (cleaned.roi < -100) cleaned.roi = -100.0;
  if (cleaned.roi > 500) cleaned.roi = 500.0;
  if (cleaned.winRate < 0) cleaned.winRate = 0.0;
  if (cleaned.winRate > 100) cleaned.winRate = 100.0;
  if (cleaned.maxDrawdown < 0) cleaned.maxDrawdown = 0.0;
  if (cleaned.maxDrawdown > 100) cleaned.maxDrawdown = 100.0;

  return cleaned;
}

/**
 * Calculate Profit Factor
 * Profit Factor = Gross Profit / Gross Loss
 * A value > 1 indicates profitable strategy
 */
function calculateProfitFactor(trades) {
  if (!trades || trades.length === 0) return 0;

  const grossProfit = trades
    .filter((t) => t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0);

  const grossLoss = Math.abs(
    trades.filter((t) => t.profit < 0).reduce((sum, t) => sum + t.profit, 0)
  );

  return grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : 0;
}

/**
 * Calculate Maximum Consecutive Losses
 * Important risk metric for understanding worst-case scenarios
 */
function calculateMaxConsecutiveLosses(trades) {
  if (!trades || trades.length === 0) return 0;

  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (const trade of trades) {
    if (!trade.isWin) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return maxConsecutive;
}

/**
 * Fetch best weights from database with fallback to equal weights
 */
async function getBestWeights(symbol, timeframe) {
  const bestWeightRow = await prisma.indicatorWeight.findFirst({
    where: { symbol, timeframe },
    orderBy: [{ roi: "desc" }, { updatedAt: "desc" }],
  });

  const defaultWeightKeys = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];

  const defaultWeights = Object.fromEntries(
    defaultWeightKeys.map((k) => [k, 1])
  );

  if (
    !bestWeightRow?.weights ||
    Object.keys(bestWeightRow.weights).length === 0
  ) {
    return {
      weights: defaultWeights,
      source: "default",
    };
  }

  return {
    weights: bestWeightRow.weights,
    source: "database",
    optimizedAt: bestWeightRow.updatedAt,
  };
}

/**
 * Merge candle prices into indicator data
 */
function mergeIndicatorsWithCandles(indicators, candles) {
  const priceMap = new Map(candles.map((c) => [c.time.toString(), c.close]));

  const mergedData = indicators
    .map((row) => ({
      ...row,
      close: priceMap.get(row.time.toString()),
    }))
    .filter((row) => row.close != null);

  return mergedData;
}

/* ==========================================================
   🎯 MAIN COMPARISON SERVICE
========================================================== */

/**
 * Compare Multi-Indicator Strategy vs Single-Indicator Strategies
 *
 * This function implements the core academic methodology:
 * 1. Load same dataset for both strategies (fairness)
 * 2. Run all single-indicator backtests
 * 3. Run multi-indicator ensemble backtest with optimized weights
 * 4. Compare results and determine if multi-indicator beats best single
 *
 * @param {string} symbol - Trading pair (e.g., "BTC-USD")
 * @param {string} startDate - Start date in ISO format
 * @param {string} endDate - End date in ISO format
 * @returns {Object} Comparison results with unified schema
 */
export async function compareStrategies(symbol, startDate, endDate) {
  console.log(`📊 Comparison started for ${symbol}`);
  console.log(`📅 Period: ${startDate} → ${endDate}`);

  const timeframe = "1h";
  const start = BigInt(new Date(startDate).getTime());
  const end = BigInt(new Date(endDate).getTime());

  try {
    // 1️⃣ Load indicators and candles from database
    console.log("📥 Loading data from database...");
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

    // Validate data exists
    if (!indicators.length || !candles.length) {
      console.warn("❌ No data found for the specified period");
      return {
        success: false,
        message: `No data found for ${symbol} in the specified period`,
      };
    }

    console.log(
      `✅ Loaded ${indicators.length} indicators, ${candles.length} candles`
    );

    // 2️⃣ Merge indicators with candle prices
    const data = mergeIndicatorsWithCandles(indicators, candles);

    if (!data.length) {
      console.warn("❌ No merged data after combining indicators and candles");
      return {
        success: false,
        message: "Unable to merge indicator and candle data",
      };
    }

    console.log(`✅ Merged dataset: ${data.length} complete data points`);

    // 3️⃣ Fetch best weights for multi-indicator strategy
    console.log("🔍 Fetching optimized weights...");
    const { weights: bestWeights, source: weightSource } = await getBestWeights(
      symbol,
      timeframe
    );

    console.log(`✅ Using ${weightSource} weights:`, bestWeights);

    // 4️⃣ Run backtests using same dataset (fairness requirement)
    console.log("\n🚀 Running single-indicator backtests...");
    const singleResults = await backtestAllIndicators(data, { fastMode: true });

    console.log("\n🚀 Running multi-indicator backtest...");
    const multiResult = await backtestWithWeights(data, bestWeights, {
      fastMode: true,
    });

    // 5️⃣ Format single-indicator results
    const singleFormatted = {};
    if (singleResults.results) {
      for (const result of singleResults.results) {
        if (result.success && result.testPerformance) {
          singleFormatted[result.indicator] = cleanResult({
            roi: result.testPerformance.roi,
            winRate: result.testPerformance.winRate,
            maxDrawdown: result.testPerformance.maxDrawdown,
            trades: result.testPerformance.trades,
            finalCapital: result.testPerformance.finalCapital,
          });
        }
      }
    }

    // 6️⃣ Format multi-indicator results
    const multiFormatted = cleanResult({
      roi: multiResult.roi,
      winRate: multiResult.winRate,
      maxDrawdown: multiResult.maxDrawdown,
      trades: multiResult.trades,
      finalCapital: multiResult.finalCapital,
    });

    // 7️⃣ Determine best single indicator
    const bestSingleIndicator = singleResults.results
      ?.filter((r) => r.success && r.testPerformance)
      .reduce((best, current) => {
        const currentRoi = current.testPerformance.roi;
        const bestRoi = best?.testPerformance?.roi ?? -Infinity;
        return currentRoi > bestRoi ? current : best;
      }, null);

    const bestSingle = bestSingleIndicator
      ? {
          indicator: bestSingleIndicator.indicator,
          roi: bestSingleIndicator.testPerformance.roi,
          winRate: bestSingleIndicator.testPerformance.winRate,
          maxDrawdown: bestSingleIndicator.testPerformance.maxDrawdown,
          trades: bestSingleIndicator.testPerformance.trades,
        }
      : null;

    // 8️⃣ Calculate analysis metrics
    const startDateObj = new Date(Number(candles[0].time));
    const endDateObj = new Date(Number(candles[candles.length - 1].time));
    const periodDays = Math.ceil(
      (endDateObj - startDateObj) / (1000 * 60 * 60 * 24)
    );

    const multiBeatsBestSingle = bestSingle
      ? multiFormatted.roi > bestSingle.roi
      : false;

    const analysis = {
      periodDays,
      candles: candles.length,
      dataPoints: data.length,
      bestSingle: bestSingle
        ? {
            indicator: bestSingle.indicator,
            roi: bestSingle.roi,
            winRate: bestSingle.winRate,
            maxDrawdown: bestSingle.maxDrawdown,
            trades: bestSingle.trades,
          }
        : null,
      multiBeatsBestSingle,
      roiDifference: bestSingle
        ? +(multiFormatted.roi - bestSingle.roi).toFixed(2)
        : null,
      winRateComparison: bestSingle
        ? {
            multi: multiFormatted.winRate,
            bestSingle: bestSingle.winRate,
            difference: +(multiFormatted.winRate - bestSingle.winRate).toFixed(
              2
            ),
          }
        : null,
    };

    console.log("\n✅ Comparison completed successfully");
    console.log(
      `📊 Best Single: ${bestSingle?.indicator} (${bestSingle?.roi}%)`
    );
    console.log(`📊 Multi-Indicator: ${multiFormatted.roi}%`);
    console.log(
      `🎯 Multi beats single: ${multiBeatsBestSingle ? "YES ✅" : "NO ❌"}`
    );

    // 9️⃣ Return unified response schema
    return {
      success: true,
      symbol,
      timeframe,
      period: {
        start: startDateObj.toISOString(),
        end: endDateObj.toISOString(),
        days: periodDays,
      },
      comparison: {
        single: singleFormatted,
        multi: multiFormatted,
        bestStrategy: multiBeatsBestSingle ? "multi" : "single",
      },
      bestWeights,
      weightSource,
      analysis,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Comparison Error:", error);
    throw new Error(`Comparison failed: ${error.message}`);
  }
}
