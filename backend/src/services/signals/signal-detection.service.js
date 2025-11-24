import { prisma } from "../../lib/prisma.js";
import { sendMultiIndicatorSignal } from "../telegram/telegram.service.js";
import {
  calculateIndividualSignals,
  calculateWeightedSignal,
} from "../../utils/indicator.utils.js";
import { fetchLatestIndicatorData } from "../../utils/db.utils.js";

/**
 * 🎯 SIGNAL DETECTION SERVICE (MULTI-INDICATOR ONLY)
 * ---------------------------------------------------
 * Deteksi sinyal trading dari multi-indicator dan kirim notifikasi
 * - ONLY Multi-Indicator Signals (berdasarkan optimized weights)
 * - Single Indicator signals REMOVED
 *
 * 📚 Threshold = 0 (sesuai jurnal, tanpa hold zone)
 */

/* =========================================================
   🎯 MULTI INDICATOR SIGNAL DETECTION (REFACTORED)
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

    // ✅ Ambil strength dari calculateWeightedSignal (single source of truth)
    const { normalized, signal, strength } = calculateWeightedSignal(
      signals,
      latestWeights.weights
    );

    // ✅ Log rinci untuk debugging
    console.log(`📊 [MultiIndicator] ${symbol} weighted result:`, {
      signal: signal.toUpperCase(),
      strength: strength.toFixed(3),
      normalized: normalized.toFixed(3),
      price: candle.close.toFixed(2),
    });

    if (signal === "neutral") {
      console.log(
        `⚪ ${symbol} NEUTRAL | strength: ${strength.toFixed(3)} | score: ${normalized.toFixed(3)}`
      );
      return {
        success: true,
        signal: "neutral",
        score: normalized,
        strength: 0,
      }; // ✅ Force strength = 0 untuk neutral
    }

    // ✅ Kirim ke Telegram dengan strength yang konsisten
    const result = await sendMultiIndicatorSignal({
      symbol,
      signal,
      price: candle.close,
      strength, // ✅ Kirim strength ke Telegram
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

    if (result.success) {
      console.log(
        `✅ ${symbol} ${signal.toUpperCase()} | strength: ${strength.toFixed(3)} | score: ${normalized.toFixed(3)}`
      );
    }

    return { success: true, signal, score: normalized, strength };
  } catch (err) {
    console.error(
      `❌ Error detecting multi-indicator signals for ${symbol}:`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

/* =========================================================
   🔄 DETECT SIGNALS FOR ALL SYMBOLS (MULTI-INDICATOR ONLY)
========================================================= */
export async function detectAndNotifyAllSymbols(symbols, mode = "multi") {
  // Force mode to always be "multi"
  mode = "multi";

  console.log(
    `🔄 Detecting multi-indicator signals for ${symbols.length} symbols...`
  );

  const results = {
    multi: { success: 0, failed: 0, neutral: 0, noWeights: 0 },
  };

  for (const symbol of symbols) {
    try {
      const r = await detectAndNotifyMultiIndicatorSignals(symbol);
      if (r.reason === "no_weights") results.multi.noWeights++;
      else if (r.signal === "neutral") results.multi.neutral++;
      else if (r.success) results.multi.success++;
      else results.multi.failed++;
      await new Promise((resolve) => setTimeout(resolve, 400));
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
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
  autoOptimizeCoinsWithoutWeights,
};
