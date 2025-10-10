// src/services/coinbase.service.js
import axios from "axios";
import http from "http";
import https from "https";

const COINBASE_API = "https://api.exchange.coinbase.com";
const GRANULARITY_SECONDS = 3600; // 1 jam (1h timeframe)
const MAX_CANDLES_PER_BATCH = 300;
const ONE_HOUR_MS = 60 * 60 * 1000;

// 🔹 Buat HTTP client dengan timeout & SSL safe mode (agar tidak error jika koneksi difilter)
const client = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  timeout: 15000,
});

/**
 * 📊 Ambil data candle historis dari Coinbase
 * - Memproses batch per 300 candle
 * - Melewati candle yang belum close
 * - Mengembalikan data urut dari lama ke baru
 */
export async function fetchHistoricalCandles(symbol, startTime, endTime) {
  const allCandles = [];
  let currentStart = startTime;
  let batchCount = 0;

  console.log(
    `🚀 Fetch candle ${symbol} dari ${new Date(startTime).toISOString()} sampai ${new Date(endTime).toISOString()}`
  );

  while (currentStart < endTime) {
    batchCount++;
    const batchEnd = Math.min(
      currentStart + MAX_CANDLES_PER_BATCH * ONE_HOUR_MS,
      endTime
    );

    const startISO = new Date(currentStart).toISOString();
    const endISO = new Date(batchEnd).toISOString();

    try {
      const res = await client.get(
        `${COINBASE_API}/products/${symbol}/candles`,
        {
          params: {
            start: startISO,
            end: endISO,
            granularity: GRANULARITY_SECONDS,
          },
        }
      );

      if (!res.data?.length) {
        console.warn(`⚠️ Batch ${batchCount} (${symbol}): tidak ada data`);
        currentStart = batchEnd + ONE_HOUR_MS;
        continue;
      }

      // 🔹 Konversi data ke objek candle
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - GRANULARITY_SECONDS;

      const candles = res.data
        .map((d) => ({
          time: d[0],
          low: d[1],
          high: d[2],
          open: d[3],
          close: d[4],
          volume: d[5],
        }))
        // 🔹 Ambil hanya candle yang sudah close (hindari live candle)
        .filter((c) => c.time < oneHourAgo);

      if (candles.length > 0) {
        allCandles.push(...candles.reverse());
        console.log(
          `✅ ${symbol} batch #${batchCount}: ${candles.length} candle disimpan`
        );
      } else {
        console.log(
          `⏳ ${symbol} batch #${batchCount}: semua candle masih berjalan`
        );
      }

      currentStart = batchEnd + ONE_HOUR_MS;
    } catch (err) {
      console.error(
        `❌ Gagal ambil batch ${batchCount} (${symbol}): ${err.message}`
      );
      currentStart += ONE_HOUR_MS * 6; // skip 6 jam jika error
    }
  }

  // 🔹 Urutkan data agar dari lama ke baru
  return allCandles.sort((a, b) => a.time - b.time);
}
