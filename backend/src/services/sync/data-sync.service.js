import { fetchHistoricalCandles } from "../coinbase/coinbase.service.js";
import {
  getLastCandleTime,
  saveCandlesToDB,
} from "../charts/chartdata.service.js";
import { getLastClosedHourlyCandleEndTime } from "../../utils/time.js";

const START_EPOCH_MS = Date.parse(
  process.env.CANDLE_START_DATE || "2024-01-01T00:00:00Z"
);
const HOUR_MS = 3600 * 1000;

/**
 * 🔄 Sinkronisasi manual untuk 1 coin
 * - Jika belum ada data → fetch dari START_EPOCH_MS
 * - Jika sudah ada → ambil candle baru sampai candle terakhir yang close
 */
export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  console.log(`🔄 Sinkronisasi candle untuk ${symbol}...`);
  try {
    const lastSaved = await getLastCandleTime(symbol);
    const lastClosed = getLastClosedHourlyCandleEndTime();

    const start = lastSaved ? Number(lastSaved) + HOUR_MS : START_EPOCH_MS;
    if (start >= lastClosed) {
      console.log(`⚠️ Tidak ada candle baru untuk ${symbol}`);
      return { success: true, message: "No new candles" };
    }

    const candles = await fetchHistoricalCandles(symbol, start, lastClosed);
    if (!candles.length) {
      console.log(`⚠️ Tidak ada candle baru untuk ${symbol}`);
      return { success: true, message: "No new candles" };
    }

    const result = await saveCandlesToDB(symbol, null, candles);
    console.log(`✅ ${symbol}: ${candles.length} candle disimpan`);
    return { success: result.success, total: candles.length };
  } catch (err) {
    console.error(`❌ Gagal sync candle ${symbol}:`, err.message);
    return { success: false, message: err.message };
  }
}
