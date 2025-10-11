// src/services/chart.service.js
// Mengambil data candle dari DB dan mengubah formatnya agar siap dipakai di chart frontend (OHLC).
import { syncCoinbaseCandles } from "./data.service.js";
import { getRecentCandlesFromDB, getCandleCount } from "./candle.service.js";

/**
 * 🔄 Trigger heavy synchronization for specific coin (only when viewing chart detail)
 */
export async function triggerCoinSync(symbol) {
  try {
    console.log(`🔄 Starting heavy sync for ${symbol}...`);
    await syncCoinbaseCandles(symbol);
    console.log(`✅ Sync completed for ${symbol}`);
  } catch (error) {
    console.error(`❌ Sync failed for ${symbol}:`, error.message);
    // Don't throw error, let the function continue with existing data
  }
}

/**
 * 📊 Get chart data from database (lightweight, no sync)
 */
export async function getChartData(symbol, limit) {
  // Removed automatic sync - now only gets data from DB
  const [total, candles] = await Promise.all([
    getCandleCount(symbol),
    getRecentCandlesFromDB(symbol, limit),
  ]);
  return { total, candles };
}
