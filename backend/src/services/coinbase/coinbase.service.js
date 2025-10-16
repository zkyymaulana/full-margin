import axios from "axios";
import http from "http";
import https from "https";

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

      // ✅ PERBAIKAN: Coinbase format: [time, low, high, open, close, volume]
      // Simpan time dalam DETIK (bukan milidetik)
      const candles = data
        .map(([t, low, high, open, close, volume]) => ({
          time: t, // ✅ Sudah dalam detik dari Coinbase
          open,
          high,
          low,
          close,
          volume,
        }))
        // Hanya ambil candle yang sudah close penuh
        .filter((c) => c.time < Math.floor(Date.now() / 1000) - HOUR_SEC);

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

  console.log(`📦 ${symbol}: Total ${allCandles.length} candle dikumpulkan`);
  return allCandles.sort((a, b) => a.time - b.time);
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
