/**
 * 🎯 Signals Service - Trading Signal Generation
 * Contains all signal generation logic for technical indicators
 * 
 * @description Service untuk menghasilkan sinyal trading dari indikator teknikal
 * @features Signal generation for all indicators, multi-indicator analysis
 */

/**
 * 📈 Generate Moving Average crossover signals
 * @param {number[]} shortMA - Short period moving average
 * @param {number[]} longMA - Long period moving average
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateMASignals(shortMA, longMA) {
  const signals = Array(shortMA.length).fill("HOLD");

  for (let i = 1; i < shortMA.length; i++) {
    if (shortMA[i] == null || longMA[i] == null) continue;

    const prevDiff = shortMA[i - 1] - longMA[i - 1];
    const currDiff = shortMA[i] - longMA[i];

    // Golden cross: short MA crosses above long MA
    if (prevDiff <= 0 && currDiff > 0) {
      signals[i] = "BUY";
    } 
    // Death cross: short MA crosses below long MA
    else if (prevDiff >= 0 && currDiff < 0) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📈 Generate EMA price crossover signals
 * @param {number[]} closes - Close prices
 * @param {number[]} emaValues - EMA values
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateEMASignals(closes, emaValues) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] == null || emaValues[i] == null || 
        closes[i - 1] == null || emaValues[i - 1] == null) continue;

    // Price crosses above EMA
    if (closes[i - 1] <= emaValues[i - 1] && closes[i] > emaValues[i]) {
      signals[i] = "BUY";
    } 
    // Price crosses below EMA
    else if (closes[i - 1] >= emaValues[i - 1] && closes[i] < emaValues[i]) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate RSI overbought/oversold signals
 * @param {number[]} rsiValues - RSI values
 * @param {number} lower - Oversold threshold (default: 30)
 * @param {number} upper - Overbought threshold (default: 70)
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateRSISignals(rsiValues, lower = 30, upper = 70) {
  const signals = Array(rsiValues.length).fill("HOLD");

  for (let i = 1; i < rsiValues.length; i++) {
    if (rsiValues[i - 1] == null || rsiValues[i] == null) continue;

    // RSI crosses up from oversold
    if (rsiValues[i - 1] <= lower && rsiValues[i] > lower) {
      signals[i] = "BUY";
    } 
    // RSI crosses down from overbought
    else if (rsiValues[i - 1] >= upper && rsiValues[i] < upper) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate Stochastic Oscillator signals
 * @param {number[]} stochK - %K values
 * @param {number[]} stochD - %D values
 * @param {number} oversold - Oversold threshold (default: 20)
 * @param {number} overbought - Overbought threshold (default: 80)
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateStochasticSignals(stochK, stochD, oversold = 20, overbought = 80) {
  const signals = Array(stochK.length).fill("HOLD");

  for (let i = 1; i < stochK.length; i++) {
    if (stochK[i] == null || stochD[i] == null || 
        stochK[i - 1] == null || stochD[i - 1] == null) continue;

    // %K crosses above %D in oversold territory
    if (stochK[i - 1] <= stochD[i - 1] && stochK[i] > stochD[i] && 
        stochK[i] < oversold && stochD[i] < oversold) {
      signals[i] = "BUY";
    } 
    // %K crosses below %D in overbought territory
    else if (stochK[i - 1] >= stochD[i - 1] && stochK[i] < stochD[i] && 
             stochK[i] > overbought && stochD[i] > overbought) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate Stochastic RSI signals
 * @param {number[]} stochRsiK - Stochastic RSI %K values
 * @param {number[]} stochRsiD - Stochastic RSI %D values
 * @param {number} oversold - Oversold threshold (default: 20)
 * @param {number} overbought - Overbought threshold (default: 80)
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateStochasticRSISignals(stochRsiK, stochRsiD, oversold = 20, overbought = 80) {
  const signals = Array(stochRsiK.length).fill("HOLD");

  for (let i = 1; i < stochRsiK.length; i++) {
    if (stochRsiK[i] == null || stochRsiD[i] == null || 
        stochRsiK[i - 1] == null || stochRsiD[i - 1] == null) continue;

    // %K crosses above %D in oversold territory
    if (stochRsiK[i - 1] <= stochRsiD[i - 1] && stochRsiK[i] > stochRsiD[i] && 
        stochRsiK[i] < oversold) {
      signals[i] = "BUY";
    } 
    // %K crosses below %D in overbought territory
    else if (stochRsiK[i - 1] >= stochRsiD[i - 1] && stochRsiK[i] < stochRsiD[i] && 
             stochRsiK[i] > overbought) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate MACD signals
 * @param {number[]} macdLine - MACD line values
 * @param {number[]} signalLine - Signal line values
 * @param {number[]} histogram - MACD histogram values
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateMACDSignals(macdLine, signalLine, histogram) {
  const signals = Array(macdLine.length).fill("HOLD");

  for (let i = 1; i < macdLine.length; i++) {
    if (macdLine[i] == null || signalLine[i] == null || 
        macdLine[i - 1] == null || signalLine[i - 1] == null) continue;

    // MACD line crosses above signal line
    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) {
      signals[i] = "BUY";
    } 
    // MACD line crosses below signal line
    else if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate Bollinger Bands signals
 * @param {number[]} closes - Close prices
 * @param {number[]} upperBand - Upper Bollinger Band
 * @param {number[]} lowerBand - Lower Bollinger Band
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateBollingerBandsSignals(closes, upperBand, lowerBand) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 2; i < closes.length; i++) {
    if (closes[i] == null || upperBand[i] == null || 
        lowerBand[i] == null || closes[i - 1] == null) continue;

    // Mean reversion: buy when price touches lower band
    if (closes[i] <= lowerBand[i]) {
      signals[i] = "BUY";
    } 
    // Mean reversion: sell when price touches upper band
    else if (closes[i] >= upperBand[i]) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 📊 Generate Parabolic SAR signals
 * @param {number[]} closes - Close prices
 * @param {number[]} sarValues - Parabolic SAR values
 * @returns {string[]} Array of BUY/SELL/HOLD signals
 */
export function generateParabolicSARSignals(closes, sarValues) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] == null || sarValues[i] == null || 
        closes[i - 1] == null || sarValues[i - 1] == null) continue;

    // Price crosses above SAR
    if (closes[i - 1] <= sarValues[i - 1] && closes[i] > sarValues[i]) {
      signals[i] = "BUY";
    } 
    // Price crosses below SAR
    else if (closes[i - 1] >= sarValues[i - 1] && closes[i] < sarValues[i]) {
      signals[i] = "SELL";
    }
  }
  return signals;
}

/**
 * 🔍 Analyze Moving Average crossover for current state
 * @param {number[]} sma20 - 20-period SMA
 * @param {number[]} sma50 - 50-period SMA
 * @param {number[]} closes - Close prices
 * @returns {Object} Analysis result with signal and message
 */
export function analyzeMACross(sma20, sma50, closes) {
  const lastClose = closes[closes.length - 1];
  const lastSMA20 = sma20[sma20.length - 1];
  const lastSMA50 = sma50[sma50.length - 1];

  if (!lastSMA20 || !lastSMA50 || !lastClose) {
    return {
      signal: "WAIT",
      message: "Data SMA belum tersedia",
    };
  }

  let signal = "HOLD";
  let message = "";

  if (lastSMA20 > lastSMA50) {
    signal = "BUY";
    message = "Golden Cross - SMA20 di atas SMA50";
  } else if (lastSMA20 < lastSMA50) {
    signal = "SELL";
    message = "Death Cross - SMA20 di bawah SMA50";
  } else {
    message = "SMA20 dan SMA50 sama";
  }

  return {
    signal,
    message,
    close: lastClose?.toFixed(2),
    sma20: lastSMA20?.toFixed(2),
    sma50: lastSMA50?.toFixed(2),
  };
}

/**
 * 🎯 Generate individual signals for all indicators
 * @param {Object} indicators - Object containing all indicator values
 * @returns {Object} Object with individual signals for each indicator
 */
export function generateIndividualSignals(indicators) {
  const {
    sma20, sma50, ema20, rsi, stochK, stochD, stochRsiK, stochRsiD,
    macdLine, macdSignal, bbUpper, bbLower, psar, close
  } = indicators;

  const signals = {};

  // Trend: SMA
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) signals.sma = "BUY";
    else if (sma20 < sma50) signals.sma = "SELL";
    else signals.sma = "HOLD";
  } else signals.sma = "HOLD";

  // Trend: EMA
  if (ema20 != null && close != null) {
    if (close > ema20) signals.ema = "BUY";
    else if (close < ema20) signals.ema = "SELL";
    else signals.ema = "HOLD";
  } else signals.ema = "HOLD";

  // Momentum: RSI
  if (rsi != null) {
    if (rsi < 30) signals.rsi = "BUY";
    else if (rsi > 70) signals.rsi = "SELL";
    else signals.rsi = "HOLD";
  } else signals.rsi = "HOLD";

  // Momentum: Stochastic
  if (stochK != null && stochD != null) {
    if (stochK > stochD && stochK < 20 && stochD < 20) signals.stochastic = "BUY";
    else if (stochK < stochD && stochK > 80 && stochD > 80) signals.stochastic = "SELL";
    else signals.stochastic = "HOLD";
  } else signals.stochastic = "HOLD";

  // Momentum: Stochastic RSI
  if (stochRsiK != null && stochRsiD != null) {
    if (stochRsiK > stochRsiD && stochRsiK < 20) signals.stochRsi = "BUY";
    else if (stochRsiK < stochRsiD && stochRsiK > 80) signals.stochRsi = "SELL";
    else signals.stochRsi = "HOLD";
  } else signals.stochRsi = "HOLD";

  // Trend + Momentum: MACD
  if (macdLine != null && macdSignal != null) {
    if (macdLine > macdSignal) signals.macd = "BUY";
    else if (macdLine < macdSignal) signals.macd = "SELL";
    else signals.macd = "HOLD";
  } else signals.macd = "HOLD";

  // Volatility: Bollinger Bands
  if (bbUpper != null && bbLower != null && close != null) {
    if (close < bbLower) signals.bollinger = "BUY";
    else if (close > bbUpper) signals.bollinger = "SELL";
    else signals.bollinger = "HOLD";
  } else signals.bollinger = "HOLD";

  // Trend Reversal: PSAR
  if (psar != null && close != null) {
    if (close > psar) signals.psar = "BUY";
    else if (close < psar) signals.psar = "SELL";
    else signals.psar = "HOLD";
  } else signals.psar = "HOLD";

  return signals;
}

/**
 * 🎯 Generate all signals for historical data
 * @param {Object} historicalData - Historical price data with indicators
 * @returns {Object} Object containing all signal arrays
 */
export function generateAllSignals(historicalData) {
  if (!historicalData || historicalData.length === 0) {
    throw new Error("Historical data is required for signal generation");
  }

  console.log(`🎯 Generating signals for ${historicalData.length} data points...`);

  // Extract data arrays
  const closes = historicalData.map(d => d.close);
  const highs = historicalData.map(d => d.high);
  const lows = historicalData.map(d => d.low);
  const sma20 = historicalData.map(d => d.sma20);
  const sma50 = historicalData.map(d => d.sma50);
  const ema20 = historicalData.map(d => d.ema20);
  const rsi14 = historicalData.map(d => d.rsi14);
  const stochK = historicalData.map(d => d.stochK);
  const stochD = historicalData.map(d => d.stochD);
  const stochRsiK = historicalData.map(d => d.stochRsiK);
  const stochRsiD = historicalData.map(d => d.stochRsiD);
  const macdLine = historicalData.map(d => d.macdLine);
  const macdSignal = historicalData.map(d => d.macdSignal);
  const macdHistogram = historicalData.map(d => d.macdHistogram);
  const bbUpper = historicalData.map(d => d.bbUpper);
  const bbLower = historicalData.map(d => d.bbLower);
  const psar = historicalData.map(d => d.psar);

  // Generate all signals
  const signals = {
    sma: generateMASignals(sma20, sma50),
    ema: generateEMASignals(closes, ema20),
    rsi: generateRSISignals(rsi14),
    stochastic: generateStochasticSignals(stochK, stochD),
    stochasticRSI: generateStochasticRSISignals(stochRsiK, stochRsiD),
    macd: generateMACDSignals(macdLine, macdSignal, macdHistogram),
    bollingerBands: generateBollingerBandsSignals(closes, bbUpper, bbLower),
    parabolicSAR: generateParabolicSARSignals(closes, psar)
  };

  console.log(`✅ Generated signals for ${Object.keys(signals).length} indicators`);

  return signals;
}

/**
 * 📊 Get current market signals summary
 * @param {Object} latestData - Latest indicator values
 * @returns {Object} Current signals summary
 */
export function getCurrentSignalsSummary(latestData) {
  const individualSignals = generateIndividualSignals(latestData);
  
  // Count signal types
  const signalCounts = { BUY: 0, SELL: 0, HOLD: 0 };
  Object.values(individualSignals).forEach(signal => {
    signalCounts[signal]++;
  });

  // Determine overall sentiment
  let overallSignal = "HOLD";
  if (signalCounts.BUY > signalCounts.SELL) overallSignal = "BUY";
  else if (signalCounts.SELL > signalCounts.BUY) overallSignal = "SELL";

  return {
    individualSignals,
    signalCounts,
    overallSignal,
    confidence: Math.max(signalCounts.BUY, signalCounts.SELL) / Object.keys(individualSignals).length,
    totalIndicators: Object.keys(individualSignals).length
  };
}