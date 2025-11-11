// === MACD CALCULATOR (Moving Average Convergence Divergence) ===
// Mengukur kekuatan tren dengan melihat perbedaan dua EMA (biasanya 12 dan 26).
import { createEMACalculator } from "./ema.service.js";

export function createMACDCalculator(
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

      // Belum cukup data untuk menghitung MACD
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

      // Rumus MACD:
      // MACD = EMA(fast) − EMA(slow)
      const macd = fastEMAValue - slowEMAValue;

      // Rumus Signal Line:
      // Signal = EMA(MACD, periode = 9)
      const signal = signalEMA.calculate(macd);

      // Rumus Histogram:
      // Histogram = MACD − Signal Line
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
