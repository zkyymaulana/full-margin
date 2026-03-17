/**
 * ═══════════════════════════════════════════════════════════════
 * 🗳️ COMPARISON BACKTEST MODULE - VOTING STRATEGY
 * ═══════════════════════════════════════════════════════════════
 *
 * Modul ini bertanggung jawab untuk:
 * • Implementasi voting strategy (simple majority voting)
 * • Backtesting voting strategy terhadap historical data
 * • Perhitungan performa metrics untuk voting strategy
 *
 * ⚠️ CATATAN PENTING UNTUK SKRIPSI:
 * Voting strategy ini BERBEDA dengan multi-indicator weighted strategy:
 *
 * MULTI-INDICATOR WEIGHTED (Penelitian Utama):
 * - Menggunakan FinalScore ternormalisasi (-1 sampai +1)
 * - Entry HANYA pada Strong Buy (score >= 0.6)
 * - Exit HANYA pada Strong Sell (score <= -0.6)
 * - Lebih selektif dan robust
 * - Jumlah trade lebih sedikit, win rate lebih tinggi
 *
 * VOTING STRATEGY (Benchmark Tambahan):
 * - Menggunakan simple majority voting dari 8 indikator
 * - Entry saat BUY votes > SELL votes (agresif)
 * - Exit saat SELL votes > BUY votes (agresif)
 * - Mirip dengan Pintu & Indodax indicator display
 * - Digunakan sebagai baseline pembanding
 * - Jumlah trade lebih banyak, win rate lebih rendah
 *
 * Tujuan voting strategy:
 * - Menunjukkan keunggulan weighted multi-indicator approach
 * - Membuktikan bahwa normalisasi & thresholding lebih efektif
 * - Memvalidasi academic hypothesis penelitian
 * ═══════════════════════════════════════════════════════════════
 */

import { calculateIndividualSignals } from "../../utils/indicator.utils.js";
import { calcMaxDrawdown } from "./comparison.metrics.js";

/**
 * 🗳️ Hitung voting signal dari 8 technical indicators
 *
 * Proses:
 * 1. Hitung signal individual untuk setiap indicator
 * 2. Count berapa indicator yang memberikan BUY signal
 * 3. Count berapa indicator yang memberikan SELL signal
 * 4. Tentukan hasil voting berdasarkan majority
 *
 * Rules:
 * - BUY count > SELL count → "buy" (ambil position long)
 * - SELL count > BUY count → "sell" (tutup position / short)
 * - Equal → "neutral" (hold, no action)
 *
 * Indikator yang digunakan dalam voting:
 * 1. SMA (Simple Moving Average)
 * 2. EMA (Exponential Moving Average)
 * 3. RSI (Relative Strength Index)
 * 4. MACD (Moving Average Convergence Divergence)
 * 5. Bollinger Bands
 * 6. Stochastic Oscillator
 * 7. Stochastic RSI
 * 8. Parabolic SAR
 *
 * Interpretasi:
 * - Voting strategy lebih "noisy" karena semua indicator sama weight
 * - Tidak mempertimbangkan strength/confidence dari setiap indicator
 * - Mirip dengan "indicator voting" pada platform trading seperti Pintu/Indodax
 *
 * @param {Object} cur - Current candle data dengan indicator values
 * @param {Object} prev - Previous candle data untuk calculating signals
 *
 * @returns {string} Voting result: "buy", "sell", atau "neutral"
 */
function votingSignal(cur, prev) {
  // ✅ Hitung individual signal dari setiap indicator
  const signals = calculateIndividualSignals(cur, prev);

  let buyCount = 0;
  let sellCount = 0;

  // ✅ List semua 8 indicators yang digunakan dalam voting
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

  // ✅ Count votes dari setiap indicator
  for (const ind of indicators) {
    const signal = signals[ind];
    if (signal === "buy") buyCount++;
    else if (signal === "sell") sellCount++;
  }

  // ✅ Tentukan hasil voting berdasarkan majority
  if (buyCount > sellCount) return "buy";
  if (sellCount > buyCount) return "sell";
  return "neutral";
}

/**
 * 🗳️ BACKTEST VOTING STRATEGY
 *
 * Tujuan:
 * - Test voting strategy terhadap historical data
 * - Hitung performa metrics (ROI, WinRate, MaxDD, etc)
 * - Bandingkan dengan weighted multi-indicator strategy
 *
 * ⚠️ CATATAN AKADEMIK:
 * Strategy ini menggunakan simple majority voting tanpa threshold khusus.
 * Digunakan sebagai BASELINE PEMBANDING untuk menunjukkan keunggulan
 * weighted multi-indicator dengan Strong Signal threshold.
 *
 * Karakteristik Voting Strategy:
 * - Lebih agresif dalam entry/exit (threshold rendah)
 * - Jumlah trade biasanya LEBIH BANYAK dari multi-weighted
 * - Win rate mungkin lebih rendah karena noise dari indikator yang tidak confident
 * - Cocok untuk perbandingan robustness dan effectiveness
 *
 * Entry/Exit Rules:
 * ┌─────────────────────────────────────────────────────────┐
 * │ ENTRY (BUY): Ketika BUY votes > SELL votes             │
 * │ EXIT (SELL): Ketika SELL votes > BUY votes             │
 * │ Hold ketika votes equal (neutral)                       │
 * └─────────────────────────────────────────────────────────┘
 *
 * @param {Object[]} data - Array historical data dengan indicator values
 * @param {number} data[].close - Close price untuk period
 * @param {number} data[].time - Timestamp data point
 * @param {Object} data[].indicators - All technical indicator values
 *
 * @returns {Object} Backtest result dengan metrics
 * @returns {number} roi - Return on Investment percentage
 * @returns {number} winRate - Win percentage dari total trades
 * @returns {number} maxDrawdown - Maximum drawdown percentage
 * @returns {number} trades - Total number of trades executed
 * @returns {number} wins - Number of winning trades
 * @returns {number} finalCapital - Final capital setelah semua trades
 * @returns {number[]} equityCurve - Array equity values per period
 */
function backtestVotingStrategy(data) {
  if (!data?.length) {
    throw new Error("Data historis diperlukan untuk voting strategy");
  }

  const INITIAL_CAPITAL = 10000;
  let capital = INITIAL_CAPITAL;
  let position = null; // null = no position, "BUY" = long position
  let entry = 0; // Entry price untuk current position
  let wins = 0; // Counter winning trades
  let trades = 0; // Counter total trades
  const equityCurve = []; // Track capital setiap period

  console.log(`\n🗳️ Running Voting Strategy backtest...`);
  console.log(`   Total data points: ${data.length}`);
  console.log(
    `   ⚠️ Using majority voting (different from weighted multi-indicator)`
  );

  // ✅ Iterate melalui semua historical data
  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const price = cur.close;

    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    // ✅ Get voting signal dari current & previous indicator
    const signal = votingSignal(cur, prev);

    // ═══════════════════════════════════════════════════════
    // 📊 VOTING LOGIC - Simple Majority
    // ═══════════════════════════════════════════════════════
    // Entry: BUY votes > SELL votes (agresif, threshold rendah)
    // Exit: SELL votes > BUY votes (agresif, threshold rendah)
    // ⚠️ Berbeda dengan multi-weighted yang menggunakan threshold ±0.6
    // ═══════════════════════════════════════════════════════

    if (signal === "buy" && !position) {
      // ✅ ENTRY: Buka long position
      position = "BUY";
      entry = price;
    } else if (signal === "sell" && position === "BUY") {
      // ✅ EXIT: Tutup long position dan hitung profit/loss
      const pnl = price - entry; // Profit/Loss dalam dollar
      if (pnl > 0) wins++; // Count winning trade
      // Update capital dengan profit/loss
      capital += (capital / entry) * pnl;
      position = null;
      trades++;
    }

    // ✅ Track equity curve per period
    equityCurve.push(capital);
  }

  // ✅ Close any open position di akhir backtest
  if (position === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  // ═══════════════════════════════════════════════════════
  // 📊 CALCULATE PERFORMANCE METRICS
  // ═══════════════════════════════════════════════════════

  // ✅ ROI = ((Final Capital - Initial Capital) / Initial Capital) × 100%
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  // ✅ Win Rate = (Winning Trades / Total Trades) × 100%
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // ✅ Max Drawdown = worst loss dari peak equity
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  // ═══════════════════════════════════════════════════════
  // 📋 LOG RESULTS
  // ═══════════════════════════════════════════════════════

  console.log(`✅ Voting Strategy completed:`);
  console.log(`   ROI: ${roi.toFixed(2)}%`);
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Trades: ${trades}, Wins: ${wins}`);
  console.log(`   Final Capital: $${capital.toFixed(2)}`);
  console.log(`   Max Drawdown: ${maxDrawdown}%`);

  // ═══════════════════════════════════════════════════════
  // 📤 RETURN RESULTS
  // ═══════════════════════════════════════════════════════

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    maxDrawdown,
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    equityCurve,
  };
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════

export { votingSignal, backtestVotingStrategy };
