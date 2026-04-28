import { calculateSignals } from "../signals/signalAnalyzer.js";
import { calculateOverallSignal } from "../signals/overallAnalyzer.js";
import {
  calculateAllIndicators,
  INDICATOR_WARMUP_CANDLES,
  initializeCalculators,
  warmupCalculators,
} from "./indicator.calc.js";
import { calculateOverallSignalOptimized } from "./weights.cache.js";
import { createManyIndicators, pingDatabase } from "./indicator.repository.js";

// File batch processing indikator.
// Tujuan: menampung looping berat (normal dan batch) agar service utama tetap ringkas.

// Process normal (< 1000 missing candles)
export async function processIndicators(
  symbol,
  timeframe,
  candles,
  existingTimes,
  coinId,
  timeframeId,
) {
  const start = Date.now();
  const calculators = initializeCalculators();
  const results = [];

  // Process all candles (termasuk historis untuk warmup yang benar)
  for (let i = 0; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // Calculate all indicators
    const indicators = calculateAllIndicators(calculators, close, high, low);

    // Hanya simpan jika: sudah melewati warmup DAN belum ada di database
    if (i >= INDICATOR_WARMUP_CANDLES && !existingTimes.has(Number(time))) {
      const signals = calculateSignals(indicators, close);
      const overallAnalysis = await calculateOverallSignal(
        signals,
        symbol,
        timeframe,
      );

      results.push({
        coinId,
        timeframeId,
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
    await createManyIndicators(results);
    console.log(
      `✅ ${symbol}: ${results.length} new indicators calculated and saved (${Date.now() - start}ms)`,
    );
  } else {
    console.log(
      `✅ ${symbol}: No new indicators to save (${Date.now() - start}ms)`,
    );
  }

  return results.length;
}

// Batch processing untuk dataset besar
export async function calculateInBatches(
  symbol,
  timeframe,
  candles,
  existingTimes,
  coinId,
  timeframeId,
) {
  const start = Date.now();

  // Inisialisasi kalkulator sekali saja
  const calculators = initializeCalculators();

  // Warmup calculators berdasarkan buffer candle konfigurasi.
  for (let i = 0; i < Math.min(INDICATOR_WARMUP_CANDLES, candles.length); i++) {
    const { close, high, low } = candles[i];
    warmupCalculators(calculators, close, high, low);
  }

  let totalSaved = 0;
  const BATCH_SIZE = 1000;
  const results = [];
  let lastPing = Date.now();
  const PING_INTERVAL = 30000; // Ping every 30 seconds

  // Process candles after warmup
  for (let i = INDICATOR_WARMUP_CANDLES; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];

    // ✅ Periodic database ping to keep connection alive
    if (Date.now() - lastPing > PING_INTERVAL) {
      await pingDatabase();
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
      timeframe,
    );

    results.push({
      coinId,
      timeframeId,
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
      await createManyIndicators(results);
      totalSaved += results.length;
      console.log(
        `   💾 ${symbol}: Saved batch ${Math.floor(totalSaved / BATCH_SIZE)} (${totalSaved} total)`,
      );
      results.length = 0; // Clear array
    }
  }

  // Save remaining
  if (results.length > 0) {
    await createManyIndicators(results);
    totalSaved += results.length;
  }

  console.log(
    `✅ ${symbol}: ${totalSaved} indicators calculated and saved in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
  return totalSaved;
}
