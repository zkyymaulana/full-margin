// src/services/coinbase.service.js
// fetch data candle historis dari Coinbase API secara batch (per 300 candle).
import axios from "axios";
import http from "http";
import https from "https";

const COINBASE_API = "https://api.exchange.coinbase.com";
const GRANULARITY_SECONDS = 3600;
const MAX_CANDLES_PER_BATCH = 300;
const ONE_HOUR_MS = 60 * 60 * 1000;

const client = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  timeout: 15000,
});

/**
 * 📊 Ambil data candle historis dari Coinbase
 */
export async function fetchHistoricalCandles(symbol, startTime, endTime) {
  const allCandles = [];
  let currentStart = startTime;
  let batchCount = 0;

  console.log(
    `🚀 Fetch ${symbol} candles dari ${new Date(startTime).toISOString()} → ${new Date(
      endTime
    ).toISOString()}`
  );

  while (currentStart < endTime) {
    batchCount++;
    const batchEnd = Math.min(
      currentStart + MAX_CANDLES_PER_BATCH * ONE_HOUR_MS,
      endTime
    );

    try {
      const res = await client.get(
        `${COINBASE_API}/products/${symbol}/candles`,
        {
          params: {
            start: new Date(currentStart).toISOString(),
            end: new Date(batchEnd).toISOString(),
            granularity: GRANULARITY_SECONDS,
          },
        }
      );

      const candles = res.data
        .map((d) => ({
          time: d[0],
          low: d[1],
          high: d[2],
          open: d[3],
          close: d[4],
          volume: d[5],
        }))
        .filter(
          (c) => c.time < Math.floor(Date.now() / 1000) - GRANULARITY_SECONDS
        );

      if (candles.length) {
        allCandles.push(...candles.reverse());
        console.log(`✅ Batch ${batchCount}: ${candles.length} candle`);
      }

      currentStart = batchEnd + ONE_HOUR_MS;
    } catch (err) {
      console.error(`❌ Error batch ${batchCount}: ${err.message}`);
      currentStart += ONE_HOUR_MS * 6;
    }
  }

  return allCandles.sort((a, b) => a.time - b.time);
}
