/**
 * 📊 OVERALL SIGNAL ANALYZER - WEIGHTED SCORING (REFACTORED)
 * ===============================================
 * ✅ SESUAI PROPOSAL SKRIPSI - Menggunakan Single Source of Truth
 * ✅ FinalScore ternormalisasi ke rentang [-1, +1]
 * ✅ Multi-level threshold: STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
 * ✅ Konsisten dengan calculateWeightedSignal() di indicator.utils.js
 *
 * Formula (NORMALIZED):
 * finalScore = Σ(weight_i × signal_i) / Σ(weight_i)
 * strength = |finalScore|
 *
 * Signal Classification:
 * - finalScore >= 0.6  → STRONG_BUY
 * - finalScore > 0     → BUY
 * - finalScore == 0    → NEUTRAL
 * - finalScore < 0     → SELL
 * - finalScore <= -0.6 → STRONG_SELL
 *
 * @param {Object} signals - Individual indicator signals from database
 * @param {String} symbol - Coin symbol (e.g., "BTC-USD")
 * @param {String} timeframe - Timeframe (e.g., "1h")
 * @param {Object} cachedWeights - Optional pre-loaded weights to avoid DB query
 * @returns {Promise<Object>} { overallSignal, signalStrength, finalScore }
 */

// ✅ Import single source of truth dari indicator.utils.js
import { calculateWeightedSignal as calculateWeightedSignalUtils } from "../../utils/indicator.utils.js";

export async function calculateOverallSignal(
  signals,
  symbol,
  timeframe,
  cachedWeights = null
) {
  // ✅ Use cached weights if provided (for batch processing)
  if (cachedWeights) {
    return calculateWeightedSignalFromSignals(signals, cachedWeights);
  }

  // Import prisma di sini untuk menghindari circular dependency
  const { prisma } = await import("../../lib/prisma.js");

  // Get coin and timeframe IDs
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    // Fallback: equal weights if coin not found
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };
    return calculateWeightedSignalFromSignals(signals, weights);
  }

  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    // Fallback: equal weights if timeframe not found
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };
    return calculateWeightedSignalFromSignals(signals, weights);
  }

  // ✅ Step 1: Get optimized weights from database
  const weightRecord = await prisma.indicatorWeight.findFirst({
    where: {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!weightRecord || !weightRecord.weights) {
    // Fallback: equal weights
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };

    return calculateWeightedSignalFromSignals(signals, weights);
  }

  // ✅ Use optimized weights from database
  return calculateWeightedSignalFromSignals(signals, weightRecord.weights);
}

/**
 * 🎯 Calculate Weighted Signal FROM DATABASE SIGNALS
 * ================================================================
 * Wrapper function yang meng-convert database signal format
 * ke format yang diterima oleh calculateWeightedSignal() di utils.
 *
 * PENTING:
 * - Fungsi ini hanya adapter/converter
 * - Perhitungan sebenarnya dilakukan oleh calculateWeightedSignalUtils()
 * - Memastikan konsistensi dengan backtest dan realtime signal
 * ================================================================
 */
function calculateWeightedSignalFromSignals(signals, weights) {
  // ✅ Convert database signal format to utils format
  // Database: { smaSignal, emaSignal, rsiSignal, ... }
  // Utils: { SMA, EMA, RSI, ... }

  const signalsForUtils = {
    SMA: signals.smaSignal || "neutral",
    EMA: signals.emaSignal || "neutral",
    RSI: signals.rsiSignal || "neutral",
    MACD: signals.macdSignal || "neutral",
    BollingerBands: signals.bbSignal || "neutral",
    Stochastic: signals.stochSignal || "neutral",
    StochasticRSI: signals.stochRsiSignal || "neutral",
    PSAR: signals.psarSignal || "neutral",
  };

  // ✅ Call single source of truth from indicator.utils.js
  const result = calculateWeightedSignalUtils(signalsForUtils, weights);

  // ✅ Return in expected format for database storage
  // Result dari utils: { finalScore, strength, signal, signalLabel, normalized }
  return {
    overallSignal: result.signal, // 'buy'/'sell'/'neutral'/'strong_buy'/'strong_sell'
    signalStrength: result.strength, // Confidence [0, 1]
    finalScore: result.finalScore, // Normalized [-1, +1]
  };
}

// ❌ DEPRECATED - Removed duplicate local function
// Export calculateWeightedSignalFromSignals untuk backward compatibility
export { calculateWeightedSignalFromSignals as calculateWeightedSignal };
