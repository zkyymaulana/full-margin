/**
 * File: src/controllers/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua controller.
 * Format explicit membuat fungsi yang tersedia lebih mudah dipelajari pemula.
 */

export {
  register, // Registrasi user baru
  login, // Login user dengan email dan password
  logout, // Logout user aktif
  loginWithGoogle, // Login user menggunakan akun Google
} from "./auth.controller.js";

export {
  getChart, // Ambil data chart lengkap dengan indikator
  getChartLiveTicker, // Ambil ticker live ringan untuk chart
  getChartLiveOHLCV, // Ambil OHLCV live per timeframe dari Coinbase
} from "./chart.controller.js";

export {
  compareIndicators, // Bandingkan hasil strategi indikator
} from "./comparison.controller.js";

export {
  getSignals, // Ambil sinyal indikator (latest atau paginated)
} from "./indicator.controller.js";

export {
  getCoinMarketcap, // Sinkronisasi top coin dari market cap
  getMarketcapLiveController, // Ambil data market cap live
  getCoinSymbols, // Ambil daftar simbol top coin dari database
} from "./marketcap.controller.js";

export {
  getOptimizationEstimateController, // Ambil estimasi waktu optimasi
  streamOptimizationProgressController, // Stream progress optimasi via SSE
  getOptimizationStatusController, // Cek status job optimasi
  cancelOptimizationController, // Batalkan optimasi yang sedang berjalan
  optimizeIndicatorWeightsController, // Jalankan optimasi bobot indikator
  optimizeAllCoinsController, // Jalankan optimasi untuk semua top coin
  backtestWithOptimizedWeightsController, // Backtest dengan bobot hasil optimasi
} from "./multiIndicator.controller.js";

export {
  startSchedulers, // Jalankan semua scheduler
  updateListingDates, // Perbarui listing date semua coin
} from "./scheduler.controller.js";

export {
  backtestSingleIndicatorController, // Backtest satu indikator
  backtestAllIndicatorsController, // Backtest dan bandingkan semua indikator
} from "./singleIndicator.controller.js";

export {
  testTelegramController, // Test koneksi Telegram bot
  testMultiSignalController, // Test deteksi multi-signal untuk satu simbol
  testAllSignalsController, // Test deteksi multi-signal untuk banyak simbol
  clearCacheController, // Hapus cache sinyal
  getTelegramConfigController, // Ambil status konfigurasi Telegram
  toggleTelegramController, // Aktifkan/nonaktifkan notifikasi Telegram
  telegramWebhookController, // Handler webhook Telegram
  broadcastController, // Broadcast pesan Telegram ke semua user
} from "./telegram.controller.js";

export {
  getProfile, // Ambil profil user login
  updateProfile, // Perbarui profil user login
  updateTelegramSettings, // Perbarui pengaturan Telegram user
} from "./user.controller.js";

export {
  getWatchlistHandler, // Ambil daftar watchlist user
  addToWatchlistHandler, // Tambah coin ke watchlist
  removeFromWatchlistHandler, // Hapus coin dari watchlist
} from "./wachlist.controller.js";
