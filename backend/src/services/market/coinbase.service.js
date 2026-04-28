import { cleanTickerData } from "../../utils/dataCleaner.js";
import { fetchTicker as fetchTickerClient } from "../../clients/coinbase.client.js";

/**
 * Ambil data ticker (harga, volume, OHLC) berdasarkan symbol.
 * Return data bersih atau null jika gagal.
 */
export async function fetchTicker(symbol) {
  try {
    // Ambil data mentah ticker dari API Coinbase
    const res = await fetchTickerClient(symbol);
    if (!res) return null;

    const { ticker, stats } = res;

    // Parsing menjadi null jika tidak ada, BUKAN 0
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
