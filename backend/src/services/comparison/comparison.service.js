/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 COMPARISON SERVICE - MAIN ORCHESTRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Based on: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * ✅ NO NORMALIZATION - All ROI values are raw from backtest
 * ✅ Mathematical consistency enforced
 * ✅ Academic-ready data structure
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TUJUAN MODUL:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Modul ini adalah orchestrator utama untuk fitur comparison strategy.
 * Tanggung jawab:
 * • Validasi input request parameter
 * • Orchestrate tahapan-tahapan backtesting
 * • Koordinasi antara berbagai sub-module (validation, metrics, backtest, data)
 * • Format dan build response object final
 * • Determine best strategy dari 3 alternatif (single, multi, voting)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALUR PROSES BACKTESTING:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1️⃣ VALIDASI PARAMETER
 *    ↓
 * 2️⃣ LOAD DATA (Indicator + Candle dari database)
 *    ↓
 * 3️⃣ MERGE DATA (Indicator + Close Price)
 *    ↓
 * 4️⃣ GET BOBOT (Optimal weights dari database atau default)
 *    ↓
 * 5️⃣ BACKTEST SINGLE INDICATORS (8 individual backtests)
 *    ↓
 * 6️⃣ BACKTEST MULTI-INDICATOR WEIGHTED (execution threshold = 0)
 *    ↓
 * 7️⃣ BACKTEST VOTING STRATEGY (majority voting baseline)
 *    ↓
 * 8️⃣ FORMAT RESULTS (Ensure consistency dan precision)
 *    ↓
 * 9️⃣ CALCULATE METRICS (Sharpe, Sortino untuk voting strategy)
 *    ↓
 * 🔟 COMPARATIVE ANALYSIS (Compare performance 3 strategies)
 *    ↓
 * 1️⃣1️⃣ BUILD RESPONSE (Final JSON structure)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../backtest/backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/index.js";

// Import sub-module functions
import {
  validateComparisonParams,
  handleComparisonError,
} from "./comparison.validation.js";

import {
  calcSharpe,
  calculateReturns,
  formatResult,
} from "./comparison.metrics.js";

import { backtestVotingStrategy } from "./comparison.backtest.js";

import {
  mergeIndicatorsWithCandles,
  getBestWeights,
} from "./comparison.data.js";

/**
 * 🎯 MAIN COMPARISON FUNCTION - Orchestrator Utama
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * TUJUAN:
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Fungsi ini adalah entry point untuk fitur perbandingan strategi trading.
 * Melakukan backtesting pada 3 strategi berbeda dan membandingkan performanya:
 *
 * 1. SINGLE INDICATOR (8 variants)
 *    - Test masing-masing dari 8 technical indicators secara individual
 *    - Hanya menggunakan 1 indicator per backtest
 *    - Baseline termudah untuk comparison
 *
 * 2. MULTI-INDICATOR WEIGHTED
 *    - Kombinasi 8 indicators dengan optimized weights
 *    - Entry saat FinalScore > 0
 *    - Exit saat FinalScore < 0
 *    - Label Strong Buy/Strong Sell (±0.6) dipakai untuk tingkat keyakinan
 *    - Lebih robust dan selective
 *    - Main strategy dari research paper
 *
 * 3. VOTING STRATEGY
 *    - Simple majority voting dari 8 indicators
 *    - Entry ketika BUY votes > SELL votes
 *    - Exit ketika SELL votes > BUY votes
 *    - Lebih agresif, lebih banyak trades
 *    - Baseline pembanding untuk menunjukkan keunggulan weighted approach
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * PARAMETER INPUT:
 * ═════════════════════════════════════════════════════════════════════════════
 *
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * OUTPUT STRUCTURE:
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * {
 *   success: boolean,
 *   symbol: string,
 *   timeframe: string,
 *   period: { start, end, days },
 *   comparison: {
 *     single: { [indicator]: { roi, winRate, maxDrawdown, ... } },
 *     multi: { roi, winRate, finalCapital, maxDrawdown, sharpeRatio },
 *     voting: { roi, winRate, finalCapital, maxDrawdown, sharpeRatio }
 *   },
 *   bestStrategy: { name, roi },
 *   analysis: { periodDays, candles, dataPoints, bestSingle, ... }
 * }
 *
 * ═════════════════════════════════════════════════════════════════════════════
 */
export async function compareStrategies(
  symbol,
  startDate,
  endDate,
  _threshold = 0,
) {
  const executionThreshold = 0;
  // Sesuai metodologi skripsi: rule eksekusi final score menggunakan ambang 0.
  // Parameter threshold sengaja tidak dipakai agar hasil pembandingan tetap apple-to-apple.

  console.log(
    `📊 Comparison started for ${symbol} with execution threshold ${executionThreshold}`,
  );
  const timeframe = "1h";

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1️⃣ VALIDASI PARAMETER
    // ═══════════════════════════════════════════════════════════════════════

    const validation = validateComparisonParams({
      symbol,
      startDate,
      endDate,
    });

    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error.message,
        example: validation.error.example,
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2️⃣ LOAD DATA DARI DATABASE
    // ═══════════════════════════════════════════════════════════════════════

    // ✅ Get coin dan timeframe dari database
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      return {
        success: false,
        message: `Coin ${symbol} not found in database`,
      };
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      return {
        success: false,
        message: `Timeframe ${timeframe} not found in database`,
      };
    }

    const { coinId, timeframeId } = {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    };

    // ✅ Query indicator dan candle data dari database
    const start = BigInt(new Date(startDate).getTime());
    const end = BigInt(new Date(endDate).getTime());

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: { coinId, timeframeId, time: { gte: start, lte: end } },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: { coinId, timeframeId, time: { gte: start, lte: end } },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    if (!indicators.length || !candles.length)
      return {
        success: false,
        message: `No data found for ${symbol} in the specified period`,
      };

    // ═══════════════════════════════════════════════════════════════════════
    // 3️⃣ MERGE DATA (Indicator + Close Price)
    // ═══════════════════════════════════════════════════════════════════════

    const data = mergeIndicatorsWithCandles(indicators, candles);
    if (!data.length)
      return { success: false, message: "Unable to merge indicator data" };

    // ═══════════════════════════════════════════════════════════════════════
    // 4️⃣ GET BOBOT INDIKATOR
    // ═══════════════════════════════════════════════════════════════════════

    const { weights: bestWeights, source: weightSource } = await getBestWeights(
      symbol,
      timeframe,
    );

    console.log(`✅ Using ${weightSource} weights`, bestWeights);

    // ═══════════════════════════════════════════════════════════════════════
    // 5️⃣ BACKTEST SINGLE INDICATORS
    // ═══════════════════════════════════════════════════════════════════════

    console.log("🚀 Running single indicator backtests...");
    const singleResults = await backtestAllIndicators(data, { fastMode: true });

    // ═══════════════════════════════════════════════════════════════════════
    // 6️⃣ BACKTEST MULTI-INDICATOR WEIGHTED
    // ═══════════════════════════════════════════════════════════════════════

    console.log(
      `🚀 Running multi indicator backtest with threshold ${executionThreshold}...`,
    );
    const multiResult = await backtestWithWeights(data, bestWeights, {
      fastMode: true,
      threshold: executionThreshold,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 7️⃣ BACKTEST VOTING STRATEGY
    // ═══════════════════════════════════════════════════════════════════════

    console.log("🚀 Running voting strategy backtest...");
    const votingResult = backtestVotingStrategy(data);

    // ═══════════════════════════════════════════════════════════════════════
    // 8️⃣ FORMAT RESULTS
    // ═══════════════════════════════════════════════════════════════════════

    console.log("📋 Formatting results with raw ROI values...");
    const singleFormatted = {};

    if (singleResults.results) {
      for (const r of singleResults.results) {
        if (r.success && r.performance) {
          console.log(
            `   ✓ ${r.indicator}: ROI=${r.performance.roi}%, Capital=${r.performance.finalCapital}, WinRate=${r.performance.winRate}%`,
          );
          singleFormatted[r.indicator] = formatResult(r.performance);
        } else {
          console.log(`   ✗ ${r.indicator}: No performance data`);
        }
      }
    }

    console.log(
      `📊 Successfully formatted ${Object.keys(singleFormatted).length} indicators`,
    );

    const multiFormatted = formatResult(multiResult);
    const votingFormatted = formatResult(votingResult);

    // ═══════════════════════════════════════════════════════════════════════
    // 9️⃣ HITUNG SHARPE RATIO
    // ═══════════════════════════════════════════════════════════════════════

    // ✅ Voting strategy Sharpe Ratio
    const votingReturns = calculateReturns(votingResult.equityCurve);
    votingFormatted.sharpeRatio = +calcSharpe(votingReturns).toFixed(2);

    console.log(`📊 Multi-indicator Sharpe: ${multiFormatted.sharpeRatio}`);
    console.log(`📊 Voting Strategy Sharpe: ${votingFormatted.sharpeRatio}`);

    // ═══════════════════════════════════════════════════════════════════════
    // 🔟 IDENTIFIKASI BEST SINGLE INDICATOR
    // ═══════════════════════════════════════════════════════════════════════

    const validSingles =
      singleResults.results?.filter((r) => r.success && r.performance) || [];
    console.log(
      `🔍 Finding best single indicator from ${validSingles.length} valid results...`,
    );

    const bestSingle = validSingles.reduce(
      (best, cur) =>
        cur.performance.roi > (best?.performance?.roi ?? -Infinity)
          ? cur
          : best,
      null,
    );

    const bestSingleData = bestSingle
      ? {
          indicator: bestSingle.indicator,
          roi: +Number(bestSingle.performance.roi).toFixed(2),
          winRate: +Number(bestSingle.performance.winRate).toFixed(2),
          maxDrawdown: +Number(bestSingle.performance.maxDrawdown).toFixed(2),
          finalCapital: +Number(bestSingle.performance.finalCapital).toFixed(2),
        }
      : null;

    if (bestSingleData) {
      console.log(
        `🏆 Best single indicator: ${bestSingleData.indicator} with ${bestSingleData.roi}% ROI and $${bestSingleData.finalCapital} final capital`,
      );
    } else {
      console.warn("⚠️ No valid single indicator results found!");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1️⃣1️⃣ DETERMINE BEST STRATEGY
    // ═══════════════════════════════════════════════════════════════════════

    const strategies = [
      { name: "single", roi: bestSingleData?.roi ?? -Infinity },
      { name: "multi", roi: multiFormatted.roi },
      { name: "voting", roi: votingFormatted.roi },
    ];

    const bestStrategy = strategies.reduce((best, cur) =>
      cur.roi > best.roi ? cur : best,
    );

    console.log(`\n🏆 STRATEGY COMPARISON:`);
    console.log(
      `   Single (${bestSingleData?.indicator}): ${bestSingleData?.roi}% ROI, $${bestSingleData?.finalCapital}`,
    );
    console.log(
      `   Multi-Weighted: ${multiFormatted.roi}% ROI, $${multiFormatted.finalCapital}`,
    );
    console.log(
      `   Voting: ${votingFormatted.roi}% ROI, $${votingFormatted.finalCapital}`,
    );
    console.log(`   🏆 Winner: ${bestStrategy.name.toUpperCase()}`);

    // ═══════════════════════════════════════════════════════════════════════
    // BUILD COMPARATIVE ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════

    const startObj = new Date(Number(candles[0].time));
    const endObj = new Date(Number(candles[candles.length - 1].time));
    const days = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

    const analysis = {
      periodDays: days,
      candles: candles.length,
      dataPoints: data.length,
      bestSingle: bestSingleData,
      multiBeatsBestSingle: bestSingleData
        ? multiFormatted.roi > bestSingleData.roi
        : false,
      votingBeatsBestSingle: bestSingleData
        ? votingFormatted.roi > bestSingleData.roi
        : false,
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
      votingComparison: {
        votingROI: votingFormatted.roi,
        multiROI: multiFormatted.roi,
        difference: +(votingFormatted.roi - multiFormatted.roi).toFixed(2),
        votingWinRate: votingFormatted.winRate,
        multiWinRate: multiFormatted.winRate,
      },
    };

    console.log("✅ Comparison finished successfully");

    // ═══════════════════════════════════════════════════════════════════════
    // BUILD FINAL RESPONSE
    // ═══════════════════════════════════════════════════════════════════════

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
        voting: votingFormatted,
      },
      bestStrategy: {
        name: bestStrategy.name,
        roi: bestStrategy.roi,
      },
      analysis,
    };
  } catch (error) {
    const { statusCode, response } = handleComparisonError(error);
    return response;
  }
}
