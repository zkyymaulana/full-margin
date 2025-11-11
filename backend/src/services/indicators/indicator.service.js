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

  // Inisialisasi semua kalkulator indikator
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
}
