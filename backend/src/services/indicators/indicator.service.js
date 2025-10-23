import { prisma } from "../../lib/prisma.js";

/* ===========================================================
   📊 TECHNICAL INDICATORS SERVICE (Function-Based High-Performance)
   - Pure functions untuk perhitungan indikator
   - Optimized incremental calculations
   - Sesuai dengan rumus standar industri keuangan
=========================================================== */

// === HELPER FUNCTIONS (Rolling Window) ===
function createRollingWindow(size) {
  const data = new Array(size);
  let sum = 0;
  let index = 0;
  let filled = false;
  let count = 0;

  return {
    add(value) {
      if (filled) {
        sum -= data[index];
      } else if (index === size - 1) {
        filled = true;
      }

      data[index] = value;
      sum += value;
      count = filled ? size : index + 1;
      index = (index + 1) % size;
    },

    getAverage() {
      return count > 0 ? sum / count : null;
    },

    getArray() {
      if (!filled) {
        return data.slice(0, count);
      }
      const result = new Array(size);
      for (let i = 0; i < size; i++) {
        result[i] = data[(index + i) % size];
      }
      return result;
    },

    getMax() {
      if (count === 0) return null;
      let max = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val > max) max = val;
      }
      return max;
    },

    getMin() {
      if (count === 0) return null;
      let min = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val < min) min = val;
      }
      return min;
    },

    isFull() {
      return filled;
    },

    getCount() {
      return count;
    },
  };
}

// === SMA CALCULATOR (Simple Moving Average) ===
function createSMACalculator(period) {
  const window = createRollingWindow(period);

  return {
    calculate(price) {
      window.add(price);
      return window.getAverage();
    },
  };
}

// === EMA CALCULATOR (Exponential Moving Average) ===
function createEMACalculator(period) {
  const multiplier = 2 / (period + 1);
  let ema = null;
  let isInitialized = false;

  return {
    calculate(price) {
      if (!isInitialized) {
        ema = price;
        isInitialized = true;
        return ema;
      }

      // EMA Formula: EMA = (Close × Multiplier) + (Previous EMA × (1 - Multiplier))
      ema = price * multiplier + ema * (1 - multiplier);
      return ema;
    },

    getValue() {
      return ema;
    },
  };
}

// === RSI CALCULATOR (Relative Strength Index - Wilder's Method) ===
function createRSICalculator(period = 14) {
  let avgGain = null;
  let avgLoss = null;
  let lastPrice = null;
  let initialized = false;
  const changes = [];

  return {
    calculate(price) {
      if (lastPrice === null) {
        lastPrice = price;
        return null;
      }

      const change = price - lastPrice;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      changes.push({ gain, loss });

      if (changes.length < period) {
        lastPrice = price;
        return null;
      }

      if (!initialized) {
        // Initial calculation - Simple average for first RSI value
        avgGain = changes.reduce((sum, c) => sum + c.gain, 0) / period;
        avgLoss = changes.reduce((sum, c) => sum + c.loss, 0) / period;
        initialized = true;
      } else {
        // Wilder's smoothing method (Modified Moving Average)
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
      }

      // Keep only last period changes for memory efficiency
      if (changes.length > period) {
        changes.shift();
      }

      lastPrice = price;

      if (avgLoss === 0) return 100;

      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    },
  };
}

// === MACD CALCULATOR (Moving Average Convergence Divergence) ===
function createMACDCalculator(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const fastEMA = createEMACalculator(fastPeriod);
  const slowEMA = createEMACalculator(slowPeriod);
  const signalEMA = createEMACalculator(signalPeriod);

  return {
    calculate(price) {
      const fastEMAValue = fastEMA.calculate(price);
      const slowEMAValue = slowEMA.calculate(price);

      if (fastEMAValue === null || slowEMAValue === null) {
        return {
          macd: null,
          signalLine: null,
          histogram: null,
          fast: fastPeriod,
          slow: slowPeriod,
          signal: signalPeriod,
        };
      }

      const macd = fastEMAValue - slowEMAValue;
      const signal = signalEMA.calculate(macd);
      const histogram = signal !== null ? macd - signal : null;

      return {
        macd: macd,
        signalLine: signal,
        histogram: histogram,
        fast: fastPeriod,
        slow: slowPeriod,
        signal: signalPeriod,
      };
    },
  };
}

// === BOLLINGER BANDS CALCULATOR ===
function createBollingerBandsCalculator(period = 20, multiplier = 2) {
  const sma = createSMACalculator(period);
  const window = createRollingWindow(period);

  return {
    calculate(price) {
      window.add(price);
      const smaValue = sma.calculate(price);

      if (!window.isFull() || smaValue === null) {
        return {
          upper: null,
          lower: null,
          period: period,
          multiplier: multiplier,
        };
      }

      const prices = window.getArray();

      // Calculate standard deviation
      const variance =
        prices.reduce((sum, p) => sum + Math.pow(p - smaValue, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      return {
        upper: smaValue + multiplier * stdDev,
        lower: smaValue - multiplier * stdDev,
        period: period,
        multiplier: multiplier,
      };
    },
  };
}

// === STOCHASTIC OSCILLATOR CALCULATOR ===
function createStochasticCalculator(kPeriod = 14, dPeriod = 3) {
  const highWindow = createRollingWindow(kPeriod);
  const lowWindow = createRollingWindow(kPeriod);
  const kValues = createRollingWindow(dPeriod);

  return {
    calculate(high, low, close) {
      highWindow.add(high);
      lowWindow.add(low);

      if (!highWindow.isFull()) {
        return {
          "%K": null,
          "%D": null,
          kPeriod: kPeriod,
          dPeriod: dPeriod,
        };
      }

      const highestHigh = highWindow.getMax();
      const lowestLow = lowWindow.getMin();

      // %K = ((Current Close - Lowest Low) / (Highest High - Lowest Low)) × 100
      const k = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.add(k);

      const d = kValues.getAverage();

      return {
        "%K": k,
        "%D": d,
        kPeriod: kPeriod,
        dPeriod: dPeriod,
      };
    },
  };
}

// === STOCHASTIC RSI CALCULATOR ===
function createStochasticRSICalculator(
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
) {
  const rsiCalc = createRSICalculator(rsiPeriod);
  const rsiWindow = createRollingWindow(stochPeriod);
  const kValues = createRollingWindow(dPeriod);

  return {
    calculate(price) {
      const rsi = rsiCalc.calculate(price);

      if (rsi === null) {
        return {
          "%K": null,
          "%D": null,
          rsiPeriod: rsiPeriod,
          stochPeriod: stochPeriod,
          kPeriod: kPeriod,
          dPeriod: dPeriod,
        };
      }

      rsiWindow.add(rsi);

      if (!rsiWindow.isFull()) {
        return {
          "%K": null,
          "%D": null,
          rsiPeriod: rsiPeriod,
          stochPeriod: stochPeriod,
          kPeriod: kPeriod,
          dPeriod: dPeriod,
        };
      }

      const highestRSI = rsiWindow.getMax();
      const lowestRSI = rsiWindow.getMin();

      // StochRSI %K = (RSI - Lowest RSI) / (Highest RSI - Lowest RSI) × 100
      const k = ((rsi - lowestRSI) / (highestRSI - lowestRSI)) * 100;
      kValues.add(k);

      const d = kValues.getAverage();

      return {
        "%K": k,
        "%D": d,
        rsiPeriod: rsiPeriod,
        stochPeriod: stochPeriod,
        kPeriod: kPeriod,
        dPeriod: dPeriod,
      };
    },
  };
}

// === PARABOLIC SAR CALCULATOR ===
function createParabolicSARCalculator(step = 0.02, maxStep = 0.2) {
  let sar = null;
  let isUptrend = true;
  let af = step;
  let ep = null;
  let initialized = false;
  let prevHigh = null;
  let prevLow = null;

  return {
    calculate(high, low) {
      if (!initialized) {
        sar = low;
        ep = high;
        prevHigh = high;
        prevLow = low;
        initialized = true;
        return {
          value: sar,
          step: step,
          maxStep: maxStep,
        };
      }

      const prevSAR = sar;

      // Calculate new SAR
      sar = prevSAR + af * (ep - prevSAR);

      if (isUptrend) {
        // Uptrend: SAR cannot be above previous or current low
        sar = Math.min(sar, prevLow, low);

        // Check for trend reversal
        if (low <= sar) {
          isUptrend = false;
          sar = ep; // SAR becomes the previous EP
          af = step; // Reset AF
          ep = low; // New EP is current low
        } else {
          // Update EP and AF if new high
          if (high > ep) {
            ep = high;
            af = Math.min(af + step, maxStep);
          }
        }
      } else {
        // Downtrend: SAR cannot be below previous or current high
        sar = Math.max(sar, prevHigh, high);

        // Check for trend reversal
        if (high >= sar) {
          isUptrend = true;
          sar = ep; // SAR becomes the previous EP
          af = step; // Reset AF
          ep = high; // New EP is current high
        } else {
          // Update EP and AF if new low
          if (low < ep) {
            ep = low;
            af = Math.min(af + step, maxStep);
          }
        }
      }

      prevHigh = high;
      prevLow = low;

      return {
        value: sar,
        step: step,
        maxStep: maxStep,
      };
    },
  };
}

// === SIGNAL CALCULATION FUNCTIONS ===
function calculateSignals(indicators, price) {
  const signals = {};

  // SMA Signal
  if (indicators.sma20 && indicators.sma50 && price) {
    if (
      price > indicators.sma20 &&
      price > indicators.sma50 &&
      indicators.sma20 > indicators.sma50
    ) {
      signals.smaSignal = "buy";
    } else if (
      price < indicators.sma20 &&
      price < indicators.sma50 &&
      indicators.sma20 < indicators.sma50
    ) {
      signals.smaSignal = "sell";
    } else {
      signals.smaSignal = "neutral";
    }
  }

  // EMA Signal
  if (indicators.ema20 && indicators.ema50 && price) {
    if (
      price > indicators.ema20 &&
      price > indicators.ema50 &&
      indicators.ema20 > indicators.ema50
    ) {
      signals.emaSignal = "buy";
    } else if (
      price < indicators.ema20 &&
      price < indicators.ema50 &&
      indicators.ema20 < indicators.ema50
    ) {
      signals.emaSignal = "sell";
    } else {
      signals.emaSignal = "neutral";
    }
  }

  // RSI Signal
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) {
      signals.rsiSignal = "sell"; // Overbought
    } else if (indicators.rsi < 30) {
      signals.rsiSignal = "buy"; // Oversold
    } else {
      signals.rsiSignal = "neutral";
    }
  }

  // MACD Signal
  if (
    indicators.macd !== null &&
    indicators.macdSignal !== null &&
    indicators.macdHist !== null
  ) {
    if (indicators.macd > indicators.macdSignal && indicators.macdHist > 0) {
      signals.macdSignal = "buy";
    } else if (
      indicators.macd < indicators.macdSignal &&
      indicators.macdHist < 0
    ) {
      signals.macdSignal = "sell";
    } else {
      signals.macdSignal = "neutral";
    }
  }

  // Bollinger Bands Signal
  if (indicators.bbUpper && indicators.bbLower && price) {
    const width = indicators.bbUpper - indicators.bbLower;
    if (price > indicators.bbUpper - width * 0.1) {
      signals.bbSignal = "sell"; // Near upper band
    } else if (price < indicators.bbLower + width * 0.1) {
      signals.bbSignal = "buy"; // Near lower band
    } else {
      signals.bbSignal = "neutral";
    }
  }

  // Stochastic Signal
  if (indicators.stochK !== null && indicators.stochD !== null) {
    if (indicators.stochK > 80 && indicators.stochD > 80) {
      signals.stochSignal = "sell"; // Overbought
    } else if (indicators.stochK < 20 && indicators.stochD < 20) {
      signals.stochSignal = "buy"; // Oversold
    } else {
      signals.stochSignal = "neutral";
    }
  }

  // Stochastic RSI Signal
  if (indicators.stochRsiK !== null && indicators.stochRsiD !== null) {
    if (indicators.stochRsiK > 80 && indicators.stochRsiD > 80) {
      signals.stochRsiSignal = "sell";
    } else if (indicators.stochRsiK < 20 && indicators.stochRsiD < 20) {
      signals.stochRsiSignal = "buy";
    } else {
      signals.stochRsiSignal = "neutral";
    }
  }

  // Parabolic SAR Signal
  if (indicators.psar !== null && price) {
    if (price > indicators.psar) {
      signals.psarSignal = "buy";
    } else if (price < indicators.psar) {
      signals.psarSignal = "sell";
    } else {
      signals.psarSignal = "neutral";
    }
  }

  return signals;
}

// === OVERALL SIGNAL ANALYSIS ===
function calculateOverallSignal(signals) {
  const signalValues = Object.values(signals).filter((s) => s !== undefined);
  const totalSignals = signalValues.length;

  if (totalSignals === 0) {
    return { overallSignal: "neutral", signalStrength: 0 };
  }

  const buyCount = signalValues.filter((s) => s === "buy").length;
  const sellCount = signalValues.filter((s) => s === "sell").length;
  const neutralCount = signalValues.filter((s) => s === "neutral").length;

  const buyRatio = buyCount / totalSignals;
  const sellRatio = sellCount / totalSignals;

  // Calculate overall signal based on consensus
  let overallSignal = "neutral";
  let signalStrength = 0;

  if (buyRatio >= 0.7) {
    overallSignal = "strong_buy";
    signalStrength = buyRatio;
  } else if (buyRatio >= 0.6) {
    overallSignal = "buy";
    signalStrength = buyRatio;
  } else if (sellRatio >= 0.7) {
    overallSignal = "strong_sell";
    signalStrength = sellRatio;
  } else if (sellRatio >= 0.6) {
    overallSignal = "sell";
    signalStrength = sellRatio;
  } else {
    overallSignal = "neutral";
    signalStrength = Math.max(buyRatio, sellRatio);
  }

  return { overallSignal, signalStrength };
}

// === MAIN CALCULATION FUNCTION ===
export async function calculateAndSaveIndicators(symbol, timeframe = "1h") {
  console.log(`📊 Calculating indicators for ${symbol}...`);
  const start = Date.now();

  const [candles, existing] = await Promise.all([
    prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
    }),
    prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
    }),
  ]);

  if (!candles.length) {
    console.log("No candles found.");
    return;
  }

  const startIdx = existing.length
    ? candles.findIndex(
        (c) => Number(c.time) === Number(existing.at(-1).time)
      ) + 1
    : 0;

  if (startIdx >= candles.length) {
    console.log("Already up to date.");
    return;
  }

  // Initialize all function-based calculators
  const sma20 = createSMACalculator(20);
  const sma50 = createSMACalculator(50);
  const ema20 = createEMACalculator(20);
  const ema50 = createEMACalculator(50);
  const rsi = createRSICalculator(14);
  const macd = createMACDCalculator(12, 26, 9);
  const bb = createBollingerBandsCalculator(20, 2);
  const stoch = createStochasticCalculator(14, 3);
  const stochRSI = createStochasticRSICalculator(14, 14, 3, 3);
  const psar = createParabolicSARCalculator(0.02, 0.2);

  const results = [];

  // Process all candles (including historical for proper warmup)
  for (let i = 0; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // Calculate all indicators
    const sma20Val = sma20.calculate(close);
    const sma50Val = sma50.calculate(close);
    const ema20Val = ema20.calculate(close);
    const ema50Val = ema50.calculate(close);
    const rsiVal = rsi.calculate(close);
    const macdVal = macd.calculate(close);
    const bbVal = bb.calculate(close);
    const stochVal = stoch.calculate(high, low, close);
    const stochRSIVal = stochRSI.calculate(close);
    const psarVal = psar.calculate(high, low);

    // Only save indicators after warmup period and for new data
    if (i >= startIdx && i >= 50) {
      // 50 period warmup
      const indicators = {
        sma20: sma20Val,
        sma50: sma50Val,
        ema20: ema20Val,
        ema50: ema50Val,
        rsi: rsiVal,
        macd: macdVal.macd,
        macdSignalLine: macdVal.signalLine, // Updated field name
        macdHist: macdVal.histogram,
        bbUpper: bbVal.upper,
        bbLower: bbVal.lower,
        stochK: stochVal["%K"],
        stochD: stochVal["%D"],
        stochRsiK: stochRSIVal["%K"],
        stochRsiD: stochRSIVal["%D"],
        psar: psarVal.value,
      };

      // Calculate individual signals
      const signals = calculateSignals(indicators, close);

      // Calculate overall signal and strength
      const overallAnalysis = calculateOverallSignal(signals);

      results.push({
        symbol,
        timeframe,
        time,
        ...indicators,
        // Store individual signals in database for better performance
        smaSignal: signals.smaSignal,
        emaSignal: signals.emaSignal,
        rsiSignal: signals.rsiSignal,
        macdSignal: signals.macdSignal,
        bbSignal: signals.bbSignal,
        stochSignal: signals.stochSignal,
        stochRsiSignal: signals.stochRsiSignal,
        psarSignal: signals.psarSignal,
        // Store overall analysis
        overallSignal: overallAnalysis.overallSignal,
        signalStrength: overallAnalysis.signalStrength,
      });
    }
  }

  if (results.length > 0) {
    await prisma.indicator.createMany({
      data: results,
      skipDuplicates: true,
    });
  }

  console.log(
    `✅ ${symbol}: ${results.length} indicators calculated and saved (${Date.now() - start}ms)`
  );
}

export async function getRecentIndicators(
  symbol,
  limit = 2000,
  timeframe = "1h"
) {
  return prisma.indicator.findMany({
    where: { symbol, timeframe },
    orderBy: { time: "desc" },
    take: limit,
  });
}

// === BACKFILL SIGNALS FOR EXISTING DATA ===
export async function backfillSignalsForExistingData(symbol, timeframe = "1h") {
  console.log(`🔄 Backfilling signals for ${symbol}...`);
  const start = Date.now();

  // Get indicators that don't have signals (where overallSignal is null)
  const indicatorsWithoutSignals = await prisma.indicator.findMany({
    where: {
      symbol,
      timeframe,
      OR: [
        { overallSignal: null },
        { smaSignal: null },
        { emaSignal: null },
        { rsiSignal: null },
      ],
    },
    orderBy: { time: "asc" },
  });

  if (indicatorsWithoutSignals.length === 0) {
    console.log(`✅ All indicators for ${symbol} already have signals`);
    return;
  }

  console.log(
    `📊 Found ${indicatorsWithoutSignals.length} indicators without signals for ${symbol}`
  );

  // Process in batches to avoid PostgreSQL bind variable limit (32767)
  const QUERY_BATCH_SIZE = 1000; // Safe batch size for queries
  const UPDATE_BATCH_SIZE = 100; // Batch size for updates

  let totalUpdated = 0;

  for (let i = 0; i < indicatorsWithoutSignals.length; i += QUERY_BATCH_SIZE) {
    const indicatorBatch = indicatorsWithoutSignals.slice(
      i,
      i + QUERY_BATCH_SIZE
    );
    const times = indicatorBatch.map((ind) => ind.time);

    console.log(
      `📊 Processing batch ${Math.floor(i / QUERY_BATCH_SIZE) + 1}/${Math.ceil(indicatorsWithoutSignals.length / QUERY_BATCH_SIZE)} (${indicatorBatch.length} indicators)...`
    );

    // Get corresponding candles for this batch
    const candles = await prisma.candle.findMany({
      where: {
        symbol,
        timeframe,
        time: { in: times },
      },
    });

    // Create a map for quick lookup
    const candleMap = new Map();
    candles.forEach((candle) => {
      candleMap.set(candle.time.toString(), candle);
    });

    const updates = [];

    // Calculate signals for each indicator in this batch
    for (const indicator of indicatorBatch) {
      const candle = candleMap.get(indicator.time.toString());
      if (!candle) {
        console.log(`⚠️ No candle found for indicator time ${indicator.time}`);
        continue;
      }

      const price = candle.close;

      // Create indicators object for signal calculation
      const indicators = {
        sma20: indicator.sma20,
        sma50: indicator.sma50,
        ema20: indicator.ema20,
        ema50: indicator.ema50,
        rsi: indicator.rsi,
        macd: indicator.macd,
        macdSignal: indicator.macdSignalLine, // Note: using macdSignalLine from DB
        macdHist: indicator.macdHist,
        bbUpper: indicator.bbUpper,
        bbLower: indicator.bbLower,
        stochK: indicator.stochK,
        stochD: indicator.stochD,
        stochRsiK: indicator.stochRsiK,
        stochRsiD: indicator.stochRsiD,
        psar: indicator.psar,
      };

      // Calculate individual signals
      const signals = calculateSignals(indicators, price);

      // Calculate overall signal and strength
      const overallAnalysis = calculateOverallSignal(signals);

      updates.push({
        id: indicator.id,
        smaSignal: signals.smaSignal || null,
        emaSignal: signals.emaSignal || null,
        rsiSignal: signals.rsiSignal || null,
        macdSignal: signals.macdSignal || null,
        bbSignal: signals.bbSignal || null,
        stochSignal: signals.stochSignal || null,
        stochRsiSignal: signals.stochRsiSignal || null,
        psarSignal: signals.psarSignal || null,
        overallSignal: overallAnalysis.overallSignal,
        signalStrength: overallAnalysis.signalStrength,
      });
    }

    // Batch update in smaller chunks to avoid timeout
    for (let j = 0; j < updates.length; j += UPDATE_BATCH_SIZE) {
      const updateBatch = updates.slice(j, j + UPDATE_BATCH_SIZE);

      // Use transaction for batch updates
      await prisma.$transaction(async (tx) => {
        for (const update of updateBatch) {
          await tx.indicator.update({
            where: { id: update.id },
            data: {
              smaSignal: update.smaSignal,
              emaSignal: update.emaSignal,
              rsiSignal: update.rsiSignal,
              macdSignal: update.macdSignal,
              bbSignal: update.bbSignal,
              stochSignal: update.stochSignal,
              stochRsiSignal: update.stochRsiSignal,
              psarSignal: update.psarSignal,
              overallSignal: update.overallSignal,
              signalStrength: update.signalStrength,
            },
          });
        }
      });

      totalUpdated += updateBatch.length;

      // Log progress every 500 updates
      if (
        totalUpdated % 500 === 0 ||
        totalUpdated === indicatorsWithoutSignals.length
      ) {
        console.log(
          `📊 Updated signals for ${totalUpdated}/${indicatorsWithoutSignals.length} indicators...`
        );
      }
    }

    // Small delay between batches to prevent overwhelming the database
    if (i + QUERY_BATCH_SIZE < indicatorsWithoutSignals.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const duration = Date.now() - start;
  console.log(
    `✅ ${symbol}: Backfilled signals for ${totalUpdated} indicators (${duration}ms)`
  );
}

// === BACKFILL ALL SYMBOLS ===
export async function backfillAllSymbolsSignals(timeframe = "1h") {
  console.log(`🚀 Starting backfill signals for all symbols...`);

  // Get all unique symbols that have indicators
  const symbols = await prisma.indicator.findMany({
    where: { timeframe },
    select: { symbol: true },
    distinct: ["symbol"],
  });

  console.log(`📊 Found ${symbols.length} symbols to backfill`);

  for (const { symbol } of symbols) {
    try {
      await backfillSignalsForExistingData(symbol, timeframe);
    } catch (error) {
      console.error(
        `❌ Failed to backfill signals for ${symbol}:`,
        error.message
      );
    }
  }

  console.log(`🎉 Completed backfill signals for all symbols`);
}
