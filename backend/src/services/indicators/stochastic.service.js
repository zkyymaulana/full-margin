// === STOCHASTIC OSCILLATOR CALCULATOR ===
// Mengukur posisi harga penutupan relatif terhadap rentang harga tertinggi dan terendah.
import { createRollingWindow } from "../../utils/rollingWindow.js";

// Buat kalkulator Stochastic Oscillator (%K dan %D).
export function createStochasticCalculator(kPeriod = 14, dPeriod = 3) {
  const highWindow = createRollingWindow(kPeriod);
  const lowWindow = createRollingWindow(kPeriod);
  const kValues = createRollingWindow(dPeriod);

  return {
    calculate(high, low, close) {
      // Simpan nilai tertinggi dan terendah ke dalam window
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
      const range = highestHigh - lowestLow;

      // Rumus %K:
      // %K = ((Close - LowestLow) / (HighestHigh - LowestLow)) × 100
      // Menunjukkan posisi harga saat ini dalam rentang harga terbaru
      const rawK = range === 0 ? 50 : ((close - lowestLow) / range) * 100;
      const k = Math.min(100, Math.max(0, rawK));
      kValues.add(k);

      // Rumus %D:
      // %D = Rata-rata dari %K selama 3 periode terakhir (SMA 3)
      const d = kValues.isFull() ? kValues.getAverage() : null;

      return {
        "%K": k,
        "%D": d,
        kPeriod: kPeriod,
        dPeriod: dPeriod,
      };
    },
  };
}
