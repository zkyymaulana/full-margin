import { prisma } from "../../lib/prisma.js";
import {
  sendSingleIndicatorSignal,
  sendMultiIndicatorSignal,
} from "../telegram/telegram.service.js";
import {
  calculateIndividualSignals,
  scoreSignal,
} from "../multiIndicator/multiIndicator-analyzer.service.js";

/**
 * 🎯 SIGNAL DETECTION SERVICE
 * ---------------------------
 * Deteksi sinyal trading dari indikator dan kirim notifikasi
 * - Single Indicator Signals
 * - Multi-Indicator Signals (dengan optimized weights)
 */

const HOLD_THRESHOLD = 0.15; // Threshold untuk BUY/SELL decision

/**
 * 🔍 Deteksi dan kirim sinyal single indicator untuk symbol
 */
export async function detectAndNotifySingleIndicatorSignals(
  symbol,
  timeframe = "1h"
) {
  try {
    console.log(`🔍 Detecting single indicator signals for ${symbol}...`);

    // Get latest indicator data
    const [latestIndicator, latestCandle] = await Promise.all([
      prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
      prisma.candle.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
    ]);

    if (!latestIndicator || !latestCandle) {
      console.log(`⚠️ No data found for ${symbol}`);
      return { success: false, reason: "no_data" };
    }

    const price = latestCandle.close;
    const signals = [];

    // Check RSI signal
    if (latestIndicator.rsi !== null) {
      const rsiSignal = latestIndicator.rsiSignal || "neutral";
      if (rsiSignal === "buy" || rsiSignal === "sell") {
        signals.push({
          indicator: "RSI",
          signal: rsiSignal,
          value: latestIndicator.rsi,
        });
      }
    }

    // Check MACD signal
    if (latestIndicator.macdSignal) {
      const macdSignal = latestIndicator.macdSignal || "neutral";
      if (macdSignal === "buy" || macdSignal === "sell") {
        signals.push({
          indicator: "MACD",
          signal: macdSignal,
          value: latestIndicator.macd,
        });
      }
    }

    // Check SMA signal
    if (latestIndicator.smaSignal) {
      const smaSignal = latestIndicator.smaSignal || "neutral";
      if (smaSignal === "buy" || smaSignal === "sell") {
        signals.push({
          indicator: "SMA",
          signal: smaSignal,
          value: latestIndicator.sma20,
        });
      }
    }

    // Check EMA signal
    if (latestIndicator.emaSignal) {
      const emaSignal = latestIndicator.emaSignal || "neutral";
      if (emaSignal === "buy" || emaSignal === "sell") {
        signals.push({
          indicator: "EMA",
          signal: emaSignal,
          value: latestIndicator.ema20,
        });
      }
    }

    // Send notifications for each signal
    const sentCount = 0;
    for (const sig of signals) {
      const result = await sendSingleIndicatorSignal({
        symbol,
        indicator: sig.indicator,
        signal: sig.signal,
        price,
        indicatorValue: sig.value,
        timeframe,
      });

      if (result.success) {
        console.log(
          `✅ Sent ${sig.indicator} ${sig.signal} signal for ${symbol}`
        );
      }
    }

    return {
      success: true,
      signalsDetected: signals.length,
      signalsSent: sentCount,
    };
  } catch (error) {
    console.error(`❌ Error detecting signals for ${symbol}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 🎯 Deteksi dan kirim sinyal multi-indicator untuk symbol
 */
export async function detectAndNotifyMultiIndicatorSignals(
  symbol,
  timeframe = "1h"
) {
  try {
    console.log(`🎯 Detecting multi-indicator signals for ${symbol}...`);

    // Get latest optimized weights
    const latestWeights = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (!latestWeights) {
      console.log(`⚠️ No optimized weights found for ${symbol}`);
      return { success: false, reason: "no_weights" };
    }

    // Get latest indicator data
    const [latestIndicator, prevIndicator, latestCandle] = await Promise.all([
      prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
      prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        skip: 1,
      }),
      prisma.candle.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
    ]);

    if (!latestIndicator || !latestCandle) {
      console.log(`⚠️ No indicator data found for ${symbol}`);
      return { success: false, reason: "no_data" };
    }

    // Transform indicator data
    const currentData = {
      close: latestCandle.close,
      sma20: latestIndicator.sma20,
      sma50: latestIndicator.sma50,
      sma200: latestIndicator.sma200,
      ema20: latestIndicator.ema20,
      ema50: latestIndicator.ema50,
      ema200: latestIndicator.ema200,
      rsi: latestIndicator.rsi,
      macd: latestIndicator.macd,
      macdSignal: latestIndicator.macdSignalLine,
      macdHist: latestIndicator.macdHist,
      bbUpper: latestIndicator.bbUpper,
      bbMiddle: latestIndicator.bbMiddle,
      bbLower: latestIndicator.bbLower,
      stochK: latestIndicator.stochK,
      stochD: latestIndicator.stochD,
      stochRsiK: latestIndicator.stochRsiK,
      stochRsiD: latestIndicator.stochRsiD,
      psar: latestIndicator.psar,
    };

    const prevData = prevIndicator
      ? {
          close: prevIndicator.close,
          sma20: prevIndicator.sma20,
          sma50: prevIndicator.sma50,
          ema20: prevIndicator.ema20,
          ema50: prevIndicator.ema50,
          macdHist: prevIndicator.macdHist,
          bbUpper: prevIndicator.bbUpper,
          bbLower: prevIndicator.bbLower,
          stochK: prevIndicator.stochK,
          stochD: prevIndicator.stochD,
          stochRsiK: prevIndicator.stochRsiK,
          stochRsiD: prevIndicator.stochRsiD,
          psar: prevIndicator.psar,
        }
      : null;

    // Calculate individual signals
    const signals = calculateIndividualSignals(currentData, prevData);

    // Calculate weighted score
    const weights = latestWeights.weights;
    const indicators = Object.keys(weights);

    let combinedScore = 0;
    let totalWeight = 0;
    const activeIndicators = [];

    indicators.forEach((ind) => {
      const weight = weights[ind];
      if (weight > 0) {
        const signal = signals[ind];
        const signalValue = scoreSignal(signal);
        combinedScore += weight * signalValue;
        totalWeight += weight;
        activeIndicators.push({ name: ind, weight });
      }
    });

    const normalizedScore = totalWeight > 0 ? combinedScore / totalWeight : 0;

    // Determine signal
    let finalSignal = "neutral";
    if (normalizedScore > HOLD_THRESHOLD) {
      finalSignal = "buy";
    } else if (normalizedScore < -HOLD_THRESHOLD) {
      finalSignal = "sell";
    }

    // Only send notification if signal is BUY or SELL
    if (finalSignal !== "neutral") {
      const result = await sendMultiIndicatorSignal({
        symbol,
        signal: finalSignal,
        price: latestCandle.close,
        activeIndicators,
        performance: {
          roi: latestWeights.testROI || latestWeights.roi,
          winRate: latestWeights.testWinRate || latestWeights.winRate,
          sharpe: (
            latestWeights.testSharpe ||
            latestWeights.sharpeRatio ||
            0
          ).toFixed(3),
          trades: latestWeights.testTrades || latestWeights.trades,
        },
        timeframe,
      });

      if (result.success) {
        console.log(
          `✅ Sent multi-indicator ${finalSignal} signal for ${symbol}`
        );
        return { success: true, signal: finalSignal, score: normalizedScore };
      }
    } else {
      console.log(
        `⚪ Neutral signal for ${symbol} (score: ${normalizedScore.toFixed(2)})`
      );
    }

    return { success: true, signal: finalSignal, score: normalizedScore };
  } catch (error) {
    console.error(
      `❌ Error detecting multi-indicator signals for ${symbol}:`,
      error.message
    );
    return { success: false, error: error.message };
  }
}

/**
 * 🔄 Deteksi dan kirim sinyal untuk semua symbol aktif
 */
export async function detectAndNotifyAllSymbols(symbols, mode = "both") {
  console.log(
    `🔄 Detecting signals for ${symbols.length} symbols (mode: ${mode})...`
  );

  const results = {
    singleIndicator: { success: 0, failed: 0, neutral: 0 },
    multiIndicator: { success: 0, failed: 0, neutral: 0, needsOptimization: 0 },
  };

  for (const symbol of symbols) {
    try {
      // Single indicator signals
      if (mode === "single" || mode === "both") {
        const singleResult =
          await detectAndNotifySingleIndicatorSignals(symbol);
        if (singleResult.success) {
          results.singleIndicator.success++;
        } else if (singleResult.reason === "no_data") {
          results.singleIndicator.failed++;
        } else {
          results.singleIndicator.neutral++;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Multi-indicator signals
      if (mode === "multi" || mode === "both") {
        const multiResult = await detectAndNotifyMultiIndicatorSignals(symbol);

        if (multiResult.success && multiResult.signal !== "neutral") {
          results.multiIndicator.success++;
        } else if (multiResult.reason === "no_weights") {
          results.multiIndicator.needsOptimization++;
          console.log(`⚠️ ${symbol}: Needs optimization - skipping for now`);
        } else if (multiResult.reason === "no_data") {
          results.multiIndicator.failed++;
        } else {
          results.multiIndicator.neutral++;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ Error processing ${symbol}:`, error.message);
      results.multiIndicator.failed++;
    }
  }

  console.log(`\n📊 SIGNAL DETECTION SUMMARY:`);
  if (mode === "single" || mode === "both") {
    console.log(`   Single Indicator:`);
    console.log(`      ✅ Sent: ${results.singleIndicator.success}`);
    console.log(
      `      ⚪ Neutral/Duplicate: ${results.singleIndicator.neutral}`
    );
    console.log(`      ❌ Failed: ${results.singleIndicator.failed}`);
  }
  if (mode === "multi" || mode === "both") {
    console.log(`   Multi-Indicator:`);
    console.log(`      ✅ Sent: ${results.multiIndicator.success}`);
    console.log(
      `      ⚪ Neutral/Duplicate: ${results.multiIndicator.neutral}`
    );
    console.log(
      `      ⚠️  Needs Optimization: ${results.multiIndicator.needsOptimization}`
    );
    console.log(`      ❌ Failed: ${results.multiIndicator.failed}`);
  }

  return results;
}

/**
 * 🎯 Auto-optimize koin yang belum punya weights (background job)
 */
export async function autoOptimizeCoinsWithoutWeights(
  symbols,
  timeframe = "1h"
) {
  console.log(`\n🔍 Checking for coins without optimized weights...`);

  const coinsNeedingOptimization = [];

  for (const symbol of symbols) {
    const existingWeights = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (!existingWeights) {
      // Check if has enough data (at least 1000 candles)
      const candleCount = await prisma.candle.count({
        where: { symbol, timeframe },
      });

      if (candleCount >= 1000) {
        coinsNeedingOptimization.push(symbol);
      } else {
        console.log(
          `⏭️ ${symbol}: Insufficient data (${candleCount}/1000 candles)`
        );
      }
    }
  }

  if (coinsNeedingOptimization.length === 0) {
    console.log(`✅ All coins already have optimized weights!`);
    return { optimized: 0, failed: 0 };
  }

  console.log(
    `\n🎯 Found ${coinsNeedingOptimization.length} coins needing optimization:`
  );
  console.log(`   ${coinsNeedingOptimization.join(", ")}`);
  console.log(
    `\n⚠️ Note: This is informational only. Please optimize manually via API:`
  );
  coinsNeedingOptimization.forEach((symbol) => {
    console.log(`   POST /api/multiIndicator/${symbol}/optimize-weights`);
  });

  return {
    coinsNeedingOptimization,
    count: coinsNeedingOptimization.length,
  };
}

export default {
  detectAndNotifySingleIndicatorSignals,
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
  autoOptimizeCoinsWithoutWeights,
};
