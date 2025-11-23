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
 * 🐛 Fixed: Tidak lagi memaksa nilai 0 untuk coin dengan harga kecil (seperti SHIB)
 */
export async function fetchTicker(symbol) {
  try {
    const [ticker, stats] = await Promise.all([
      axios.get(`${API}/products/${symbol}/ticker`, { timeout: TIMEOUT }),
      axios.get(`${API}/products/${symbol}/stats`, { timeout: TIMEOUT }),
    ]);

    // 🎯 Parsing aman: null jika tidak ada, BUKAN 0
    const price =
      ticker.data && ticker.data.price != null
        ? Number(ticker.data.price)
        : null;

    const volume =
      ticker.data && ticker.data.volume != null
        ? Number(ticker.data.volume)
        : stats.data && stats.data.volume != null
          ? Number(stats.data.volume)
          : null;

    const high =
      stats.data && stats.data.high != null ? Number(stats.data.high) : null;

    const low =
      stats.data && stats.data.low != null ? Number(stats.data.low) : null;

    const open =
      stats.data && stats.data.open != null ? Number(stats.data.open) : null;

    const time = ticker.data?.time
      ? new Date(ticker.data.time).getTime()
      : new Date().getTime();

    // 🔍 Debug log jika data kritis tidak tersedia
    if (price == null || open == null || high == null || low == null) {
      console.warn(
        `⚠️ Missing ticker data for ${symbol}:`,
        `price=${price}, open=${open}, high=${high}, low=${low}, volume=${volume}`
      );
    }

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
    console.error(`❌ Error fetching ticker for ${symbol}:`, err.message);
    return null;
  }
}
