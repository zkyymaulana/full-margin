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
// Coinbase membatasi maksimal 300 candle per request.
// Agar stabil dan tidak overlap, satu jendela batch dibatasi tepat 300 titik waktu.
const MAX_BATCH_SPAN_MS = (MAX_BATCH_SIZE - 1) * HOUR_MS;
const EARLIEST_LISTING_SEARCH_START_MS = Date.parse("2015-01-01T00:00:00.000Z");

const BATCH_DELAY_MS = Number(process.env.COINBASE_BATCH_DELAY_MS) || 400; // jeda antar batch
const RETRY_DELAY_MS = Number(process.env.COINBASE_RETRY_DELAY_MS) || 5000; // retry saat rate limit
const TIMEOUT_MS = Number(process.env.COINBASE_TIMEOUT_MS) || 15000; // timeout per request
const MAX_RETRY_ATTEMPTS = Number(process.env.COINBASE_MAX_RETRY_ATTEMPTS) || 3;

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

// Ambil candle historis dari Coinbase secara bertahap (batch) agar aman dari limit API.
export async function fetchHistoricalCandles(symbol, start, end, options = {}) {
  const { onBatch = null, accumulate = true } = options;
  const allCandles = [];
  let current = start;
  let batchCount = 1;

  console.log(
    `🚀 Fetch ${symbol} candles: ${new Date(start).toISOString()} → ${new Date(end).toISOString()}`,
  );

  while (current < end) {
    // Gunakan span (MAX_BATCH_SIZE - 1) karena start/end bisa terhitung sebagai boundary.
    // Ini menjaga jumlah candle per request tetap <= 300 dan mencegah hole antar batch.
    const next = Math.min(current + MAX_BATCH_SPAN_MS, end);
    const params = {
      start: new Date(current).toISOString(),
      end: new Date(next).toISOString(),
      granularity: HOUR_SEC,
    };

    let batchDone = false;
    let attempt = 0;

    while (!batchDone) {
      try {
        const { data } = await client.get(`/products/${symbol}/candles`, {
          params,
        });
        if (!Array.isArray(data)) throw new Error("Invalid response format");

        // PERBAIKAN: Coinbase memberikan timestamp dalam detik, konversi ke milidetik
        const candles = data
          .map(([t, low, high, open, close, volume]) => ({
            time: t * 1000, // Konversi dari detik ke milidetik (13 digit)
            open,
            high,
            low,
            close,
            volume,
          }))
          // Hanya ambil candle yang sudah close penuh
          .filter((c) => c.time < Date.now() - HOUR_MS);

        if (candles.length > 0) {
          const orderedCandles = candles.reverse(); // urut lama → baru

          if (accumulate) {
            allCandles.push(...orderedCandles);
          }

          if (typeof onBatch === "function") {
            await onBatch(orderedCandles, {
              batch: batchCount,
              start: current,
              end: next,
            });
          }

          console.log(
            `${symbol} Batch ${batchCount}: ${candles.length} candles`,
          );
        }

        batchDone = true;
        batchCount += 1;

        // 🧘 Delay antar batch agar tidak overload API
        await delay(BATCH_DELAY_MS);
      } catch (err) {
        attempt += 1;
        const shouldRetry = await handleFetchError(
          symbol,
          batchCount,
          err,
          attempt,
        );

        if (!shouldRetry || attempt >= MAX_RETRY_ATTEMPTS) {
          if (attempt >= MAX_RETRY_ATTEMPTS) {
            console.warn(
              `⚠️ ${symbol} Batch ${batchCount}: Retry habis (${MAX_RETRY_ATTEMPTS}), lanjut ke batch berikutnya`,
            );
          }
          batchDone = true;
          batchCount += 1;
        }
      }
    }

    // Geser ke bucket jam berikutnya agar batch berikutnya kontigu tanpa duplikasi.
    current = next + HOUR_MS;
  }

  // 🧹 Bersihkan dan validasi semua candle sebelum return
  if (!accumulate) {
    return [];
  }

  const sortedCandles = allCandles.sort((a, b) => a.time - b.time);
  const cleanedCandles = cleanCandleData(sortedCandles);
  const finalCandles = removeDuplicateCandles(cleanedCandles);
  return finalCandles;
}

async function fetchWindowCandles(symbol, startMs, endMs) {
  const params = {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    granularity: HOUR_SEC,
  };

  const { data } = await client.get(`/products/${symbol}/candles`, { params });
  if (!Array.isArray(data) || data.length === 0) return [];

  return data
    .map(([t, low, high, open, close, volume]) => ({
      time: t * 1000,
      open,
      high,
      low,
      close,
      volume,
    }))
    .filter((c) => c.time < Date.now() - HOUR_MS);
}

// Cari timestamp candle pertama yang benar-benar tersedia di Coinbase untuk sebuah pair.
// Dipakai untuk memvalidasi eligibility historis agar tidak fetch dataset besar secara sia-sia.
export async function findEarliestCoinbaseCandleTime(symbol, options = {}) {
  const lowerBound = Number(
    options.lowerBoundMs || EARLIEST_LISTING_SEARCH_START_MS,
  );
  const nowHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  let left = Math.floor(lowerBound / HOUR_MS) * HOUR_MS;
  let right = Math.max(left, nowHour - HOUR_MS);
  let firstWindowStart = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / (2 * HOUR_MS)) * HOUR_MS;
    const end = Math.min(mid + MAX_BATCH_SPAN_MS, nowHour);

    try {
      const candles = await fetchWindowCandles(symbol, mid, end);
      if (candles.length > 0) {
        firstWindowStart = mid;
        right = mid - HOUR_MS;
      } else {
        left = mid + HOUR_MS;
      }
    } catch (err) {
      if (err.response?.status === 404) {
        return null;
      }

      // Untuk error sementara, fallback ke pergeseran kanan agar pencarian tetap lanjut.
      left = mid + HOUR_MS;
    }
  }

  if (firstWindowStart == null) {
    return null;
  }

  const refineEnd = Math.min(firstWindowStart + MAX_BATCH_SPAN_MS, nowHour);
  const refined = await fetchWindowCandles(symbol, firstWindowStart, refineEnd);

  if (!refined.length) return null;

  return refined.reduce(
    (minTime, candle) => Math.min(minTime, candle.time),
    refined[0].time,
  );
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleFetchError(symbol, batch, err, attempt = 1) {
  if (err.response?.status === 429) {
    console.warn(
      `⚠️ ${symbol} Batch ${batch}: Rate limit (429), percobaan ${attempt}/${MAX_RETRY_ATTEMPTS}, retry ${RETRY_DELAY_MS / 1000}s...`,
    );
    await delay(RETRY_DELAY_MS);
    return true;
  } else if (["ECONNRESET", "ETIMEDOUT"].includes(err.code)) {
    console.warn(
      `⚠️ ${symbol} Batch ${batch}: Timeout ${err.code}, percobaan ${attempt}/${MAX_RETRY_ATTEMPTS}, retry 3 detik...`,
    );
    await delay(3000);
    return true;
  } else {
    console.error(`❌ ${symbol} Batch ${batch}: ${err.message}`);
    console.warn(`➡️ Lanjut ke batch berikutnya untuk mencegah loop gagal`);
    return false;
  }
}
