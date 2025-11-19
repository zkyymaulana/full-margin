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
          middle: null,
          lower: null,
          sma: null,
          period: period,
          multiplier: multiplier,
        };
      }

      // Rumus standar Devasi (σ):
      // σ = √((Σ (Pi - SMA)²) / n)
      const prices = window.getArray();
      const variance =
        prices.reduce((sum, p) => sum + Math.pow(p - smaValue, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      // Rumus Bollinger Bands:
      // Upper Band = SMA + (k × σ)
      // Middle Band = SMA
      // Lower Band = SMA − (k × σ)
      // Biasanya k = 2 (dua kali standar Devasi)
      const upper = smaValue + multiplier * stdDev;
      const lower = smaValue - multiplier * stdDev;

      return {
        upper,
        middle: smaValue, // ✅ Middle band = SMA
        lower,
        sma: smaValue, // ✅ Keep SMA reference for compatibility
        period: period,
        multiplier: multiplier,
      };
    },
  };
}
