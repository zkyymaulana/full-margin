/**
 * File: src/utils/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk utilitas backend.
 * Format explicit memudahkan pemula melihat fungsi yang tersedia.
 */

export {
  cleanTopCoinData, // Bersihkan data top coin dari CMC
  cleanTickerData, // Bersihkan data ticker agar valid diproses
  cleanCandleData, // Bersihkan dan normalisasi data candle
  removeDuplicateCandles, // Hapus candle duplikat berdasarkan timestamp
  fillMissingCandles, // Lengkapi gap candle dengan forward fill
} from "./dataCleaner.js";

export {
  fetchLatestIndicatorData, // Ambil indikator terbaru + candle terbaru
} from "./db.utils.js";

export {
  scoreSignal, // Ubah sinyal buy/sell/neutral menjadi skor numerik
  calculateIndividualSignals, // Hitung sinyal per indikator dari data candle
  calculateMaxDrawDown, // Hitung maksimum drawdown dari equity curve
  calculateMultiIndicatorScore, // Hitung skor multi-indikator berbobot
} from "./indicator.utils.js";

export {
  generateToken, // Generate JWT untuk autentikasi
  verifyToken, // Verifikasi dan decode JWT
} from "./jwt.js";

export {
  toSignalValue, // Ubah sinyal string ke nilai numerik
  calculateCategoryScores, // Hitung skor kategori trend/momentum/volatility
} from "./multiindicator-score.utils.js";

export {
  createRollingWindow, // Buat struktur data rolling window untuk indikator
} from "./rollingWindow.js";
