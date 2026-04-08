/**
 * File: src/services/telegram/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua service Telegram.
 */

export {
  sendSignalToWatchers, // Kirim sinyal ke user watcher coin tertentu
  testTelegramConnection, // Uji koneksi bot Telegram
  clearSignalCache, // Hapus cache sinyal Telegram
} from "./telegram.service.js";

export {
  sendTelegramMessage, // Kirim satu pesan ke chat tertentu
  broadcastTelegram, // Broadcast pesan ke banyak user
} from "./telegram.broadcast.js";

export {
  interpretTrendScore, // Ubah skor trend menjadi label mudah dibaca
  interpretMomentumScore, // Ubah skor momentum menjadi label mudah dibaca
  interpretVolatilityScore, // Ubah skor volatilitas menjadi label mudah dibaca
  generateInsight, // Buat insight teks dari hasil analisis sinyal
  formatTelegramSignalMessage, // Bentuk template pesan sinyal Telegram
} from "./telegram.message.js";
