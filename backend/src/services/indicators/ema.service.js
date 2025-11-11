// === EMA CALCULATOR (Exponential Moving Average) ===
// Memberikan bobot lebih besar pada harga terbaru agar lebih sensitif terhadap perubahan harga.
export function createEMACalculator(period) {
  const multiplier = 2 / (period + 1);
  let ema = null;
  let isInitialized = false;

  return {
    calculate(price) {
      if (!isInitialized) {
        // Inisialisasi EMA pertama dengan harga saat ini
        ema = price;
        isInitialized = true;
        return ema;
      }

      // Rumus EMA:
      // EMA(t) = (P(t) × α) + (EMA(t−1) × (1 − α))
      // Di mana:
      // - P(t) = harga penutupan saat ini
      // - α = 2 / (n + 1)
      // - EMA(t−1) = EMA sebelumnya
      ema = price * multiplier + ema * (1 - multiplier);
      return ema;
    },

    getValue() {
      return ema;
    },
  };
}
