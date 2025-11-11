// === SMA CALCULATOR (Simple Moving Average) ===
// Menghitung rata-rata harga penutupan selama periode tertentu.
import { createRollingWindow } from "./utils/rollingWindow.js";

export function createSMACalculator(period) {
  const window = createRollingWindow(period);

  return {
    calculate(price) {
      // Tambahkan harga terbaru ke dalam jendela data
      window.add(price);

      // Rumus SMA:
      // SMA = (P1 + P2 + ... + Pn) / n
      // Di mana:
      // - P = harga penutupan (close)
      // - n = jumlah periode
      // Jadi setiap kali ada data baru, nilai lama keluar (rolling), dan dihitung ulang rata-ratanya.
      return window.getAverage();
    },
  };
}
