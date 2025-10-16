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

// Helper function to calculate Stochastic RSI
export function calculateStochasticRSI(
  prices,
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
) {
  if (prices.length < rsiPeriod + stochPeriod) return { k: null, d: null };

  // Calculate RSI values for the stochastic period
  const rsiValues = [];
  for (let i = rsiPeriod; i < prices.length; i++) {
    const windowPrices = prices.slice(i - rsiPeriod, i + 1);
    const rsi = calculateRSI(windowPrices, rsiPeriod);
    if (rsi !== null) rsiValues.push(rsi);
  }

  if (rsiValues.length < stochPeriod) return { k: null, d: null };

  // Apply stochastic formula to RSI values
  const recentRSI = rsiValues.slice(-stochPeriod);
  const highestRSI = Math.max(...recentRSI);
  const lowestRSI = Math.min(...recentRSI);
  const currentRSI = rsiValues[rsiValues.length - 1];

  const rawK = ((currentRSI - lowestRSI) / (highestRSI - lowestRSI)) * 100;

  // Smooth %K and %D
  const kValues = [];
  for (
    let i = Math.max(0, rsiValues.length - kPeriod);
    i < rsiValues.length;
    i++
  ) {
    const windowRSI = rsiValues.slice(Math.max(0, i - stochPeriod + 1), i + 1);
    if (windowRSI.length === stochPeriod) {
      const windowHighest = Math.max(...windowRSI);
      const windowLowest = Math.min(...windowRSI);
      const windowK =
        ((rsiValues[i] - windowLowest) / (windowHighest - windowLowest)) * 100;
      kValues.push(windowK);
    }
  }

  const k = kValues.length >= kPeriod ? calculateSMA(kValues, kPeriod) : null;

  const dValues = [];
  for (let i = Math.max(0, kValues.length - dPeriod); i < kValues.length; i++) {
    dValues.push(kValues[i]);
  }
  const d = dValues.length >= dPeriod ? calculateSMA(dValues, dPeriod) : null;

  return { k, d };
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

// Main function to calculate and save indicators
export async function calculateAndSaveIndicators(
  symbol,
  timeframe = "1h",
  mode = "incremental"
) {
  console.log(`📊 Hitung indikator untuk ${symbol} (mode: ${mode})`);

  try {
    let whereClause = { symbol, timeframe };

    // For incremental mode, only process candles after the last indicator
    if (mode === "incremental") {
      const lastIndicator = await prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      });

      if (lastIndicator) {
        whereClause.time = { gt: lastIndicator.time };
      }
    }

    // ✅ PERBAIKAN: Ambil semua data candle yang tersedia (tanpa limit) untuk perhitungan yang akurat
    const allCandles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
      // Hapus limit untuk memastikan data cukup
    });

    if (allCandles.length === 0) {
      console.log(`ℹ️ ${symbol}: Tidak ada candle data untuk diproses`);
      return;
    }

    console.log(
      `🔍 ${symbol}: Memproses ${allCandles.length} candle data untuk perhitungan indicator`
    );

    // ✅ PERBAIKAN: Untuk mode incremental, tentukan candle mana yang perlu dihitung indicator-nya
    let candlesToProcess = allCandles;
    if (mode === "incremental") {
      const lastIndicator = await prisma.indicator.findFirst({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
      });

      if (lastIndicator) {
        const lastIndicatorIndex = allCandles.findIndex(
          (c) => c.time > lastIndicator.time
        );
        if (lastIndicatorIndex > 0) {
          // Ambil sedikit data sebelumnya untuk konteks, tapi hanya simpan yang baru
          const contextStart = Math.max(0, lastIndicatorIndex - 50);
          candlesToProcess = allCandles.slice(contextStart);
        }
      }
    }

    const indicators = [];
    const closes = candlesToProcess.map((c) => c.close);
    const highs = candlesToProcess.map((c) => c.high);
    const lows = candlesToProcess.map((c) => c.low);

    // ✅ Calculate indicators for each candle dengan data konteks yang cukup
    for (let i = 0; i < candlesToProcess.length; i++) {
      const candle = candlesToProcess[i];

      // ✅ PERBAIKAN: Untuk mode incremental, skip candle yang sudah ada indicator-nya
      if (mode === "incremental") {
        const existingIndicator = await prisma.indicator.findFirst({
          where: { symbol, timeframe, time: candle.time },
        });
        if (existingIndicator) continue;
      }

      // ✅ PERBAIKAN: Gunakan semua data dari awal untuk perhitungan yang akurat
      const globalIndex = allCandles.findIndex((c) => c.time === candle.time);
      if (globalIndex === -1) continue;

      const currentCloses = allCandles
        .slice(0, globalIndex + 1)
        .map((c) => c.close);
      const currentHighs = allCandles
        .slice(0, globalIndex + 1)
        .map((c) => c.high);
      const currentLows = allCandles
        .slice(0, globalIndex + 1)
        .map((c) => c.low);

      // ✅ Skip jika data tidak cukup untuk perhitungan indicator
      if (currentCloses.length < 26) {
        console.log(
          `⏭️ ${symbol}: Skip candle ${globalIndex + 1}/${allCandles.length} - data tidak cukup (butuh min 26, ada ${currentCloses.length})`
        );
        continue;
      }

      // Calculate all moving averages
      const sma5 = calculateSMA(currentCloses, 5);
      const sma20 = calculateSMA(currentCloses, 20);

      // ✅ PERBAIKAN: Untuk EMA, gunakan nilai sebelumnya yang sudah dihitung
      let ema5, ema20;
      if (indicators.length > 0) {
        ema5 = calculateEMA(
          currentCloses,
          5,
          indicators[indicators.length - 1]?.ema5
        );
        ema20 = calculateEMA(
          currentCloses,
          20,
          indicators[indicators.length - 1]?.ema20
        );
      } else {
        ema5 = calculateEMA(currentCloses, 5);
        ema20 = calculateEMA(currentCloses, 20);
      }

      // Calculate other indicators
      const rsi = calculateRSI(currentCloses, 14);
      const macd = calculateMACD(currentCloses, 12, 26, 9);
      const bb = calculateBollingerBands(currentCloses, 20, 2);
      const stoch = calculateStochastic(
        currentHighs,
        currentLows,
        currentCloses,
        14,
        3
      );
      const stochRsi = calculateStochasticRSI(currentCloses, 14, 14, 3, 3);
      const psar = calculateParabolicSAR(currentHighs, currentLows, 0.02, 0.2);

      indicators.push({
        symbol,
        timeframe,
        time: candle.time,
        sma5,
        sma20,
        ema5,
        ema20,
        rsi,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHist: macd.histogram,
        bbUpper: bb.upper,
        bbLower: bb.lower,
        stochK: stoch.k,
        stochD: stoch.d,
        stochRsiK: stochRsi.k,
        stochRsiD: stochRsi.d,
        psar,
      });

      // ✅ Log progress untuk monitoring
      if (indicators.length % 100 === 0) {
        console.log(
          `📊 ${symbol}: Processed ${indicators.length} indicators...`
        );
      }
    }

    // Save to database
    if (indicators.length > 0) {
      await prisma.indicator.createMany({
        data: indicators,
        skipDuplicates: true,
      });

      // ✅ Log statistik hasil perhitungan
      const validIndicators = indicators.filter(
        (ind) => ind.sma5 !== null || ind.rsi !== null || ind.macd !== null
      ).length;

      console.log(
        `✅ ${symbol}: ${indicators.length} indikator disimpan (${validIndicators} dengan data valid)`
      );
    } else {
      console.log(`ℹ️ ${symbol}: Tidak ada indikator baru untuk disimpan`);
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
  limit = 500,
  timeframe = "1h"
) {
  return prisma.indicator.findMany({
    where: { symbol, timeframe },
    orderBy: { time: "desc" },
    take: limit,
  });
}
