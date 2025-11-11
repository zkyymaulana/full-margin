import axios from "axios";
import dotenv from "dotenv";
import { cleanTickerData } from "../../utils/dataCleaner.js";

dotenv.config();

const API = process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const TIMEOUT = 10000;

/**
 * Ambil semua pair aktif dari Coinbase
 */
export async function fetchPairs() {
  try {
    const { data } = await axios.get(`${API}/products`, { timeout: TIMEOUT });
    return new Set(
      data
        .filter((p) => p.status === "online" && !p.trading_disabled)
        .map((p) => p.id.toUpperCase())
    );
  } catch {
    console.error("❌ Gagal mengambil pair Coinbase");
    return new Set();
  }
}

/**
 * Ambil data harga dan OHLC dari Coinbase
 */
export async function fetchTicker(symbol) {
  try {
    const [ticker, stats] = await Promise.all([
      axios.get(`${API}/products/${symbol}/ticker`, { timeout: TIMEOUT }),
      axios.get(`${API}/products/${symbol}/stats`, { timeout: TIMEOUT }),
    ]);

    const rawData = {
      symbol,
      price: +ticker.data.price || 0,
      volume: +(ticker.data.volume || stats.data.volume || 0),
      high: +stats.data.high || 0,
      low: +stats.data.low || 0,
      open: +stats.data.open || 0,
      time: new Date(ticker.data.time || new Date()).getTime(),
    };

    return cleanTickerData(rawData);
  } catch {
    return null;
  }
}
