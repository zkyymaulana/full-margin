// src/services/chart.service.js
// Mengambil data candle dari DB dan mengubah formatnya agar siap dipakai di chart frontend (OHLC).
import { syncCoinbaseCandles } from "./data.service.js";
import { getRecentCandlesFromDB, getCandleCount } from "./candle.service.js";

export async function getChartData(symbol, limit) {
  await syncCoinbaseCandles(symbol);
  const [total, candles] = await Promise.all([
    getCandleCount(symbol),
    getRecentCandlesFromDB(symbol, limit),
  ]);
  return { total, candles };
}
