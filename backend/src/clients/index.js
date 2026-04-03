/**
 * File: src/clients/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua fungsi client.
 * Format dibuat eksplisit agar pemula mudah melihat fungsi yang tersedia.
 */

export {
  fetchCoinbasePairs, // Ambil daftar pair aktif dari Coinbase
  fetchLastCandle, // Ambil candle terbaru dari Coinbase
  fetchTicker, // Ambil data ticker dan stats mentah
  fetchPairs, // Ambil pair aktif dalam bentuk Set
  fetchEarliestCandle, // Ambil candle paling awal (untuk listing date)
} from "./coinbase.client.js";

export {
  getTopCoins, // Ambil daftar top coin dari CoinMarketCap
  getCoinLogos, // Ambil info coin dan logo berdasarkan simbol
} from "./coinmarketcap.client.js";
