import { prisma } from "../../lib/prisma.js";
import {
  createSMACalculator,
  createEMACalculator,
  createRSICalculator,
  createMACDCalculator,
  createBollingerBandsCalculator,
  createStochasticCalculator,
  createStochasticRSICalculator,
  createParabolicSARCalculator,
} from "../indicators/index.js";

import { calculateSignals } from "../signals/signalAnalyzer.js";
import { calculateOverallSignal } from "../signals/overallAnalyzer.js";

// === MAIN CALCULATION FUNCTION WITH BATCH PROCESSING ===
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
    console.log(`⚠️ No candles found for ${symbol}.`);
    return;
  }

  // Buat Set dari waktu indicator yang sudah ada untuk cek cepat
  const existingTimes = new Set(existing.map((e) => Number(e.time)));

  // Cari candle yang belum memiliki indikator
  const missingCandles = candles.filter(
    (c, idx) => idx >= 50 && !existingTimes.has(Number(c.time))
  );

  if (missingCandles.length === 0) {
    console.log(`✅ ${symbol}: All indicators up to date.`);
    return;
  }

  console.log(
    `🔍 ${symbol}: Found ${missingCandles.length} candles without indicators`
  );

  // ✅ BATCH PROCESSING: Jika terlalu banyak, proses secara bertahap
  const BATCH_SIZE = 1000; // Process 1000 indicators at a time
  if (missingCandles.length > BATCH_SIZE) {
    console.log(`⚙️ ${symbol}: Processing in batches of ${BATCH_SIZE}...`);
    return await calculateInBatches(symbol, timeframe, candles, existingTimes);
  }

  // Process normal (< 1000 missing candles)
  return await processIndicators(symbol, timeframe, candles, existingTimes);
}

// ✅ NEW: Batch processing for large datasets
async function calculateInBatches(symbol, timeframe, candles, existingTimes) {
  const start = Date.now();

  // Inisialisasi kalkulator sekali saja
  const calculators = initializeCalculators();

  // Warmup calculators dengan 50 candle pertama
  for (let i = 0; i < Math.min(50, candles.length); i++) {
    const { close, high, low } = candles[i];
    warmupCalculators(calculators, close, high, low);
  }

  let totalSaved = 0;
  const BATCH_SIZE = 1000;
  const results = [];
  let lastPing = Date.now();
  const PING_INTERVAL = 30000; // Ping every 30 seconds

  // Process candles after warmup
  for (let i = 50; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // ✅ Periodic database ping to keep connection alive
    if (Date.now() - lastPing > PING_INTERVAL) {
      await prisma.$queryRaw`SELECT 1`; // Simple ping query
      lastPing = Date.now();
    }

    // Skip if already exists
    if (existingTimes.has(Number(time))) {
      warmupCalculators(calculators, close, high, low);
      continue;
    }

    // Calculate indicators
    const indicators = calculateAllIndicators(calculators, close, high, low);
    const signals = calculateSignals(indicators, close);

    // ✅ Get weights once per symbol (cache it)
    const overallAnalysis = await calculateOverallSignalOptimized(
      signals,
      symbol,
      timeframe
    );

    results.push({
      symbol,
      timeframe,
      time,
      ...indicators,
      smaSignal: signals.smaSignal,
      emaSignal: signals.emaSignal,
      rsiSignal: signals.rsiSignal,
      macdSignal: signals.macdSignal,
      bbSignal: signals.bbSignal,
      stochSignal: signals.stochSignal,
      stochRsiSignal: signals.stochRsiSignal,
      psarSignal: signals.psarSignal,
      overallSignal: overallAnalysis.overallSignal,
      signalStrength: overallAnalysis.signalStrength,
      finalScore: overallAnalysis.finalScore,
    });

    // Save in batches
    if (results.length >= BATCH_SIZE) {
      await prisma.indicator.createMany({
        data: results,
        skipDuplicates: true,
      });
      totalSaved += results.length;
      console.log(
        `   💾 ${symbol}: Saved batch ${Math.floor(totalSaved / BATCH_SIZE)} (${totalSaved} total)`
      );
      results.length = 0; // Clear array
    }
  }

  // Save remaining
  if (results.length > 0) {
    await prisma.indicator.createMany({
      data: results,
      skipDuplicates: true,
    });
    totalSaved += results.length;
  }

  console.log(
    `✅ ${symbol}: ${totalSaved} indicators calculated and saved in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
  return totalSaved;
}

// ✅ NEW: Process normal size datasets
async function processIndicators(symbol, timeframe, candles, existingTimes) {
  const start = Date.now();
  const calculators = initializeCalculators();
  const results = [];

  // Process all candles (including historical for proper warmup)
  for (let i = 0; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // Calculate all indicators
    const sma20Val = calculators.sma20.calculate(close);
    const sma50Val = calculators.sma50.calculate(close);
    const ema20Val = calculators.ema20.calculate(close);
    const ema50Val = calculators.ema50.calculate(close);
    const rsiVal = calculators.rsi.calculate(close);
    const macdVal = calculators.macd.calculate(close);
    const bbVal = calculators.bb.calculate(close);
    const stochVal = calculators.stoch.calculate(high, low, close);
    const stochRSIVal = calculators.stochRSI.calculate(close);
    const psarVal = calculators.psar.calculate(high, low);

    // Hanya simpan jika: sudah melewati warmup (50 period) DAN belum ada di database
    if (i >= 50 && !existingTimes.has(Number(time))) {
      const indicators = {
        sma20: sma20Val,
        sma50: sma50Val,
        ema20: ema20Val,
        ema50: ema50Val,
        rsi: rsiVal,
        macd: macdVal.macd,
        macdSignalLine: macdVal.signalLine,
        macdHist: macdVal.histogram,
        bbUpper: bbVal.upper,
        bbMiddle: bbVal.middle ?? bbVal.sma ?? sma20Val,
        bbLower: bbVal.lower,
        stochK: stochVal["%K"],
        stochD: stochVal["%D"],
        stochRsiK: stochRSIVal["%K"],
        stochRsiD: stochRSIVal["%D"],
        psar: psarVal.value,
      };

      const signals = calculateSignals(indicators, close);
      const overallAnalysis = await calculateOverallSignal(
        signals,
        symbol,
        timeframe
      );

      results.push({
        symbol,
        timeframe,
        time,
        ...indicators,
        smaSignal: signals.smaSignal,
        emaSignal: signals.emaSignal,
        rsiSignal: signals.rsiSignal,
        macdSignal: signals.macdSignal,
        bbSignal: signals.bbSignal,
        stochSignal: signals.stochSignal,
        stochRsiSignal: signals.stochRsiSignal,
        psarSignal: signals.psarSignal,
        overallSignal: overallAnalysis.overallSignal,
        signalStrength: overallAnalysis.signalStrength,
        finalScore: overallAnalysis.finalScore,
      });
    }
  }

  if (results.length > 0) {
    await prisma.indicator.createMany({
      data: results,
      skipDuplicates: true,
    });
    console.log(
      `✅ ${symbol}: ${results.length} new indicators calculated and saved (${Date.now() - start}ms)`
    );
  } else {
    console.log(
      `✅ ${symbol}: No new indicators to save (${Date.now() - start}ms)`
    );
  }
  return results.length;
}

// ✅ NEW: Helper functions
function initializeCalculators() {
  return {
    sma20: createSMACalculator(20),
    sma50: createSMACalculator(50),
    ema20: createEMACalculator(20),
    ema50: createEMACalculator(50),
    rsi: createRSICalculator(14),
    macd: createMACDCalculator(12, 26, 9),
    bb: createBollingerBandsCalculator(20, 2),
    stoch: createStochasticCalculator(14, 3),
    stochRSI: createStochasticRSICalculator(14, 14, 3, 3),
    psar: createParabolicSARCalculator(0.02, 0.2),
  };
}

function warmupCalculators(calculators, close, high, low) {
  calculators.sma20.calculate(close);
  calculators.sma50.calculate(close);
  calculators.ema20.calculate(close);
  calculators.ema50.calculate(close);
  calculators.rsi.calculate(close);
  calculators.macd.calculate(close);
  calculators.bb.calculate(close);
  calculators.stoch.calculate(high, low, close);
  calculators.stochRSI.calculate(close);
  calculators.psar.calculate(high, low);
}

function calculateAllIndicators(calculators, close, high, low) {
  const sma20Val = calculators.sma20.calculate(close);
  const sma50Val = calculators.sma50.calculate(close);
  const ema20Val = calculators.ema20.calculate(close);
  const ema50Val = calculators.ema50.calculate(close);
  const rsiVal = calculators.rsi.calculate(close);
  const macdVal = calculators.macd.calculate(close);
  const bbVal = calculators.bb.calculate(close);
  const stochVal = calculators.stoch.calculate(high, low, close);
  const stochRSIVal = calculators.stochRSI.calculate(close);
  const psarVal = calculators.psar.calculate(high, low);

  return {
    sma20: sma20Val,
    sma50: sma50Val,
    ema20: ema20Val,
    ema50: ema50Val,
    rsi: rsiVal,
    macd: macdVal.macd,
    macdSignalLine: macdVal.signalLine,
    macdHist: macdVal.histogram,
    bbUpper: bbVal.upper,
    bbMiddle: bbVal.middle ?? bbVal.sma ?? sma20Val,
    bbLower: bbVal.lower,
    stochK: stochVal["%K"],
    stochD: stochVal["%D"],
    stochRsiK: stochRSIVal["%K"],
    stochRsiD: stochRSIVal["%D"],
    psar: psarVal.value,
  };
}

// ✅ Cache untuk weights per symbol
const weightsCache = new Map();

async function calculateOverallSignalOptimized(signals, symbol, timeframe) {
  // Check cache first
  let weights = weightsCache.get(symbol);

  if (!weights) {
    // Load weights from database (from indicatorWeight table, not backtestResult)
    const weightRecord = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
      select: {
        weights: true,
      },
    });

    // Use weights or fallback to equal weights
    if (weightRecord?.weights) {
      weights = weightRecord.weights;
    } else {
      // Equal weights fallback
      weights = {
        SMA: 1,
        EMA: 1,
        RSI: 1,
        MACD: 1,
        BollingerBands: 1,
        Stochastic: 1,
        StochasticRSI: 1,
        PSAR: 1,
      };
    }

    weightsCache.set(symbol, weights);
  }

  // Use cached weights to avoid DB query for every indicator
  return calculateOverallSignal(signals, symbol, timeframe, weights);
}
