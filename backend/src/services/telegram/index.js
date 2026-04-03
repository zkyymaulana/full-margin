/**
 * File: src/services/telegram/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua service Telegram.
 */

export {
  sendMultiIndicatorSignal, // Kirim notifikasi sinyal multi-indikator
  sendDailySummary, // Kirim ringkasan harian ke Telegram
  sendErrorNotification, // Kirim notifikasi error sistem
  sendSignalToWatchers, // Kirim sinyal ke user watcher coin tertentu
  testTelegramConnection, // Uji koneksi bot Telegram
  clearSignalCache, // Hapus cache sinyal Telegram
  getSignalCacheStatus, // Ambil status cache sinyal Telegram
} from "./telegram.service.js";

export {
  sendTelegramMessage, // Kirim satu pesan ke chat tertentu
  broadcastTelegram, // Broadcast pesan ke banyak user
  broadcastTradingSignal, // Broadcast format pesan sinyal trading
} from "./telegram.broadcast.js";

export {
  validateBroadcastSignalParams, // Validasi parameter broadcast sinyal
  buildBroadcastSignalPayload, // Bentuk payload broadcast sinyal
} from "./telegram.validation.js";

export {
  interpretTrendScore, // Ubah skor trend menjadi label mudah dibaca
  interpretMomentumScore, // Ubah skor momentum menjadi label mudah dibaca
  interpretVolatilityScore, // Ubah skor volatilitas menjadi label mudah dibaca
  generateInsight, // Buat insight teks dari hasil analisis sinyal
  formatTelegramSignalMessage, // Bentuk template pesan sinyal Telegram
} from "./telegram.message.js";
