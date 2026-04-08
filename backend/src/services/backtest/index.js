/**
 * File: src/services/backtest/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk modul backtest.
 * Format explicit membantu pemula memahami API yang tersedia.
 */

export {
  backtestSingleIndicator, // Jalankan backtest untuk satu indikator
  backtestAllIndicators, // Jalankan backtest untuk semua indikator
} from "./backtest.service.js";

export {
  makeSignalFuncs, // Buat fungsi generator sinyal indikator
  runBacktestCore, // Jalankan engine backtest inti
} from "./backtest.core.js";

export {
  validateAndFillRsiData, // Validasi dan lengkapi data RSI
  scoreSignal, // Ubah sinyal buy/sell/neutral menjadi skor angka
  calculateROI, // Hitung return on investment (ROI)
  calculateWinRate, // Hitung win rate dari trade menang/total trade
  calculateMaxDrawDown, // Hitung maksimum drawdown
  calculateSharpeRatio, // Hitung Sharpe Ratio dari equity curve
} from "./backtest.utils.js";
