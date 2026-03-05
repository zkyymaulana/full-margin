/**
 * 📊 OVERALL SIGNAL ANALYZER - WEIGHTED SCORING (REFACTORED)
 * ===============================================
 * ✅ SESUAI PROPOSAL SKRIPSI - Menggunakan Single Source of Truth
 * ✅ FinalScore ternormalisasi ke rentang [-1, +1]
 * ✅ Multi-level threshold: STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
 * ✅ Konsisten dengan calculateMultiIndicatorScore() di indicator.utils.js
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

// ✅ Import core algorithm tanpa alias
import { calculateMultiIndicatorScore } from "../../utils/indicator.utils.js";

export async function calculateOverallSignal(
  signals,
  symbol,
  timeframe,
  cachedWeights = null
) {
  // ✅ Use cached weights if provided (for batch processing)
  if (cachedWeights) {
    return buildOverallSignal(signals, cachedWeights);
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
    return buildOverallSignal(signals, weights);
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
    return buildOverallSignal(signals, weights);
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

    return buildOverallSignal(signals, weights);
  }

  // ✅ Use optimized weights from database
  return buildOverallSignal(signals, weightRecord.weights);
}

/**
 * 🎯 BUILD OVERALL SIGNAL FROM DATABASE SIGNALS (ORCHESTRATION)
 * ================================================================
 * Fungsi orchestration yang meng-convert database signal format
 * ke format yang diterima oleh calculateMultiIndicatorScore() di utils.
 *
 * PERAN FUNGSI INI:
 * - Adapter/converter antara database format dan core algorithm
 * - Perhitungan inti dilakukan oleh calculateMultiIndicatorScore()
 * - Memastikan konsistensi dengan backtest dan realtime signal
 *
 * TIDAK mengubah logika perhitungan, hanya format data.
 * ================================================================
 */
function buildOverallSignal(signals, weights) {
  // ✅ Convert database signal format to core algorithm format
  // Database: { smaSignal, emaSignal, rsiSignal, ... }
  // Core Algorithm: { SMA, EMA, RSI, ... }

  const signalsForCalculation = {
    SMA: signals.smaSignal || "neutral",
    EMA: signals.emaSignal || "neutral",
    RSI: signals.rsiSignal || "neutral",
    MACD: signals.macdSignal || "neutral",
    BollingerBands: signals.bbSignal || "neutral",
    Stochastic: signals.stochSignal || "neutral",
    StochasticRSI: signals.stochRsiSignal || "neutral",
    PSAR: signals.psarSignal || "neutral",
  };

  // ✅ Call core algorithm (single source of truth)
  const result = calculateMultiIndicatorScore(signalsForCalculation, weights);

  // ✅ Return in expected format for database storage
  // Result dari core: { finalScore, strength, signal, signalLabel, normalized }
  return {
    overallSignal: result.signal, // 'buy'/'sell'/'neutral'/'strong_buy'/'strong_sell'
    signalStrength: result.strength, // Confidence [0, 1]
    finalScore: result.finalScore, // Normalized [-1, +1]
  };
}

// ✅ Export dengan nama yang jelas (untuk backward compatibility jika diperlukan)
export { buildOverallSignal };
