// === RSI CALCULATOR (Relative Strength Index - Wilder's Method) ===
// Mengukur kekuatan relatif antara kenaikan dan penurunan harga untuk mendeteksi kondisi overbought atau oversold.
export function createRSICalculator(period = 14) {
  let avgGain = null;
  let avgLoss = null;
  let lastPrice = null;
  let initialized = false;
  const changes = [];

  return {
    calculate(price) {
      // simpan harga sebelumnya
      if (lastPrice === null) {
        lastPrice = price;
        return null;
      }

      // Hitung perubahan harga (ΔP)
      const change = price - lastPrice;
      const gain = change > 0 ? change : 0; // Kenaikan (gain)
      const loss = change < 0 ? -change : 0; // Penurunan (loss)

      changes.push({ gain, loss });

      // Belum cukup data untuk menghitung RSI
      if (changes.length < period) {
        lastPrice = price;
        return null;
      }

      if (!initialized) {
        // Rumus rata-rata awal (SMA):
        // AvgGain = (Σ gain selama n periode) / n
        // AvgLoss = (Σ loss selama n periode) / n
        avgGain = changes.reduce((sum, c) => sum + c.gain, 0) / period;
        avgLoss = changes.reduce((sum, c) => sum + c.loss, 0) / period;
        initialized = true;
      } else {
        // Wilder's smoothing method (Modified Moving Average)
        // AvgGain = ((AvgGain sebelumnya × (n−1)) + gain sekarang) / n
        // AvgLoss = ((AvgLoss sebelumnya × (n−1)) + loss sekarang) / n
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
      }

      // Hapus data lama untuk menjaga efisiensi memori
      if (changes.length > period) {
        changes.shift();
      }

      lastPrice = price;

      // Rumus RSI:
      // RS = AvgGain / AvgLoss
      // RSI = 100 - (100 / (1 + RS))
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    },
  };
}
