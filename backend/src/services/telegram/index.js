export {
  sendSignalToWatchers, // Kirim sinyal ke user watcher coin tertentu
  testTelegramConnectionForUser, // Uji koneksi untuk satu user login
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
