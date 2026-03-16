/**
 * 🎯 Utility Helper untuk Multi-Indicator Scoring
 * ================================================================
 * Helper functions untuk kategori scoring dan signal conversion.
 *
 * Tanggung Jawab:
 * - Convert signal strings ke numeric values
 * - Hitung category scores (trend, momentum, volatility)
 * - Stateless helper utilities
 * ================================================================
 */

/**
 * 🔄 Convert signal string ke numeric value
 *
 * @param {string} signal - Signal value ("buy", "sell", "neutral", atau null)
 * @returns {number} +1 untuk "buy", -1 untuk "sell", 0 untuk neutral/null
 *
 * Digunakan untuk mengkonversi string signals ke numeric untuk calculation
 */
export function toSignalValue(signal) {
  if (!signal) return 0;
  const normalized = signal.toLowerCase();
  if (normalized === "buy") return 1;
  if (normalized === "sell") return -1;
  return 0;
}

/**
 * 📊 Hitung category scores dari indicators dan weights
 *
 * @param {Object} indicators - Indicators object dengan semua indicator data
 * @param {Object} weights - Optimized weights untuk setiap indicator
 * @returns {Object} Category scores {trend, momentum, volatility}
 *
 * Categories:
 * - TREND (SMA + EMA + PSAR): Long-term trend direction
 * - MOMENTUM (RSI + MACD + Stochastic + StochasticRSI): Speed of price change
 * - VOLATILITY (BollingerBands): Market volatility level
 *
 * Calculation:
 * 1. Extract weighted sum dari indicators dalam setiap category
 * 2. Normalize dengan sum of weights dalam category
 * 3. Return score dalam range [-1, +1]
 *
 * Output example:
 * {
 *   trend: 0.45,        // Bullish trend
 *   momentum: -0.12,    // Bearish momentum
 *   volatility: 0.33    // Moderate volatility
 * }
 */
export function calculateCategoryScores(indicators, weights) {
  // 🔧 Safe weight extraction dengan default 0
  const w = {
    SMA: weights?.SMA || 0,
    EMA: weights?.EMA || 0,
    PSAR: weights?.PSAR || 0,
    RSI: weights?.RSI || 0,
    MACD: weights?.MACD || 0,
    Stochastic: weights?.Stochastic || 0,
    StochasticRSI: weights?.StochasticRSI || 0,
    BollingerBands: weights?.BollingerBands || 0,
  };

  // 📍 Extract signals dari indicators
  // Konversi string signals ke numeric values
  const signals = {
    sma: toSignalValue(indicators?.sma?.signal),
    ema: toSignalValue(indicators?.ema?.signal),
    psar: toSignalValue(indicators?.parabolicSar?.signal),
    rsi: toSignalValue(indicators?.rsi?.signal),
    macd: toSignalValue(indicators?.macd?.signal),
    stochastic: toSignalValue(indicators?.stochastic?.signal),
    stochasticRsi: toSignalValue(indicators?.stochasticRsi?.signal),
    bb: toSignalValue(indicators?.bollingerBands?.signal),
  };

  // 📈 TREND CATEGORY (SMA + EMA + PSAR)
  // Indikator yang track long-term trend direction
  const trendWeightSum = w.SMA + w.EMA + w.PSAR;
  const trendScore =
    trendWeightSum > 0
      ? (signals.sma * w.SMA + signals.ema * w.EMA + signals.psar * w.PSAR) /
        trendWeightSum
      : 0;

  // 🚀 MOMENTUM CATEGORY (RSI + MACD + Stochastic + StochasticRSI)
  // Indikator yang track kecepatan perubahan harga
  const momentumWeightSum = w.RSI + w.MACD + w.Stochastic + w.StochasticRSI;
  const momentumScore =
    momentumWeightSum > 0
      ? (signals.rsi * w.RSI +
          signals.macd * w.MACD +
          signals.stochastic * w.Stochastic +
          signals.stochasticRsi * w.StochasticRSI) /
        momentumWeightSum
      : 0;

  // 📊 VOLATILITY CATEGORY (BollingerBands only)
  // Indikator yang track market volatility
  const volatilityWeightSum = w.BollingerBands;
  const volatilityScore =
    volatilityWeightSum > 0
      ? (signals.bb * w.BollingerBands) / volatilityWeightSum
      : 0;

  return {
    trend: parseFloat(trendScore.toFixed(2)),
    momentum: parseFloat(momentumScore.toFixed(2)),
    volatility: parseFloat(volatilityScore.toFixed(2)),
  };
}

export default {
  toSignalValue,
  calculateCategoryScores,
};
