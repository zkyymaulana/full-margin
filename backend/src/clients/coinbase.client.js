// src/clients/coinbase.client.js
// request HTTP ke API Coinbase
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const COINBASE_API =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam

export async function fetchCoinbasePairs() {
  const { data } = await axios.get(`${COINBASE_API}/products`, {
    timeout: API_TIMEOUT,
  });
  return data
    .filter((p) => p.status === "online" && !p.trading_disabled)
    .map((p) => p.id.toUpperCase());
}

export async function fetchLastCandle(symbol) {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(
    now.getTime() - GRANULARITY_SECONDS * 1000
  ).toISOString();

  const { data } = await axios.get(
    `${COINBASE_API}/products/${symbol}/candles`,
    {
      params: { start, end, granularity: GRANULARITY_SECONDS },
      timeout: API_TIMEOUT,
    }
  );

  if (!data?.length) return null;
  const [time, low, high, open, close, volume] = data[0];
  return {
    time: new Date(time * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Ambil ticker + stats dari Coinbase untuk kebutuhan service.
 *
 * Catatan:
 * - Hanya melakukan HTTP request dan mengembalikan data mentah.
 * - Parsing / data cleaning tetap dilakukan di service.
 *
 * @param {string} symbol
 * @returns {Promise<{ticker:any, stats:any} | null>} Data ticker dan stats mentah, atau null jika gagal.
 */
export async function fetchTicker(symbol) {
  try {
    const [tickerRes, statsRes] = await Promise.all([
      axios.get(`${COINBASE_API}/products/${symbol}/ticker`, {
        timeout: API_TIMEOUT,
      }),
      axios.get(`${COINBASE_API}/products/${symbol}/stats`, {
        timeout: API_TIMEOUT,
      }),
    ]);

    return { ticker: tickerRes.data, stats: statsRes.data };
  } catch (err) {
    console.error(`Error fetching ticker for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Ambil semua pair aktif dari Coinbase.
 *
 * @returns {Promise<Set<string>>} Set berisi pair yang online dan tidak trading_disabled.
 */
export async function fetchPairs() {
  try {
    const { data } = await axios.get(`${COINBASE_API}/products`, {
      timeout: API_TIMEOUT,
    });

    return new Set(
      data
        .filter((p) => p.status === "online" && !p.trading_disabled)
        .map((p) => p.id.toUpperCase())
    );
  } catch (err) {
    console.error("Gagal mengambil pair Coinbase");
    return new Set();
  }
}

/**
 * Ambil 1 candle pertama (earliest) untuk menentukan listing date.
 *
 * @param {string} symbol - Trading pair symbol (e.g., "BTC-USD")
 * @returns {Promise<Object|null>} Candle paling awal atau null jika tidak ada data.
 */
export async function fetchEarliestCandle(symbol) {
  try {
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

    for (const year of years) {
      try {
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.000Z`);

        const { data } = await axios.get(
          `${COINBASE_API}/products/${symbol}/candles`,
          {
            params: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              granularity: 3600, // 1 hour
            },
            timeout: API_TIMEOUT,
          }
        );

        if (data && data.length > 0) {
          const sorted = data.sort((a, b) => a[0] - b[0]);
          const earliest = sorted[0];

          return {
            time: earliest[0] * 1000,
            low: earliest[1],
            high: earliest[2],
            open: earliest[3],
            close: earliest[4],
            volume: earliest[5],
          };
        }
      } catch (err) {
        if (err.response?.status === 404) {
          continue;
        }
        console.warn(`  ⚠️ Error checking ${year}:`, err.message);
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error(
      `❌ Error fetching earliest candle for ${symbol}:`,
      err.message
    );
    return null;
  }
}
