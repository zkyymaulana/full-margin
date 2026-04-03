// Client HTTP untuk akses API Coinbase.
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const COINBASE_API =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam

// Bangun rentang waktu 1 candle terakhir berdasarkan waktu saat ini.
function buildLatestCandleRange(now) {
  return {
    end: now.toISOString(),
    start: new Date(now.getTime() - GRANULARITY_SECONDS * 1000).toISOString(),
  };
}

// Ubah array candle Coinbase menjadi objek yang lebih mudah dipakai.
function mapCoinbaseCandle(candleRow) {
  const [time, low, high, open, close, volume] = candleRow;

  return {
    time: new Date(time * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}

// Ambil semua pair aktif dari Coinbase dalam bentuk array string.
export async function fetchCoinbasePairs() {
  const { data } = await axios.get(`${COINBASE_API}/products`, {
    timeout: API_TIMEOUT,
  });

  return data
    .filter((p) => p.status === "online" && !p.trading_disabled)
    .map((p) => p.id.toUpperCase());
}

// Ambil candle terbaru untuk satu pair.
export async function fetchLastCandle(symbol) {
  const now = new Date();
  const { start, end } = buildLatestCandleRange(now);

  const { data } = await axios.get(
    `${COINBASE_API}/products/${symbol}/candles`,
    {
      params: { start, end, granularity: GRANULARITY_SECONDS },
      timeout: API_TIMEOUT,
    },
  );

  if (!data?.length) return null;

  // Coinbase mengembalikan array candle, lalu kita ubah jadi object terstruktur.
  return mapCoinbaseCandle(data[0]);
}

// Ambil data ticker dan stats mentah untuk satu pair.
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

// Ambil semua pair aktif dari Coinbase dalam bentuk Set.
export async function fetchPairs() {
  try {
    const { data } = await axios.get(`${COINBASE_API}/products`, {
      timeout: API_TIMEOUT,
    });

    return new Set(
      data
        .filter((p) => p.status === "online" && !p.trading_disabled)
        .map((p) => p.id.toUpperCase()),
    );
  } catch (err) {
    // Kembalikan Set kosong agar caller tetap aman melanjutkan flow.
    console.error("Gagal mengambil pair Coinbase");
    return new Set();
  }
}

// Ambil candle paling awal yang tersedia untuk membantu menentukan listing date.
export async function fetchEarliestCandle(symbol) {
  try {
    const startYear = 2016;
    const currentYear = new Date().getUTCFullYear();
    const years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, idx) => startYear + idx,
    );
    const MAX_BUCKETS = 300;
    const WINDOW_MS = (MAX_BUCKETS - 1) * GRANULARITY_SECONDS * 1000;

    for (const year of years) {
      try {
        const yearStartMs = Date.UTC(year, 0, 1, 0, 0, 0);
        const yearEndMs = Date.UTC(year + 1, 0, 1, 0, 0, 0);

        for (
          let windowStartMs = yearStartMs;
          windowStartMs < yearEndMs;
          windowStartMs += WINDOW_MS
        ) {
          const startDate = new Date(windowStartMs);
          const endDate = new Date(
            Math.min(windowStartMs + WINDOW_MS, yearEndMs),
          );

          const { data } = await axios.get(
            `${COINBASE_API}/products/${symbol}/candles`,
            {
              params: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                granularity: GRANULARITY_SECONDS,
              },
              timeout: API_TIMEOUT,
            },
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
        }
      } catch (err) {
        if (err.response?.status === 404) {
          continue;
        }
        console.warn(`Error checking ${year}:`, err.message);
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error(`Error fetching earliest candle for ${symbol}:`, err.message);
    return null;
  }
}
