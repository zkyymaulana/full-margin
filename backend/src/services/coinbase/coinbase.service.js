import axios from "axios";
import http from "http";
import https from "https";
import {
  cleanCandleData,
  removeDuplicateCandles,
} from "../../utils/dataCleaner.js";

const API_URL =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const HOUR_SEC = Number(process.env.CANDLE_HOUR_SEC) || 3600; // 1 jam = 3600 detik
const HOUR_MS = HOUR_SEC * 1000;
const MAX_BATCH_SIZE = Number(process.env.COINBASE_BATCH_SIZE) || 300;

const BATCH_DELAY_MS = Number(process.env.COINBASE_BATCH_DELAY_MS) || 400; // jeda antar batch
const RETRY_DELAY_MS = Number(process.env.COINBASE_RETRY_DELAY_MS) || 5000; // retry saat rate limit
const TIMEOUT_MS = Number(process.env.COINBASE_TIMEOUT_MS) || 15000; // timeout per request

const client = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_MS,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  headers: {
    "User-Agent": "Crypto-Analyzer/1.0",
    "CB-VERSION": "2025-01-01",
  },
});

export async function fetchHistoricalCandles(symbol, start, end) {
  const allCandles = [];
  let current = start;
  let batchCount = 1;

  console.log(
    `🚀 Fetch ${symbol} candles: ${new Date(start).toISOString()} → ${new Date(end).toISOString()}`
  );

  while (current < end) {
    const next = Math.min(current + MAX_BATCH_SIZE * HOUR_MS, end);
    const params = {
      start: new Date(current).toISOString(),
      end: new Date(next).toISOString(),
      granularity: HOUR_SEC,
    };

    try {
      const { data } = await client.get(`/products/${symbol}/candles`, {
        params,
      });
      if (!Array.isArray(data)) throw new Error("Invalid response format");

      // ✅ PERBAIKAN: Coinbase memberikan timestamp dalam detik, konversi ke milidetik
      const candles = data
        .map(([t, low, high, open, close, volume]) => ({
          time: t * 1000, // ✅ Konversi dari detik ke milidetik (13 digit)
          open,
          high,
          low,
          close,
          volume,
        }))
        // Hanya ambil candle yang sudah close penuh
        .filter((c) => c.time < Date.now() - HOUR_MS);

      if (candles.length > 0) {
        allCandles.push(...candles.reverse()); // urut lama → baru
        console.log(
          `✅ ${symbol} Batch ${batchCount++}: ${candles.length} candles`
        );
      }

      // 🧘 Delay antar batch agar tidak overload API
      await delay(BATCH_DELAY_MS);
    } catch (err) {
      await handleFetchError(symbol, batchCount, err);
    }

    current = next + HOUR_MS;
  }

  // 🧹 Bersihkan dan validasi semua candle sebelum return
  const sortedCandles = allCandles.sort((a, b) => a.time - b.time);
  const cleanedCandles = cleanCandleData(sortedCandles);
  const finalCandles = removeDuplicateCandles(cleanedCandles);
  return finalCandles;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleFetchError(symbol, batch, err) {
  if (err.response?.status === 429) {
    console.warn(
      `⚠️ ${symbol}: Rate limit (429), retry ${RETRY_DELAY_MS / 1000}s...`
    );
    await delay(RETRY_DELAY_MS);
  } else if (["ECONNRESET", "ETIMEDOUT"].includes(err.code)) {
    console.warn(`⚠️ ${symbol}: Timeout, retry batch setelah 3 detik...`);
    await delay(3000);
  } else {
    console.error(`❌ ${symbol} Batch ${batch}: ${err.message}`);
    console.warn(`➡️ Skip 6 jam ke depan untuk menghindari loop error...`);
  }
}

/**
 * Ambil 1 candle pertama (earliest) untuk menentukan listing date
 * Sequential search dari 2016 sampai menemukan data pertama
 * @param {string} symbol - Trading pair symbol (e.g., "BTC-USD")
 * @returns {Object|null} - { time: timestamp, open, high, low, close, volume } atau null
 */
export async function fetchEarliestCandle(symbol) {
  try {
    const currentYear = new Date().getFullYear();
    const MAX_YEAR = currentYear;

    // Step 1: Binary search untuk menemukan tahun pertama dengan data (lebih efisien)
    let firstYearWithData = null;

    for (let year = 2016; year <= MAX_YEAR; year++) {
      // Cek seluruh tahun (12 bulan) untuk memastikan tidak ada data
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`).getTime();
      const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`).getTime();

      try {
        const testCandles = await fetchHistoricalCandles(
          symbol,
          yearStart,
          yearEnd
        );

        if (testCandles && testCandles.length > 0) {
          // Found data in this year!
          firstYearWithData = year;

          // Sort untuk dapat candle paling awal
          testCandles.sort((a, b) => a.time - b.time);
          const earliest = testCandles[0];

          return {
            time: earliest.time,
            open: earliest.open,
            high: earliest.high,
            low: earliest.low,
            close: earliest.close,
            volume: earliest.volume,
          };
        }
      } catch (err) {
        // No data this year, continue to next year
        continue;
      }

      // Small delay to avoid rate limiting
      await delay(300);
    }
    return null;
  } catch (err) {
    return null;
  }
}
