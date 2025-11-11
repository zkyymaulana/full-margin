// === STOCHASTIC RSI CALCULATOR ===
// Kombinasi RSI dan Stochastic Oscillator, membuat indikator lebih sensitif terhadap perubahan harga.
import { createRollingWindow } from "./utils/rollingWindow.js";
import { createRSICalculator } from "./rsi.service.js";

export function createStochasticRSICalculator(
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

      // Rumus Stochastic RSI:
      // StochRSI = (RSI - LowestRSI) / (HighestRSI - LowestRSI) × 100
      // Artinya: seberapa dekat nilai RSI sekarang dengan batas atas/bawah RSI terbaru.
      const k = ((rsi - lowestRSI) / (highestRSI - lowestRSI)) * 100;
      kValues.add(k);

      // Rumus %D:
      // %D = Rata-rata %K selama 3 periode terakhir
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
