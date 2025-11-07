import { prisma } from "../../lib/prisma.js";
import {
  sendSingleIndicatorSignal,
  sendMultiIndicatorSignal,
} from "../telegram/telegram.service.js";
import {
  calculateIndividualSignals,
  calculateWeightedSignal,
} from "../../utils/indicator.utils.js";
import { fetchLatestIndicatorData } from "../../utils/db.utils.js";

/**
 * 🎯 SIGNAL DETECTION SERVICE (CLEAN VERSION)
 * -------------------------------------------
 * Deteksi sinyal trading dari indikator dan kirim notifikasi
 * - Single Indicator Signals
 * - Multi-Indicator Signals (berdasarkan optimized weights)
 */

const HOLD_THRESHOLD = 0.15;

/* =========================================================
   🔍 SINGLE INDICATOR SIGNAL DETECTION
========================================================= */
export async function detectAndNotifySingleIndicatorSignals(
  symbol,
  timeframe = "1h"
) {
  try {
    console.log(`🔍 Detecting single indicator signals for ${symbol}...`);

    const [indicator, candle] = await Promise.all([
      prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
      prisma.candle.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      }),
    ]);

    if (!indicator || !candle) return { success: false, reason: "no_data" };

    const price = candle.close;
    const signals = [];

    const checkSignal = (key, value, signalValue) => {
      if (signalValue === "buy" || signalValue === "sell") {
        signals.push({ indicator: key, signal: signalValue, value });
      }
    };

    // ✅ Standardized MACD naming for consistency
    checkSignal("RSI", indicator.rsi, indicator.rsiSignal);
    checkSignal("MACD", indicator.macd, indicator.macdSignal);
    checkSignal("SMA", indicator.sma20, indicator.smaSignal);
    checkSignal("EMA", indicator.ema20, indicator.emaSignal);

    for (const sig of signals) {
      await sendSingleIndicatorSignal({
        symbol,
        indicator: sig.indicator,
        signal: sig.signal,
        price,
        indicatorValue: sig.value,
        timeframe,
      });
      console.log(`✅ Sent ${sig.indicator} ${sig.signal} for ${symbol}`);
    }

    return { success: true, signalsDetected: signals.length };
  } catch (err) {
    console.error(`❌ Error detecting signals for ${symbol}:`, err.message);
    return { success: false, error: err.message };
  }
}

/* =========================================================
   🎯 MULTI INDICATOR SIGNAL DETECTION
========================================================= */
export async function detectAndNotifyMultiIndicatorSignals(
  symbol,
  timeframe = "1h"
) {
  try {
    console.log(`🎯 Detecting multi-indicator signals for ${symbol}...`);

    const latestWeights = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (!latestWeights) return { success: false, reason: "no_weights" };

    const { indicator, prevIndicator, candle } = await fetchLatestIndicatorData(
      symbol,
      timeframe
    );
    if (!indicator || !candle) return { success: false, reason: "no_data" };

    const current = { ...indicator, close: candle.close };
    const prev = prevIndicator ? { ...prevIndicator } : null;

    const signals = calculateIndividualSignals(current, prev);
    const { normalized, signal } = calculateWeightedSignal(
      signals,
      latestWeights.weights,
      HOLD_THRESHOLD
    );

    if (signal === "neutral") {
      console.log(
        `⚪ Neutral signal for ${symbol} (score: ${normalized.toFixed(2)})`
      );
      return { success: true, signal: "neutral", score: normalized };
    }

    const result = await sendMultiIndicatorSignal({
      symbol,
      signal,
      price: candle.close,
      activeIndicators: Object.entries(latestWeights.weights).map(([k, w]) => ({
        name: k,
        weight: w,
      })),
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

    if (result.success)
      console.log(`✅ Sent ${signal.toUpperCase()} signal for ${symbol}`);
    return { success: true, signal, score: normalized };
  } catch (err) {
    console.error(
      `❌ Error detecting multi-indicator signals for ${symbol}:`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

/* =========================================================
   🔄 DETECT SIGNALS FOR ALL SYMBOLS
========================================================= */
export async function detectAndNotifyAllSymbols(symbols, mode = "both") {
  console.log(
    `🔄 Detecting signals for ${symbols.length} symbols (mode: ${mode})...`
  );

  const results = {
    single: { success: 0, failed: 0 },
    multi: { success: 0, failed: 0, neutral: 0, noWeights: 0 },
  };

  for (const symbol of symbols) {
    try {
      if (mode === "single" || mode === "both") {
        const r = await detectAndNotifySingleIndicatorSignals(symbol);
        r.success ? results.single.success++ : results.single.failed++;
        await new Promise((r) => setTimeout(r, 400));
      }

      if (mode === "multi" || mode === "both") {
        const r = await detectAndNotifyMultiIndicatorSignals(symbol);
        if (r.reason === "no_weights") results.multi.noWeights++;
        else if (r.signal === "neutral") results.multi.neutral++;
        else if (r.success) results.multi.success++;
        else results.multi.failed++;
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) {
      console.error(`❌ Error processing ${symbol}:`, err.message);
      results.multi.failed++;
    }
  }

  console.log("📊 Detection Summary:", results);
  return results;
}

/* =========================================================
   🧠 CHECK & OPTIMIZE WEIGHTLESS COINS
========================================================= */
export async function autoOptimizeCoinsWithoutWeights(
  symbols,
  timeframe = "1h"
) {
  const needs = [];
  for (const symbol of symbols) {
    const existing = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
    });
    if (!existing) {
      const count = await prisma.candle.count({ where: { symbol, timeframe } });
      if (count >= 1000) needs.push(symbol);
      else console.log(`⏭️ ${symbol}: Only ${count}/1000 candles`);
    }
  }

  if (!needs.length) return console.log("✅ All coins optimized.");

  console.log(`🎯 Coins needing optimization: ${needs.join(", ")}`);
  return { count: needs.length, needs };
}

export default {
  detectAndNotifySingleIndicatorSignals,
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
  autoOptimizeCoinsWithoutWeights,
};
