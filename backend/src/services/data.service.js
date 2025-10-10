import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles } from "./candle.service.js";

export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  const startTime = new Date("2020-10-01T00:00:00Z").getTime();
  const endTime = new Date().getTime();

  console.log(`🚀 Mengambil data ${symbol} dari Coinbase...`);
  const candles = await fetchHistoricalCandles(symbol, startTime, endTime);

  if (!candles.length) {
    console.warn(`⚠️ Tidak ada data untuk ${symbol}`);
    return { success: false, message: "No data fetched" };
  }

  console.log(`💾 Menyimpan ${candles.length} candle ke database...`);
  const result = await saveCandles(symbol, candles);

  return {
    success: result.success,
    total: candles.length,
    lastFive: candles.slice(-5),
    savedToDb: result.success,
  };
}
