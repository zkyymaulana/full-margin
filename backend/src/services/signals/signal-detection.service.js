import { prisma } from "../../lib/prisma.js";
import { sendSignalToWatchers } from "../telegram/telegram.service.js";
import {
  calculateIndividualSignals,
  calculateMultiIndicatorScore,
} from "../../utils/indicator.utils.js";
import { fetchLatestIndicatorData } from "../../utils/db.utils.js";

/**
 * 🎯 SIGNAL DETECTION SERVICE (ACADEMIC VERSION)
 * ================================================================
 * Deteksi sinyal trading multi-indicator dan kirim notifikasi Telegram
 *
 * METODOLOGI SESUAI PROPOSAL:
 * - Menggunakan calculateMultiIndicatorScore() sebagai single source of truth
 * - FinalScore ternormalisasi [-1, +1]
 * - Multi-level threshold: STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
 *
 * PENGGUNAAN SINYAL:
 * - STRONG signals → Prioritas tinggi (notifikasi Telegram)
 * - BUY/SELL biasa → Informasi tambahan (analisis)
 * - NEUTRAL → Tidak ada notifikasi
 *
 * CATATAN AKADEMIK:
 * Strong threshold (±0.6) digunakan untuk mengurangi noise dan overtrading.
 * Hanya sinyal dengan confidence tinggi yang dikirim sebagai notifikasi.
 * ================================================================
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

    // Get coinId and timeframeId
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.log(`⚠️ ${symbol}: Coin not found in database`);
      return { success: false, reason: "no_coin" };
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      console.log(`⚠️ Timeframe ${timeframe} not found in database`);
      return { success: false, reason: "no_timeframe" };
    }

    const latestWeights = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
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

    // ✅ Calculate individual signals
    const signals = calculateIndividualSignals(current, prev);

    // 🎯 SINGLE SOURCE OF TRUTH: calculateMultiIndicatorScore()
    // Returns: { finalScore, strength, signal, signalLabel, normalized }
    const weightedResult = calculateMultiIndicatorScore(
      signals,
      latestWeights.weights
    );

    const { finalScore, strength, signal, signalLabel } = weightedResult;

    // ✅ Calculate categoryScores (sama seperti di indicator.controller.js)
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const s = sig.toLowerCase();
      if (s === "buy" || s === "strong_buy") return 1;
      if (s === "sell" || s === "strong_sell") return -1;
      return 0;
    };

    const w = latestWeights.weights;
    const trendScore =
      signalToScore(signals.SMA) * (w.SMA || 0) +
      signalToScore(signals.EMA) * (w.EMA || 0) +
      signalToScore(signals.PSAR) * (w.PSAR || 0);

    const momentumScore =
      signalToScore(signals.RSI) * (w.RSI || 0) +
      signalToScore(signals.MACD) * (w.MACD || 0) +
      signalToScore(signals.Stochastic) * (w.Stochastic || 0) +
      signalToScore(signals.StochasticRSI) * (w.StochasticRSI || 0);

    const volatilityScore =
      signalToScore(signals.BollingerBands) * (w.BollingerBands || 0);

    const categoryScores = {
      trend: parseFloat(trendScore.toFixed(2)),
      momentum: parseFloat(momentumScore.toFixed(2)),
      volatility: parseFloat(volatilityScore.toFixed(2)),
    };

    // ✅ Log hasil untuk debugging
    console.log(`📊 [MultiIndicator] ${symbol} Signal:`, {
      signal: signalLabel,
      finalScore: finalScore.toFixed(3),
      strength: strength.toFixed(3),
      categoryScores,
      price: candle.close.toFixed(2),
    });

    // 🎯 NOTIFICATION STRATEGY (ACADEMIC)
    // Kirim semua sinyal (NEUTRAL, BUY, SELL) ke watchlist users

    console.log(
      `${signal === "neutral" ? "⚪" : signal.includes("buy") ? "🟢" : "🔴"} ${symbol} ${signalLabel} | finalScore: ${finalScore.toFixed(3)}`
    );

    // 🔔 SEND TELEGRAM NOTIFICATION — only to users who watch this coin
    const result = await sendSignalToWatchers({
      coinId: coin.id,
      symbol,
      signal,
      signalLabel, // ✅ Kirim label untuk display (STRONG BUY, BUY, etc)
      price: candle.close,
      strength,
      finalScore, // ✅ FinalScore ternormalisasi [-1, +1]
      categoryScores, // ✅ Untuk Market Interpretation
      activeIndicators: Object.entries(latestWeights.weights).map(([k, w]) => ({
        name: k,
        weight: w,
      })),
      performance: {
        roi: latestWeights.testROI || latestWeights.roi,
        winRate: latestWeights.testWinRate || latestWeights.winRate,
        maxDrawdown: latestWeights.testMaxDrawdown || latestWeights.maxDrawdown,
        sharpeRatio: latestWeights.testSharpe || latestWeights.sharpeRatio || 0,
        trades: latestWeights.testTrades || latestWeights.trades,
      },
      timeframe,
    });

    if (result.success) {
      console.log(
        `✅ ${symbol} ${signalLabel} | finalScore: ${finalScore.toFixed(3)} | strength: ${strength.toFixed(3)} | notified: ${result.sent}/${result.eligible ?? result.total} watchers`
      );
    }

    return {
      success: true,
      signal,
      signalLabel,
      finalScore,
      strength,
      categoryScores,
    };
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
  // Get timeframe ID once
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.error(`⚠️ Timeframe ${timeframe} not found in database`);
    return { count: 0, needs: [] };
  }

  const needs = [];
  for (const symbol of symbols) {
    // Get coin ID
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.log(`⚠️ ${symbol}: Coin not found in database, skipping...`);
      continue;
    }

    const existing = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
    });

    if (!existing) {
      const count = await prisma.candle.count({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
      });
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
