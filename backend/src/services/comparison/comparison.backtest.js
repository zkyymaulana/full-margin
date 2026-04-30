import { calculateIndividualSignals } from "../../utils/indicator.utils.js";
import { calculateMaxDrawDown } from "./comparison.metrics.js";

/**
 * Hitung sinyal voting dari 8 indikator teknikal.
 * Aturan: mayoritas buy -> buy, mayoritas sell -> sell, seimbang -> neutral.
 */
export function votingSignal(cur, prev) {
  // Hitung sinyal per indikator.
  const signals = calculateIndividualSignals(cur, prev);

  let buyCount = 0;
  let sellCount = 0;

  // Daftar 8 indikator yang dipakai.
  const indicators = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "StochasticRSI",
    "PSAR",
  ];

  // Hitung jumlah vote buy dan sell.
  for (const ind of indicators) {
    const signal = signals[ind];
    if (signal === "buy") buyCount++;
    else if (signal === "sell") sellCount++;
  }

  // Tentukan hasil voting berdasarkan mayoritas.
  if (buyCount > sellCount) return "buy";
  if (sellCount > buyCount) return "sell";
  return "neutral";
}

/**
 * Backtest voting strategy pada data historis.
 * Entry saat buy lebih banyak, exit saat sell lebih banyak.
 */
export function backtestVotingStrategy(data) {
  if (!data?.length) {
    throw new Error("Data historis diperlukan untuk voting strategy");
  }

  const INITIAL_CAPITAL = 10000;
  let capital = INITIAL_CAPITAL;
  let position = null; // null = tidak ada posisi, "BUY" = posisi long
  let entry = 0; // Harga entry untuk posisi aktif
  let wins = 0; // Jumlah trade menang
  let trades = 0; // Total trade
  const equityCurve = []; // Modal per periode

  console.log(`\nRunning Voting Strategy backtest...`);
  console.log(`   Total data points: ${data.length}`);
  console.log(
    `   Using majority voting (berbeda dari multi-indikator berbobot)`,
  );

  // Iterasi seluruh data historis.
  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const price = cur.close;

    if (price == null) {
      equityCurve.push(capital);
      continue;
    }

    // Ambil sinyal voting dari indikator saat ini dan sebelumnya.
    const signal = votingSignal(cur, prev);

    if (signal === "buy" && !position) {
      // Entry: buka posisi long.
      position = "BUY";
      entry = price;
    } else if (signal === "sell" && position === "BUY") {
      // Exit: tutup posisi dan hitung laba/rugi.
      const pnl = price - entry; // Laba/rugi dalam dolar
      if (pnl > 0) wins++;
      // Update modal dengan laba/rugi.
      capital += (capital / entry) * pnl;
      position = null;
      trades++;
    }

    // Simpan modal per periode.
    equityCurve.push(capital);
  }

  // Tutup posisi jika masih terbuka di akhir backtest.
  if (position === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  // Hitung ROI = ((modal akhir - modal awal) / modal awal) * 100%.
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  // Hitung win rate = (trade menang / total trade) * 100%.
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // Hitung max drawdown dari equity curve.
  const maxDrawdown = calculateMaxDrawDown(equityCurve);

  console.log(`Voting Strategy completed:`);
  console.log(`   ROI: ${roi.toFixed(2)}%`);
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Trades: ${trades}, Wins: ${wins}`);
  console.log(`   Final Capital: $${capital.toFixed(2)}`);
  console.log(`   Max Drawdown: ${maxDrawdown}%`);

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    trades,
    maxDrawdown,
    finalCapital: +capital.toFixed(2),
    equityCurve,
  };
}
