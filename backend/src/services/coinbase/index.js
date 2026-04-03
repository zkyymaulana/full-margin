/**
 * File: src/services/coinbase/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk service Coinbase.
 */

export {
  fetchHistoricalCandles, // Ambil candle historis dari API Coinbase
  fetchEarliestCandle, // Ambil candle paling awal untuk listing date
} from "./coinbase.service.js";
