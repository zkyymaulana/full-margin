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
  calcMaxDrawdown, // Hitung maksimum drawdown
  calcRiskMetrics, // Hitung metrik risiko dari equity curve
} from "./backtest.utils.js";
