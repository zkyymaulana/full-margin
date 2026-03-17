import { cleanTickerData } from "../../utils/dataCleaner.js";
import { fetchTicker as fetchTickerClient } from "../../clients/coinbase.client.js";

/**
 * File: src/services/market/coinbase.service.js
 * -------------------------------------------------
 * Tujuan: Menyimpan business logic terkait data ticker Coinbase.
 * - Service hanya melakukan parsing, transformasi, dan data cleaning.
 * - Semua HTTP request ke Coinbase berada di src/clients/coinbase.client.js
 */

/**
 * Ambil data harga dan OHLC dari Coinbase.
 *
 * Parameter:
 * @param {string} symbol - Pair (contoh: "BTC-USD")
 *
 * Return:
 * @returns {Promise<object|null>} Data ticker yang sudah dibersihkan (cleanTickerData), atau null jika gagal.
 */
export async function fetchTicker(symbol) {
  try {
    // Semua request eksternal berada di client
    const res = await fetchTickerClient(symbol);
    if (!res) return null;

    const { ticker, stats } = res;

    // Parsing menjadi null jika tidak ada, BUKAN 0 (behavior dipertahankan)
    const price = ticker?.price != null ? Number(ticker.price) : null;

    const volume =
      ticker?.volume != null
        ? Number(ticker.volume)
        : stats?.volume != null
          ? Number(stats.volume)
          : null;

    const high = stats?.high != null ? Number(stats.high) : null;
    const low = stats?.low != null ? Number(stats.low) : null;
    const open = stats?.open != null ? Number(stats.open) : null;

    // Jika server tidak memberikan time, fallback ke waktu sekarang
    const time = ticker?.time ? new Date(ticker.time).getTime() : Date.now();

    const rawData = {
      symbol,
      price,
      volume,
      high,
      low,
      open,
      time,
    };

    return cleanTickerData(rawData);
  } catch (err) {
    console.error(`Error fetching ticker for ${symbol}:`, err.message);
    return null;
  }
}
