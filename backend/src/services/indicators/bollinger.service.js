// === BOLLINGER BANDS CALCULATOR ===
// Menunjukkan batas atas dan bawah dari volatilitas harga.
import { createRollingWindow } from "./utils/rollingWindow.js";
import { createSMACalculator } from "./sma.service.js";

export function createBollingerBandsCalculator(period = 20, multiplier = 2) {
  const sma = createSMACalculator(period);
  const window = createRollingWindow(period);

  return {
    calculate(price) {
      // Tambahkan harga baru ke dalam window
      window.add(price);

      // Hitung SMA untuk periode saat ini
      const smaValue = sma.calculate(price);

      if (!window.isFull() || smaValue === null) {
        return {
          upper: null,
          lower: null,
          period: period,
          multiplier: multiplier,
        };
      }

      // Rumus Deviasi Standar (σ):
      // σ = √((Σ (Pi - SMA)²) / n)
      const prices = window.getArray();
      const variance =
        prices.reduce((sum, p) => sum + Math.pow(p - smaValue, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      // Rumus Bollinger Bands:
      // Upper Band = SMA + (k × σ)
      // Lower Band = SMA − (k × σ)
      // Biasanya k = 2 (dua kali deviasi standar)
      const upper = smaValue + multiplier * stdDev;
      const lower = smaValue - multiplier * stdDev;

      return { upper, lower, period: period, multiplier: multiplier };
    },
  };
}
