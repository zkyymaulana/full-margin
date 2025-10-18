/**
 * 🎯 SIGNAL ANALYZER SERVICE - Aligned with Journal References
 *
 * Based on:
 * - Sukma & Namahoot (2025): "Enhancing Trading Strategies: A Multi-Indicator Analysis for Profitable Algorithmic Trading"
 * - Romo et al. (2025): "Adaptive Optimization of a Dual Moving Average Strategy for Automated Cryptocurrency Trading"
 * - Zatwarnicki et al. (2023): "Effectiveness of RSI in Timing the Cryptocurrency Market"
 */

/**
 * ✅ Normalize signal values to range [-1, +1] for consistent fusion
 * As per Sukma & Namahoot (2025) methodology
 */
export function normalizeSignal(value, min = -1, max = 1) {
  if (value === null || value === undefined) return 0;
  return Math.max(min, Math.min(max, value));
}

/**
 * ✅ RSI Signal Analysis (Zatwarnicki et al. 2023)
 * RSI < 30: Oversold (BUY signal) = +1
 * RSI > 70: Overbought (SELL signal) = -1
 * 30 <= RSI <= 70: Neutral = 0
 */
function analyzeRSISignal(rsi) {
  if (rsi === null || rsi === undefined) return 0;
  if (rsi < 30) return 1; // Strong BUY
  if (rsi > 70) return -1; // Strong SELL
  if (rsi < 40) return 0.5; // Weak BUY
  if (rsi > 60) return -0.5; // Weak SELL
  return 0; // NEUTRAL
}

/**
 * ✅ MACD Signal Analysis (Sukma & Namahoot 2025)
 * MACD > Signal: Bullish momentum = +1
 * MACD < Signal: Bearish momentum = -1
 */
function analyzeMACDSignal(macd, macdSignal, macdHist) {
  if (macd === null || macdSignal === null) return 0;

  const macdDiff = macd - macdSignal;

  // Strong signals based on histogram and line crossover
  if (macdDiff > 0 && (macdHist === null || macdHist > 0)) return 1; // Strong BUY
  if (macdDiff < 0 && (macdHist === null || macdHist < 0)) return -1; // Strong SELL

  // Weak signals
  if (macdDiff > 0) return 0.5; // Weak BUY
  if (macdDiff < 0) return -0.5; // Weak SELL

  return 0; // NEUTRAL
}

/**
 * ✅ Dual Moving Average Signal (Romo et al. 2025)
 * SMA20 > SMA50: Uptrend (BUY signal) = +1
 * SMA20 < SMA50: Downtrend (SELL signal) = -1
 * This replaces the previous EMA20 > SMA20 logic
 */
function analyzeDualMASignal(sma20, sma50) {
  if (sma20 === null || sma50 === null) return 0;

  const maDiff = (sma20 - sma50) / sma50; // Percentage difference

  // Strong trend signals (>1% difference)
  if (maDiff > 0.01) return 1; // Strong BUY (SMA20 significantly above SMA50)
  if (maDiff < -0.01) return -1; // Strong SELL (SMA20 significantly below SMA50)

  // Weak trend signals
  if (maDiff > 0) return 0.5; // Weak BUY
  if (maDiff < 0) return -0.5; // Weak SELL

  return 0; // NEUTRAL (very close)
}

/**
 * ✅ EMA Crossover Signal (Additional momentum confirmation)
 * EMA20 > EMA50: Bullish momentum = +1
 * EMA20 < EMA50: Bearish momentum = -1
 */
function analyzeEMASignal(ema20, ema50) {
  if (ema20 === null || ema50 === null) return 0;

  const emaDiff = (ema20 - ema50) / ema50; // Percentage difference

  // Strong momentum signals (>0.5% difference)
  if (emaDiff > 0.005) return 1; // Strong BUY (EMA20 above EMA50)
  if (emaDiff < -0.005) return -1; // Strong SELL (EMA20 below EMA50)

  // Weak momentum signals
  if (emaDiff > 0) return 0.5; // Weak BUY
  if (emaDiff < 0) return -0.5; // Weak SELL

  return 0; // NEUTRAL
}

/**
 * ✅ Bollinger Bands Signal Analysis (Volatility Group)
 * Price above Upper Band: Overbought = -1
 * Price below Lower Band: Oversold = +1
 */
function analyzeBollingerSignal(close, bbUpper, bbLower) {
  if (close === null || bbUpper === null || bbLower === null) return 0;

  const bbWidth = bbUpper - bbLower;
  if (bbWidth === 0) return 0;

  // Position within bands (0 = lower band, 1 = upper band)
  const position = (close - bbLower) / bbWidth;

  if (position > 1) return -1; // Above upper band (Strong SELL)
  if (position < 0) return 1; // Below lower band (Strong BUY)
  if (position > 0.8) return -0.5; // Near upper band (Weak SELL)
  if (position < 0.2) return 0.5; // Near lower band (Weak BUY)

  return 0; // NEUTRAL
}

/**
 * ✅ Parabolic SAR Signal Analysis (Volatility Group)
 * Price > PSAR: Uptrend = +1
 * Price < PSAR: Downtrend = -1
 */
function analyzePSARSignal(close, psar) {
  if (close === null || psar === null) return 0;

  const psarDiff = (close - psar) / close; // Percentage difference

  if (psarDiff > 0.02) return 1; // Strong BUY (price well above PSAR)
  if (psarDiff < -0.02) return -1; // Strong SELL (price well below PSAR)
  if (psarDiff > 0) return 0.5; // Weak BUY
  if (psarDiff < 0) return -0.5; // Weak SELL

  return 0; // NEUTRAL
}

/**
 * ✅ Stochastic Oscillator Signal Analysis (Volatility Group)
 * %K > %D and %K < 20: Oversold reversal = +1
 * %K < %D and %K > 80: Overbought reversal = -1
 */
function analyzeStochasticSignal(stochK, stochD) {
  if (stochK === null || stochD === null) return 0;

  const kCrossD = stochK - stochD;

  // Oversold reversal signals
  if (stochK < 20 && kCrossD > 0) return 1; // Strong BUY
  if (stochK < 30 && kCrossD > 0) return 0.5; // Weak BUY

  // Overbought reversal signals
  if (stochK > 80 && kCrossD < 0) return -1; // Strong SELL
  if (stochK > 70 && kCrossD < 0) return -0.5; // Weak SELL

  // General momentum signals
  if (kCrossD > 2) return 0.3; // Weak bullish momentum
  if (kCrossD < -2) return -0.3; // Weak bearish momentum

  return 0; // NEUTRAL
}

/**
 * ✅ Stochastic RSI Signal Analysis (Additional volatility indicator)
 * Similar to Stochastic but based on RSI values
 */
function analyzeStochRSISignal(stochRsiK, stochRsiD) {
  if (stochRsiK === null || stochRsiD === null) return 0;

  const kCrossD = stochRsiK - stochRsiD;

  // More sensitive than regular Stochastic
  if (stochRsiK < 20 && kCrossD > 0) return 0.8; // Strong BUY
  if (stochRsiK > 80 && kCrossD < 0) return -0.8; // Strong SELL
  if (stochRsiK < 30 && kCrossD > 0) return 0.4; // Weak BUY
  if (stochRsiK > 70 && kCrossD < 0) return -0.4; // Weak SELL

  return 0; // NEUTRAL
}

/**
 * ✅ ENHANCED MULTI-INDICATOR ANALYSIS
 * Implements weighted voting system as per Sukma & Namahoot (2025)
 *
 * Updated weights for MA 20/50 strategy:
 * - RSI: 0.20 (proven effectiveness in crypto - Zatwarnicki et al.)
 * - MACD: 0.20 (strong momentum indicator)
 * - Dual SMA (20/50): 0.20 (trend following - Romo et al.)
 * - EMA (20/50): 0.15 (momentum confirmation)
 * - Volatility Group (BB+PSAR+Stoch): 0.25 (combined volatility signals)
 */
export function analyzeMultiIndicator(indicator, customWeights = null) {
  // ✅ Updated weights for MA 20/50 strategy
  const weights = customWeights || {
    rsi: 0.2, // RSI weight
    macd: 0.2, // MACD weight
    dualMA: 0.2, // Dual SMA (20/50) weight
    emaSignal: 0.15, // EMA (20/50) momentum weight
    volatility: 0.25, // Combined volatility indicators weight
  };

  // Calculate individual indicator signals (normalized to [-1, +1])
  const rsiSignal = analyzeRSISignal(indicator.rsi);
  const macdSignal = analyzeMACDSignal(
    indicator.macd,
    indicator.macdSignal,
    indicator.macdHist
  );
  const dualMASignal = analyzeDualMASignal(indicator.sma20, indicator.sma50);
  const emaSignal = analyzeEMASignal(indicator.ema20, indicator.ema50);

  // Volatility group signals (combined)
  const bbSignal = analyzeBollingerSignal(
    indicator.close,
    indicator.bbUpper,
    indicator.bbLower
  );
  const psarSignal = analyzePSARSignal(indicator.close, indicator.psar);
  const stochSignal = analyzeStochasticSignal(
    indicator.stochK,
    indicator.stochD
  );
  const stochRsiSignal = analyzeStochRSISignal(
    indicator.stochRsiK,
    indicator.stochRsiD
  );

  // Combine volatility signals (equal weight within group)
  const volatilitySignal =
    (bbSignal + psarSignal + stochSignal + stochRsiSignal) / 4;

  // ✅ Updated weighted score calculation
  const weightedScore =
    rsiSignal * weights.rsi +
    macdSignal * weights.macd +
    dualMASignal * weights.dualMA +
    emaSignal * weights.emaSignal +
    volatilitySignal * weights.volatility;

  // ✅ Signal classification with thresholds
  // Adjusted thresholds for more conservative trading (reduce false signals)
  if (weightedScore > 0.3) return "BUY";
  if (weightedScore < -0.3) return "SELL";

  return "HOLD";
}

/**
 * ✅ LEGACY COMPATIBILITY FUNCTION
 * Maintains compatibility with existing signal.controller.js
 * but uses new weighted system internally
 */
export function analyzeMultiIndicatorLegacy(i, weights) {
  // Convert legacy weights to new format
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const normalizedWeights = {
    rsi: (weights.rsi || 0) / totalWeight,
    macd: (weights.macd || 0) / totalWeight,
    dualMA: ((weights.ema20 || 0) + (weights.sma20 || 0)) / totalWeight, // Combine MA weights
    volatility:
      ((weights.psar || 0) + (weights.stoch || 0) + (weights.bb || 0)) /
      totalWeight,
  };

  return analyzeMultiIndicator(i, normalizedWeights);
}

/**
 * ✅ SINGLE INDICATOR ANALYSIS FUNCTIONS
 * For comparison with multi-indicator approach
 */
export function analyzeSingleRSI(rsi) {
  const signal = analyzeRSISignal(rsi);
  return signal > 0.3 ? "BUY" : signal < -0.3 ? "SELL" : "HOLD";
}

export function analyzeSingleMACD(macd, macdSignal, macdHist) {
  const signal = analyzeMACDSignal(macd, macdSignal, macdHist);
  return signal > 0.3 ? "BUY" : signal < -0.3 ? "SELL" : "HOLD";
}

export function analyzeSingleDualMA(sma20, sma50) {
  const signal = analyzeDualMASignal(sma20, sma50);
  return signal > 0.3 ? "BUY" : signal < -0.3 ? "SELL" : "HOLD";
}

export function analyzeSingleEMA(ema20, ema50) {
  const signal = analyzeEMASignal(ema20, ema50);
  return signal > 0.3 ? "BUY" : signal < -0.3 ? "SELL" : "HOLD";
}

/**
 * ✅ PERFORMANCE METRICS CALCULATION
 * For backtesting and validation purposes
 */
export function calculateSignalMetrics(signals, prices) {
  // Implementation for ROI, Win Rate, Max Drawdown calculation
  // This will be used for academic validation
  let totalTrades = 0;
  let winningTrades = 0;
  let totalReturn = 0;
  let maxDrawdown = 0;
  let peak = 0;

  for (let i = 0; i < signals.length - 1; i++) {
    if (signals[i].signal !== "HOLD") {
      totalTrades++;
      // Calculate trade performance logic here
      // This is a placeholder for full implementation
    }
  }

  return {
    totalTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    totalReturn: totalReturn * 100, // Convert to percentage
    maxDrawdown: maxDrawdown * 100, // Convert to percentage
  };
}
