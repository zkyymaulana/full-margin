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
    console.error("Gagal mengambil pair Coinbase");
    return new Set();
  }
}

/**
 * Ambil 1 candle pertama (earliest) untuk menentukan listing date
 * Fetch dengan binary search dari 2015-2024 untuk efisiensi
 * @param {string} symbol - Trading pair symbol (e.g., "BTC-USD")
 * @returns {Object|null} - { time: timestamp, open, high, low, close, volume } atau null
 */
export async function fetchEarliestCandle(symbol) {
  try {
    // Try years from 2015 to 2024 to find first available data
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

    for (const year of years) {
      try {
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.000Z`);

        const { data } = await axios.get(`${API}/products/${symbol}/candles`, {
          params: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            granularity: 3600, // 1 hour
          },
          timeout: TIMEOUT,
        });

        if (data && data.length > 0) {
          // Sort by time ascending to get earliest
          const sorted = data.sort((a, b) => a[0] - b[0]);
          const earliest = sorted[0];

          return {
            time: earliest[0] * 1000, // Unix timestamp to ms
            low: earliest[1],
            high: earliest[2],
            open: earliest[3],
            close: earliest[4],
            volume: earliest[5],
          };
        }
      } catch (err) {
        // If 404, pair tidak ada data di tahun ini - lanjut ke tahun berikutnya
        if (err.response?.status === 404) {
          continue;
        }
        // Log other errors but continue
        console.warn(`  ⚠️ Error checking ${year}:`, err.message);
        continue;
      }
    }

    // Jika tidak ada data di semua tahun
    return null;
  } catch (err) {
    console.error(
      `❌ Error fetching earliest candle for ${symbol}:`,
      err.message
    );
    return null;
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

    // Parsing mennjadi null jika tidak ada, BUKAN 0
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
