// === STOCHASTIC OSCILLATOR CALCULATOR ===
// Mengukur posisi harga penutupan relatif terhadap rentang harga tertinggi dan terendah.
import { createRollingWindow } from "./utils/rollingWindow.js";

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

      // Rumus %K:
      // %K = ((Close - LowestLow) / (HighestHigh - LowestLow)) × 100
      // Menunjukkan posisi harga saat ini dalam rentang harga terbaru
      const k = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.add(k);

      // Rumus %D:
      // %D = Rata-rata dari %K selama 3 periode terakhir (SMA 3)
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
