import { createSMACalculator } from "./sma.service.js";
import { createEMACalculator } from "./ema.service.js";
import { createRSICalculator } from "./rsi.service.js";
import { createMACDCalculator } from "./macd.service.js";
import { createBollingerBandsCalculator } from "./bollinger.service.js";
import { createStochasticCalculator } from "./stochastic.service.js";
import { createStochasticRSICalculator } from "./stochRsi.service.js";
import { createParabolicSARCalculator } from "./psar.service.js";

// File kalkulasi indikator.
// Tujuan: menampung seluruh logika teknikal (warmup, kalkulator, hasil indikator).

// Minimal warmup mengikuti periode indikator terpanjang yang aktif (SMA50).
const MIN_REQUIRED_WARMUP_CANDLES = 50;

export const INDICATOR_WARMUP_CANDLES = Math.max(
  MIN_REQUIRED_WARMUP_CANDLES,
  Number(process.env.INDICATOR_WARMUP_CANDLES || "20"),
);

export function timeframeToMs(timeframe = "1h") {
  // Konversi timeframe teks (contoh: 15m, 1h, 1d) menjadi milidetik.
  const normalized = timeframe.toLowerCase();
  const match = normalized.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return 60 * 60 * 1000;

  const value = Number(match[1]);
  const unit = match[2];
  const unitToMs = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * unitToMs[unit];
}

export function initializeCalculators() {
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

export function warmupCalculators(calculators, close, high, low) {
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

export function calculateAllIndicators(calculators, close, high, low) {
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
