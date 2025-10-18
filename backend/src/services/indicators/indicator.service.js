import { prisma } from "../../lib/prisma.js";

/* =========================
   📊 TECHNICAL INDICATORS SERVICE
   Calculate indicators manually without external libraries
========================= */

// Helper function to calculate Simple Moving Average
export function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// Helper function to calculate Exponential Moving Average
export function calculateEMA(prices, period, prevEMA = null) {
  if (prices.length === 0) return null;
  const multiplier = 2 / (period + 1);
  const currentPrice = prices[prices.length - 1];

  if (prevEMA === null) {
    // First EMA calculation uses SMA
    if (prices.length < period) return null;
    return calculateSMA(prices, period);
  }

  return currentPrice * multiplier + prevEMA * (1 - multiplier);
}

// Helper function to calculate RSI
export function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate subsequent RSI values
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Helper function to calculate MACD
export function calculateMACD(
  prices,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  if (prices.length < slowPeriod)
    return { macd: null, signal: null, histogram: null };

  // Calculate EMA12 and EMA26
  let ema12 = null;
  let ema26 = null;
  const macdLine = [];

  for (let i = 0; i < prices.length; i++) {
    const currentPrices = prices.slice(0, i + 1);
    ema12 = calculateEMA(currentPrices, fastPeriod, ema12);
    ema26 = calculateEMA(currentPrices, slowPeriod, ema26);

    if (ema12 !== null && ema26 !== null) {
      macdLine.push(ema12 - ema26);
    }
  }

  if (macdLine.length === 0)
    return { macd: null, signal: null, histogram: null };

  // Calculate signal line (EMA of MACD line)
  let signalEMA = null;
  for (let i = 0; i < macdLine.length; i++) {
    const currentMacd = macdLine.slice(0, i + 1);
    signalEMA = calculateEMA(currentMacd, signalPeriod, signalEMA);
  }

  const macd = macdLine[macdLine.length - 1];
  const histogram = signalEMA !== null ? macd - signalEMA : null;

  return { macd, signal: signalEMA, histogram };
}

// Helper function to calculate Bollinger Bands
export function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return { upper: null, lower: null };

  const sma = calculateSMA(prices, period);
  if (sma === null) return { upper: null, lower: null };

  const recentPrices = prices.slice(-period);
  const variance =
    recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) /
    period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: sma + stdDev * multiplier,
    lower: sma - stdDev * multiplier,
  };
}

// Helper function to calculate Stochastic Oscillator
export function calculateStochastic(
  highs,
  lows,
  closes,
  kPeriod = 14,
  dPeriod = 3
) {
  if (
    highs.length < kPeriod ||
    lows.length < kPeriod ||
    closes.length < kPeriod
  ) {
    return { k: null, d: null };
  }

  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const currentClose = closes[closes.length - 1];

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // Calculate %D (SMA of %K)
  const kValues = [];
  for (let i = Math.max(0, closes.length - dPeriod); i < closes.length; i++) {
    const windowHighs = highs.slice(Math.max(0, i - kPeriod + 1), i + 1);
    const windowLows = lows.slice(Math.max(0, i - kPeriod + 1), i + 1);
    const windowClose = closes[i];

    if (windowHighs.length === kPeriod) {
      const windowHighest = Math.max(...windowHighs);
      const windowLowest = Math.min(...windowLows);
      const windowK =
        ((windowClose - windowLowest) / (windowHighest - windowLowest)) * 100;
      kValues.push(windowK);
    }
  }

  const d = kValues.length >= dPeriod ? calculateSMA(kValues, dPeriod) : null;

  return { k, d };
}

// ✅ FIXED: Improved Stochastic RSI calculation
function calculateStochasticRSIFixed(
  prices,
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
) {
  // Need enough data: RSI period + Stochastic period + smoothing periods
  const minRequired = rsiPeriod + stochPeriod + Math.max(kPeriod, dPeriod);
  if (prices.length < minRequired) {
    return { k: null, d: null };
  }

  // Calculate RSI values for each period
  const rsiValues = [];
  for (let i = rsiPeriod; i < prices.length; i++) {
    const windowPrices = prices.slice(i - rsiPeriod, i + 1);
    const rsi = calculateRSI(windowPrices, rsiPeriod);
    if (rsi !== null) {
      rsiValues.push(rsi);
    }
  }

  if (rsiValues.length < stochPeriod) {
    return { k: null, d: null };
  }

  // Calculate %K values for each RSI window
  const kValues = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const rsiWindow = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const highestRSI = Math.max(...rsiWindow);
    const lowestRSI = Math.min(...rsiWindow);
    const currentRSI = rsiValues[i];

    if (highestRSI === lowestRSI) {
      kValues.push(50); // Default value when no variation
    } else {
      const k = ((currentRSI - lowestRSI) / (highestRSI - lowestRSI)) * 100;
      kValues.push(k);
    }
  }

  if (kValues.length < kPeriod) {
    return { k: null, d: null };
  }

  // Smooth %K (SMA of raw %K values)
  const smoothedK = calculateSMA(kValues.slice(-kPeriod), kPeriod);

  // Calculate %D values (SMA of %K values)
  const dValues = [];
  for (let i = kPeriod - 1; i < kValues.length; i++) {
    const kWindow = kValues.slice(i - kPeriod + 1, i + 1);
    const smoothedKValue = calculateSMA(kWindow, kPeriod);
    if (smoothedKValue !== null) {
      dValues.push(smoothedKValue);
    }
  }

  const smoothedD =
    dValues.length >= dPeriod
      ? calculateSMA(dValues.slice(-dPeriod), dPeriod)
      : null;

  return { k: smoothedK, d: smoothedD };
}

// Helper function to calculate Stochastic RSI
export function calculateStochasticRSI(
  prices,
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
) {
  return calculateStochasticRSIFixed(
    prices,
    rsiPeriod,
    stochPeriod,
    kPeriod,
    dPeriod
  );
}

// Helper function to calculate Parabolic SAR
export function calculateParabolicSAR(highs, lows, step = 0.02, maxStep = 0.2) {
  if (highs.length < 2 || lows.length < 2) return null;

  let sar = lows[0]; // Start with first low
  let isUptrend = true;
  let acceleration = step;
  let extremePoint = highs[0];

  for (let i = 1; i < highs.length; i++) {
    const prevSar = sar;

    if (isUptrend) {
      sar = prevSar + acceleration * (extremePoint - prevSar);

      // Ensure SAR doesn't exceed previous two lows
      if (i >= 2) {
        sar = Math.min(sar, lows[i - 1], lows[i - 2]);
      } else {
        sar = Math.min(sar, lows[i - 1]);
      }

      // Check for trend reversal
      if (lows[i] <= sar) {
        isUptrend = false;
        sar = extremePoint;
        acceleration = step;
        extremePoint = lows[i];
      } else {
        // Update extreme point and acceleration
        if (highs[i] > extremePoint) {
          extremePoint = highs[i];
          acceleration = Math.min(acceleration + step, maxStep);
        }
      }
    } else {
      sar = prevSar + acceleration * (extremePoint - prevSar);

      // Ensure SAR doesn't exceed previous two highs
      if (i >= 2) {
        sar = Math.max(sar, highs[i - 1], highs[i - 2]);
      } else {
        sar = Math.max(sar, highs[i - 1]);
      }

      // Check for trend reversal
      if (highs[i] >= sar) {
        isUptrend = true;
        sar = extremePoint;
        acceleration = step;
        extremePoint = highs[i];
      } else {
        // Update extreme point and acceleration
        if (lows[i] < extremePoint) {
          extremePoint = lows[i];
          acceleration = Math.min(acceleration + step, maxStep);
        }
      }
    }
  }

  return sar;
}

// ✅ OPTIMIZED: Incremental EMA calculation helper
function calculateEMAIncremental(currentPrice, prevEMA, period) {
  if (prevEMA === null) return currentPrice; // First value
  const multiplier = 2 / (period + 1);
  return currentPrice * multiplier + prevEMA * (1 - multiplier);
}

// ✅ OPTIMIZED: Incremental RSI calculation helper
function calculateRSIIncremental(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0,
    losses = 0;

  // Initial calculation for the first RSI
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI for subsequent periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ✅ OPTIMIZED: Fast rolling window calculation for SMA
function calculateSMAFromWindow(window, sum, period) {
  if (window.length < period) return null;
  return sum / period;
}

// ✅ OPTIMIZED: Fast MACD calculation with cached EMAs
function calculateMACDIncremental(price, prevEMA12, prevEMA26, prevSignal) {
  const ema12 =
    prevEMA12 === null ? price : calculateEMAIncremental(price, prevEMA12, 12);
  const ema26 =
    prevEMA26 === null ? price : calculateEMAIncremental(price, prevEMA26, 26);

  if (ema12 === null || ema26 === null) {
    return { macd: null, signal: null, histogram: null, ema12, ema26 };
  }

  const macd = ema12 - ema26;
  const signal =
    prevSignal === null ? macd : calculateEMAIncremental(macd, prevSignal, 9);
  const histogram = signal !== null ? macd - signal : null;

  return { macd, signal, histogram, ema12, ema26 };
}

// ✅ ULTRA-OPTIMIZED: Main calculation function - Updated for MA 20/50 only
export async function calculateAndSaveIndicators(
  symbol,
  timeframe = "1h",
  mode = "incremental"
) {
  console.log(`📊 Hitung indikator untuk ${symbol} (mode: ${mode})`);
  const startTime = Date.now();

  try {
    // ✅ OPTIMIZATION 1: Single parallel query for all data
    const [allCandles, existingIndicators] = await Promise.all([
      prisma.candle.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "asc" },
      }),
      prisma.indicator.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "asc" },
      }),
    ]);

    if (allCandles.length === 0) {
      console.log(`ℹ️ ${symbol}: Tidak ada candle data untuk diproses`);
      return;
    }

    // ✅ OPTIMIZATION 2: Fast Set lookup for existing indicators
    const existingIndicatorTimes = new Set(
      existingIndicators.map((ind) => ind.time.toString())
    );

    // ✅ OPTIMIZATION 3: Create index mapping for fast candle lookup
    const candleIndexMap = new Map();
    for (let i = 0; i < allCandles.length; i++) {
      candleIndexMap.set(allCandles[i].time.toString(), i);
    }

    // ✅ OPTIMIZATION 4: Find starting index for processing
    let startIndex = 0;
    if (mode === "incremental" && existingIndicators.length > 0) {
      const lastIndicatorTime =
        existingIndicators[existingIndicators.length - 1].time;
      const lastIndex = candleIndexMap.get(lastIndicatorTime.toString());
      if (lastIndex !== undefined) {
        startIndex = lastIndex + 1;
      }
    }

    // Early exit if no new candles to process
    if (startIndex >= allCandles.length) {
      console.log(`ℹ️ ${symbol}: Semua candle sudah memiliki indicator`);
      return;
    }

    const candlesToProcess = allCandles.length - startIndex;
    console.log(
      `🔍 ${symbol}: ${candlesToProcess} candle perlu dihitung indicator dari total ${allCandles.length} candle (starting from index ${startIndex})`
    );

    // ✅ OPTIMIZATION 5: Pre-allocate arrays and maintain running windows
    const indicators = [];
    const minRequiredData = 50; // ✅ Updated for SMA50 requirement

    // Rolling windows for efficient calculations
    const closesWindow = [];
    const highsWindow = [];
    const lowsWindow = [];

    // ✅ UPDATED: Cached previous values only for EMA20, EMA50, and MACD
    let prevEma20 = null,
      prevEma50 = null;
    let prevEMA12 = null,
      prevEMA26 = null,
      prevMACDSignal = null;

    // ✅ UPDATED: SMA rolling sums only for SMA20 and SMA50
    let sma20Sum = 0,
      sma50Sum = 0;

    // ✅ OPTIMIZATION 6: Get initial state from last existing indicator
    if (existingIndicators.length > 0) {
      const lastIndicator = existingIndicators[existingIndicators.length - 1];
      prevEma20 = lastIndicator.ema20;
      prevEma50 = lastIndicator.ema50;
      // We'll need to recalculate MACD EMAs from scratch for accuracy
    }

    // ✅ OPTIMIZATION 7: Build initial window from historical data
    const windowStart = Math.max(0, startIndex - 60); // Get context for SMA50
    for (let i = windowStart; i < startIndex; i++) {
      const candle = allCandles[i];
      closesWindow.push(candle.close);
      highsWindow.push(candle.high);
      lowsWindow.push(candle.low);

      // ✅ UPDATED: Update only SMA20 and SMA50 sums
      if (closesWindow.length <= 20) {
        sma20Sum += candle.close;
      } else {
        sma20Sum =
          sma20Sum - closesWindow[closesWindow.length - 21] + candle.close;
      }

      if (closesWindow.length <= 50) {
        sma50Sum += candle.close;
      } else {
        sma50Sum =
          sma50Sum - closesWindow[closesWindow.length - 51] + candle.close;
      }
    }

    // ✅ OPTIMIZATION 8: Process only new candles with direct indexing
    for (let i = startIndex; i < allCandles.length; i++) {
      const candle = allCandles[i];

      // Add current candle to rolling windows
      closesWindow.push(candle.close);
      highsWindow.push(candle.high);
      lowsWindow.push(candle.low);

      // ✅ UPDATED: Update only SMA20 and SMA50 rolling sums
      if (closesWindow.length <= 20) {
        sma20Sum += candle.close;
      } else {
        sma20Sum =
          sma20Sum - closesWindow[closesWindow.length - 21] + candle.close;
      }

      if (closesWindow.length <= 50) {
        sma50Sum += candle.close;
      } else {
        sma50Sum =
          sma50Sum - closesWindow[closesWindow.length - 51] + candle.close;
      }

      // Skip if insufficient historical data
      if (i < minRequiredData - 1) {
        continue;
      }

      // ✅ UPDATED: Calculate only SMA20 and SMA50
      const sma20 =
        closesWindow.length >= 20
          ? sma20Sum / Math.min(20, closesWindow.length)
          : null;
      const sma50 =
        closesWindow.length >= 50
          ? sma50Sum / Math.min(50, closesWindow.length)
          : null;

      // ✅ UPDATED: Calculate EMA20 and EMA50
      const ema20 = calculateEMAIncremental(candle.close, prevEma20, 20);
      const ema50 = calculateEMAIncremental(candle.close, prevEma50, 50);

      // ✅ OPTIMIZATION 11: Incremental MACD calculation
      const macdResult = calculateMACDIncremental(
        candle.close,
        prevEMA12,
        prevEMA26,
        prevMACDSignal
      );

      // ✅ OPTIMIZATION 12: RSI calculation on sliding window
      const rsi =
        closesWindow.length >= 15
          ? calculateRSIIncremental(closesWindow.slice(-15), 14)
          : null;

      // ✅ OPTIMIZATION 13: Bollinger Bands with efficient variance calculation
      let bbUpper = null,
        bbLower = null;
      if (sma20 !== null && closesWindow.length >= 20) {
        const recentPrices = closesWindow.slice(-20);
        let variance = 0;
        for (let j = 0; j < recentPrices.length; j++) {
          variance += Math.pow(recentPrices[j] - sma20, 2);
        }
        variance /= recentPrices.length;
        const stdDev = Math.sqrt(variance);
        bbUpper = sma20 + stdDev * 2;
        bbLower = sma20 - stdDev * 2;
      }

      // ✅ OPTIMIZATION 14: Fixed Stochastic calculation with proper %D
      let stochK = null,
        stochD = null;
      if (highsWindow.length >= 14 && lowsWindow.length >= 14) {
        // Calculate current %K
        const recentHighs = highsWindow.slice(-14);
        const recentLows = lowsWindow.slice(-14);
        const highestHigh = Math.max(...recentHighs);
        const lowestLow = Math.min(...recentLows);

        if (highestHigh !== lowestLow) {
          stochK =
            ((candle.close - lowestLow) / (highestHigh - lowestLow)) * 100;
        } else {
          stochK = 50; // Default when no price variation
        }

        // Calculate %D using proper sliding window approach
        if (indicators.length >= 2) {
          // Need at least 3 %K values for 3-period SMA
          const kValues = [];

          // Get current %K
          kValues.push(stochK);

          // Get previous %K values from stored indicators
          const lookbackStart = Math.max(0, indicators.length - 2);
          for (let j = lookbackStart; j < indicators.length; j++) {
            if (indicators[j].stochK !== null) {
              kValues.push(indicators[j].stochK);
            }
          }

          // Calculate %D as 3-period SMA of %K values
          if (kValues.length >= 3) {
            const recentKValues = kValues.slice(-3); // Take last 3 values
            stochD =
              recentKValues.reduce((sum, val) => sum + val, 0) /
              recentKValues.length;
          }
        }
      }

      // ✅ OPTIMIZATION 15: Simplified Parabolic SAR
      let psar = null;
      if (highsWindow.length >= 2 && lowsWindow.length >= 2) {
        psar = calculateParabolicSAR(
          highsWindow.slice(-50),
          lowsWindow.slice(-50),
          0.02,
          0.2
        );
      }

      // ✅ OPTIMIZATION 16: Fixed Stochastic RSI with proper data window
      let stochRsiK = null,
        stochRsiD = null;
      // Need minimum 31 candles: 14 (RSI) + 14 (Stoch) + 3 (smoothing)
      if (closesWindow.length >= 31) {
        const stochRsiResult = calculateStochasticRSI(
          closesWindow.slice(-50), // Use larger window for better accuracy
          14,
          14,
          3,
          3
        );
        stochRsiK = stochRsiResult.k;
        stochRsiD = stochRsiResult.d;
      }

      // ✅ UPDATED: Store only required indicator data
      indicators.push({
        symbol,
        timeframe,
        time: candle.time,
        sma20, // ✅ SMA 20 for dual MA strategy
        sma50, // ✅ SMA 50 for dual MA strategy
        ema20, // ✅ EMA 20 for momentum analysis
        ema50, // ✅ EMA 50 for trend confirmation
        rsi,
        macd: macdResult.macd,
        macdSignal: macdResult.signal,
        macdHist: macdResult.histogram,
        bbUpper,
        bbLower,
        stochK,
        stochD,
        stochRsiK,
        stochRsiD,
        psar,
      });

      // ✅ UPDATED: Update cached values for next iteration
      prevEma20 = ema20;
      prevEma50 = ema50;
      prevEMA12 = macdResult.ema12;
      prevEMA26 = macdResult.ema26;
      prevMACDSignal = macdResult.signal;

      // ✅ OPTIMIZATION 17: Log progress every 1000 indicators
      if (indicators.length % 1000 === 0) {
        console.log(
          `📊 ${symbol}: Processed ${indicators.length}/${candlesToProcess} new indicators...`
        );
      }
    }

    // ✅ OPTIMIZATION 18: Batch database save with skipDuplicates
    if (indicators.length > 0) {
      await prisma.indicator.createMany({
        data: indicators,
        skipDuplicates: true,
      });

      const elapsed = Date.now() - startTime;
      console.log(
        `✅ ${symbol}: ${indicators.length} indicator baru disimpan dalam ${elapsed}ms (${((indicators.length / elapsed) * 1000).toFixed(0)} indicators/sec)`
      );
    } else {
      console.log(`ℹ️ ${symbol}: Tidak ada indicator baru untuk disimpan`);
    }
  } catch (error) {
    console.error(
      `❌ Error calculating indicators for ${symbol}:`,
      error.message
    );
    throw error;
  }
}

export async function getRecentIndicators(
  symbol,
  limit = 2000, // ✅ Increase default limit
  timeframe = "1h"
) {
  return prisma.indicator.findMany({
    where: { symbol, timeframe },
    orderBy: { time: "desc" }, // ✅ DESC untuk data terbaru dulu
    take: limit,
  });
}
