// src/services/data.service.js
// Mengatur strategi sinkronisasi: apakah ambil full data candle atau hanya update data terbaru.
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles, getLastSavedCandleTime } from "./candle.service.js";

export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  console.log(`🔄 Sync candle ${symbol}...`);

  const lastSavedTime = await getLastSavedCandleTime(symbol);
  const startTime = lastSavedTime
    ? Number(lastSavedTime) + 3600 * 1000
    : new Date("2020-10-01T00:00:00Z").getTime();
  const endTime = Date.now();

  const candles = await fetchHistoricalCandles(symbol, startTime, endTime);
  if (!candles.length) {
    console.log(`⚠️ Tidak ada candle baru untuk ${symbol}.`);
    return { success: true, message: "No new candles" };
  }

  const result = await saveCandles(symbol, candles);
  return { success: result.success, total: candles.length };
}
