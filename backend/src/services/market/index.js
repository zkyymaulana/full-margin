/**
 * File: src/services/market/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua service market.
 */

export {
  syncTopCoins, // Sinkronisasi top coin dari CoinMarketCap ke database
  syncTopCoinRanksFromCmc, // Sinkronisasi rank CMC ke coin yang terhubung topCoin
} from "./syncTopCoins.service.js";

export {
  fetchTicker, // Ambil ticker dan stats market dari Coinbase
} from "./coinbase.service.js";

export {
  getMarketcapRealtime, // Ambil dan sinkronkan marketcap realtime
  getMarketcapLive, // Ambil marketcap plus data live market
} from "./marketcap.service.js";

export {
  getCoinLiveDetail, // Ambil detail harga live untuk satu simbol
} from "./coinLiveDetail.service.js";
