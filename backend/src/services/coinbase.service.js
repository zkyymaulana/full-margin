// src/services/coinbase.service.js
import axios from "axios";
import http from "http";
import https from "https";

const COINBASE_API = "https://api.exchange.coinbase.com";
const GRANULARITY_SECONDS = 3600; // 1 jam
const MAX_CANDLES_PER_BATCH = 300;
const ONE_HOUR_MS = 60 * 60 * 1000;

const client = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 10000,
});

export async function fetchHistoricalCandles(symbol, startTime, endTime) {
  const allCandles = [];
  let currentStart = startTime;
  let batchCount = 0;

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

      const candles = res.data.map((d) => ({
        time: d[0],
        low: d[1],
        high: d[2],
        open: d[3],
        close: d[4],
        volume: d[5],
      }));

      allCandles.push(...candles.reverse());
      console.log(
        `✅ ${symbol} batch #${batchCount}: ${candles.length} candle`
      );
      currentStart = batchEnd + ONE_HOUR_MS;
    } catch (err) {
      console.error(
        `❌ Gagal ambil batch ${batchCount} (${symbol}): ${err.message}`
      );
      currentStart += ONE_HOUR_MS * 12;
    }
  }

  return allCandles.sort((a, b) => a.time - b.time);
}
