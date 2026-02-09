/**
 * 📊 OVERALL SIGNAL ANALYZER - WEIGHTED SCORING
 * ===============================================
 * ✅ Sesuai metodologi penelitian: Weighted Multi-Indicator
 * ✅ Threshold = 0 (tidak ada threshold selain 0)
 * ✅ Tidak ada voting
 *
 * Formula:
 * finalScore = Σ (signalScore_i × weight_i)
 * strength = |finalScore| / Σ(weight_i)
 *
 * Signal determination:
 * - finalScore > 0  → BUY
 * - finalScore < 0  → SELL
 * - finalScore == 0 → NEUTRAL
 *
 * @param {Object} signals - Individual indicator signals from database
 * @param {String} symbol - Coin symbol (e.g., "BTC-USD")
 * @param {String} timeframe - Timeframe (e.g., "1h")
 * @param {Object} cachedWeights - Optional pre-loaded weights to avoid DB query
 * @returns {Promise<Object>} { overallSignal, signalStrength, finalScore }
 */
export async function calculateOverallSignal(
  signals,
  symbol,
  timeframe,
  cachedWeights = null
) {
  // ✅ Use cached weights if provided (for batch processing)
  if (cachedWeights) {
    return calculateWeightedSignal(signals, cachedWeights);
  }

  // Import prisma di sini untuk menghindari circular dependency
  const { prisma } = await import("../../lib/prisma.js");

  // ✅ Step 1: Get optimized weights from database
  const weightRecord = await prisma.indicatorWeight.findFirst({
    where: { symbol, timeframe },
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

    return calculateWeightedSignal(signals, weights);
  }

  // ✅ Use optimized weights from database
  return calculateWeightedSignal(signals, weightRecord.weights);
}

/**
 * 🎯 Calculate Weighted Signal
 * Pure calculation function - no database access
 *
 * @param {Object} signals - Individual signals { smaSignal, emaSignal, ... }
 * @param {Object} weights - Weights { SMA, EMA, RSI, ... }
 * @returns {Object} { overallSignal, signalStrength, finalScore }
 */
function calculateWeightedSignal(signals, weights) {
  // ✅ Map signal strings to numeric scores
  const signalToScore = (signal) => {
    if (!signal) return 0;
    const normalized = signal.toLowerCase();
    if (normalized === "buy" || normalized === "strong_buy") return 1;
    if (normalized === "sell" || normalized === "strong_sell") return -1;
    return 0;
  };

  // ✅ Extract signals and weights
  const indicatorData = [
    { name: "SMA", signal: signals.smaSignal, weight: weights.SMA || 0 },
    { name: "EMA", signal: signals.emaSignal, weight: weights.EMA || 0 },
    { name: "PSAR", signal: signals.psarSignal, weight: weights.PSAR || 0 },
    { name: "RSI", signal: signals.rsiSignal, weight: weights.RSI || 0 },
    { name: "MACD", signal: signals.macdSignal, weight: weights.MACD || 0 },
    {
      name: "Stochastic",
      signal: signals.stochSignal,
      weight: weights.Stochastic || 0,
    },
    {
      name: "StochasticRSI",
      signal: signals.stochRsiSignal,
      weight: weights.StochasticRSI || 0,
    },
    {
      name: "BollingerBands",
      signal: signals.bbSignal,
      weight: weights.BollingerBands || 0,
    },
  ];

  // ✅ Calculate weighted sum
  let weightedSum = 0;
  let totalWeight = 0;

  indicatorData.forEach(({ name, signal, weight }) => {
    const signalScore = signalToScore(signal);
    const contribution = signalScore * weight;

    weightedSum += contribution;
    totalWeight += weight;
  });

  // ✅ Calculate final score (no normalization, raw weighted sum)
  const finalScore = weightedSum;

  // ✅ Calculate strength (normalized by total weight)
  const strength = totalWeight > 0 ? Math.abs(finalScore) / totalWeight : 0;

  // ✅ Determine signal based on finalScore (threshold = 0)
  let overallSignal = "neutral";
  if (finalScore > 0) {
    overallSignal = "buy";
  } else if (finalScore < 0) {
    overallSignal = "sell";
  }

  return {
    overallSignal,
    signalStrength: parseFloat(strength.toFixed(3)),
    finalScore: parseFloat(finalScore.toFixed(2)),
  };
}

// Export helper untuk digunakan di controller
export { calculateWeightedSignal };
