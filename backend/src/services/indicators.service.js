/**
 * 📊 Indicators Service - Technical Analysis Calculations
 * Contains all technical indicator calculations for crypto trading analysis
 * 
 * @description Service yang berisi semua perhitungan indikator teknikal
 * @features SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, Parabolic SAR
 */

/**
 * 📈 Simple Moving Average (SMA)
 * @param {number[]} values - Array of price values
 * @param {number} period - Period for moving average
 * @returns {(number|null)[]} Array of SMA values
 */
export function calculateSMA(values, period) {
  const out = Array(values.length).fill(null);
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period]; // Remove oldest value
    if (i >= period - 1) out[i] = sum / period; // Start from (period-1)th bar
  }
  return out;
}

/**
 * 📈 Exponential Moving Average (EMA)
 * @param {number[]} values - Array of price values
 * @param {number} period - Period for EMA calculation
 * @returns {(number|null)[]} Array of EMA values
 */
export function calculateEMA(values, period) {
  const out = Array(values.length).fill(null);
  const k = 2 / (period + 1);

  // Calculate initial SMA as seed for EMA
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = seed;

  // Calculate EMA using exponential smoothing
  for (let t = period; t < values.length; t++) {
    out[t] = values[t] * k + out[t - 1] * (1 - k);
  }
  return out;
}

/**
 * 📊 Relative Strength Index (RSI)
 * @param {number[]} values - Array of price values
 * @param {number} period - Period for RSI calculation (default: 14)
 * @returns {(number|null)[]} Array of RSI values (0-100)
 */
export function calculateRSI(values, period = 14) {
  const rsi = Array(values.length).fill(null);
  let gains = 0, losses = 0;

  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    let diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  rsi[period] = 100 - 100 / (1 + rs);

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period + 1; i < values.length; i++) {
    let diff = values[i] - values[i - 1];
    let gain = diff > 0 ? diff : 0;
    let loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }
  return rsi;
}

/**
 * 📊 Stochastic Oscillator
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number} kPeriod - Period for %K calculation (default: 14)
 * @param {number} dPeriod - Period for %D smoothing (default: 3)
 * @returns {Object} Object with k and d arrays
 */
export function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const kValues = Array(closes.length).fill(null);
  const dValues = Array(closes.length).fill(null);

  // Calculate %K
  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    let lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));

    if (highestHigh === lowestLow) {
      kValues[i] = 50; // Avoid division by zero
    } else {
      kValues[i] = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
  }

  // Calculate %D as SMA of %K
  for (let i = kPeriod + dPeriod - 2; i < closes.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < dPeriod; j++) {
      if (kValues[i - j] !== null) {
        sum += kValues[i - j];
        count++;
      }
    }
    dValues[i] = count > 0 ? sum / count : null;
  }

  return { k: kValues, d: dValues };
}

/**
 * 📊 Stochastic RSI
 * @param {number[]} values - Array of price values
 * @param {number} rsiPeriod - Period for RSI calculation (default: 14)
 * @param {number} stochPeriod - Period for Stochastic calculation (default: 14)
 * @param {number} kPeriod - Period for %K smoothing (default: 3)
 * @param {number} dPeriod - Period for %D smoothing (default: 3)
 * @returns {Object} Object with stochRSI, k, and d arrays
 */
export function calculateStochasticRSI(values, rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) {
  const rsiValues = calculateRSI(values, rsiPeriod);
  const stochRSI = Array(values.length).fill(null);
  const kValues = Array(values.length).fill(null);
  const dValues = Array(values.length).fill(null);

  // Calculate base Stochastic RSI values
  for (let i = rsiPeriod + stochPeriod - 2; i < values.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod + 1, i + 1).filter(v => v !== null);
    const maxRSI = Math.max(...slice);
    const minRSI = Math.min(...slice);

    stochRSI[i] = maxRSI === minRSI ? 50 : ((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100;
  }

  // Calculate %K (smoothed StochRSI)
  for (let i = 0; i < values.length; i++) {
    if (i >= kPeriod - 1) {
      const subset = stochRSI.slice(i - kPeriod + 1, i + 1).filter(v => v !== null);
      if (subset.length === kPeriod) {
        kValues[i] = subset.reduce((a, b) => a + b, 0) / kPeriod;
      }
    }
  }

  // Calculate %D (smoothed %K)
  for (let i = 0; i < values.length; i++) {
    if (i >= dPeriod - 1) {
      const subset = kValues.slice(i - dPeriod + 1, i + 1).filter(v => v !== null);
      if (subset.length === dPeriod) {
        dValues[i] = subset.reduce((a, b) => a + b, 0) / dPeriod;
      }
    }
  }

  return { stochRSI, k: kValues, d: dValues };
}

/**
 * 📊 MACD (Moving Average Convergence Divergence)
 * @param {number[]} values - Array of price values
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line EMA period (default: 9)
 * @returns {Object} Object with macd, signal, and histogram arrays
 */
export function calculateMACD(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(values, fastPeriod);
  const emaSlow = calculateEMA(values, slowPeriod);

  // Calculate MACD Line
  const macdLine = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  // Calculate Signal Line (EMA of MACD)
  const macdValid = macdLine.filter(v => v != null);
  const signalValid = calculateEMA(macdValid, signalPeriod);

  // Map signal line back to full array
  const signalLine = Array(values.length).fill(null);
  let sigIndex = 0;
  for (let i = 0; i < values.length; i++) {
    if (macdLine[i] != null) {
      signalLine[i] = signalValid[sigIndex];
      sigIndex++;
    }
  }

  // Calculate Histogram
  const histogram = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (macdLine[i] != null && signalLine[i] != null) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram,
  };
}

/**
 * 📊 Bollinger Bands
 * @param {number[]} values - Array of price values
 * @param {number} period - Period for SMA calculation (default: 20)
 * @param {number} multiplier - Standard deviation multiplier (default: 2)
 * @returns {Object} Object with upper, middle, and lower band arrays
 */
export function calculateBollingerBands(values, period = 20, multiplier = 2) {
  const middleBand = calculateSMA(values, period);
  const upperBand = Array(values.length).fill(null);
  const lowerBand = Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = middleBand[i];

    if (mean !== null) {
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      upperBand[i] = mean + multiplier * standardDeviation;
      lowerBand[i] = mean - multiplier * standardDeviation;
    }
  }

  return {
    upper: upperBand,
    middle: middleBand,
    lower: lowerBand,
  };
}

/**
 * 📊 Parabolic SAR (Stop and Reverse)
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number} step - Acceleration factor step (default: 0.02)
 * @param {number} maxStep - Maximum acceleration factor (default: 0.2)
 * @returns {(number|null)[]} Array of Parabolic SAR values
 */
export function calculateParabolicSAR(highs, lows, closes, step = 0.02, maxStep = 0.2) {
  const n = highs.length;
  const sar = Array(n).fill(null);

  if (n < 3) return sar;

  // Initialize based on first 3 candles (TradingView style)
  let isUptrend = closes[2] > closes[1];
  let ep, prevSAR, af;

  if (isUptrend) {
    ep = Math.max(highs[0], highs[1], highs[2]);
    prevSAR = Math.min(lows[0], lows[1], lows[2]);
  } else {
    ep = Math.min(lows[0], lows[1], lows[2]);
    prevSAR = Math.max(highs[0], highs[1], highs[2]);
  }

  af = step;
  sar[2] = Math.round(prevSAR * 100) / 100;

  // Main calculation loop starting from 4th candle
  for (let i = 3; i < n; i++) {
    let newSAR = prevSAR + af * (ep - prevSAR);
    newSAR = Math.round(newSAR * 100) / 100;

    if (isUptrend) {
      // Uptrend: SAR cannot exceed low of previous 2 bars
      const lowLimit1 = lows[i - 1];
      const lowLimit2 = lows[i - 2];
      newSAR = Math.min(newSAR, lowLimit1, lowLimit2);

      // Check for reversal
      if (lows[i] < newSAR) {
        isUptrend = false;
        newSAR = ep;
        ep = lows[i];
        af = step;
      } else {
        // Update EP and AF if new high
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      // Downtrend: SAR cannot exceed high of previous 2 bars
      const highLimit1 = highs[i - 1];
      const highLimit2 = highs[i - 2];
      newSAR = Math.max(newSAR, highLimit1, highLimit2);

      // Check for reversal
      if (highs[i] > newSAR) {
        isUptrend = true;
        newSAR = ep;
        ep = highs[i];
        af = step;
      } else {
        // Update EP and AF if new low
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + step, maxStep);
        }
      }
    }

    sar[i] = Math.round(newSAR * 100) / 100;
    prevSAR = sar[i];
  }

  return sar;
}

/**
 * 🧮 Calculate all indicators for given price data
 * @param {Object} priceData - Object containing open, high, low, close, volume arrays
 * @returns {Object} Object containing all calculated indicators
 */
export function calculateAllIndicators(priceData) {
  const { opens, highs, lows, closes, volumes } = priceData;

  console.log(`📊 Calculating all indicators for ${closes.length} data points...`);

  try {
    const indicators = {
      // Moving Averages
      sma5: calculateSMA(closes, 5),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      ema20: calculateEMA(closes, 20),

      // Momentum Indicators
      rsi14: calculateRSI(closes, 14),
      
      // Oscillators
      stochastic: calculateStochastic(highs, lows, closes, 14, 3),
      stochasticRSI: calculateStochasticRSI(closes, 14, 14, 3, 3),
      
      // Trend Indicators
      macd: calculateMACD(closes, 12, 26, 9),
      bollingerBands: calculateBollingerBands(closes, 20, 2),
      parabolicSAR: calculateParabolicSAR(highs, lows, closes, 0.02, 0.2)
    };

    console.log(`✅ All indicators calculated successfully`);
    return indicators;

  } catch (error) {
    console.error(`❌ Error calculating indicators:`, error.message);
    throw error;
  }
}

// Export individual functions for backward compatibility
export const SMA = calculateSMA;
export const EMA = calculateEMA;
export const RSI = calculateRSI;
export const StochasticOscillator = calculateStochastic;
export const StochasticRSI = calculateStochasticRSI;
export const MACD = calculateMACD;
export const BollingerBands = calculateBollingerBands;
export const ParabolicSAR = calculateParabolicSAR;