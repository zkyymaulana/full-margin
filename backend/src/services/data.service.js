// src/services/data.service.js
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles, getLastSavedCandleTime } from "./candle.service.js";

/**
 * Sinkronisasi candle Coinbase dengan DB secara efisien
 * - Jika belum ada data → ambil full sejak 2020
 * - Jika sudah ada → ambil hanya candle setelah waktu terakhir
 */
export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  console.log(`🚀 Mengecek data ${symbol}...`);

  // 🔹 Cari waktu terakhir di DB
  const lastSavedTime = await getLastSavedCandleTime(symbol);

  // 🔹 Jika belum ada data, ambil full dari awal
  const startTime = lastSavedTime
    ? Number(lastSavedTime) / 1000 + 3600 // tambah 1 jam biar tidak overlap
    : new Date("2020-10-01T00:00:00Z").getTime() / 1000;

  // 🔹 Ambil sampai sekarang
  const endTime = Math.floor(Date.now() / 1000);

  console.log(
    lastSavedTime
      ? `📆 Mulai dari candle terbaru: ${new Date(startTime * 1000).toISOString()}`
      : "📆 Belum ada data, mulai dari awal (2020-10-01)"
  );

  // 🔹 Fetch dari Coinbase
  const candles = await fetchHistoricalCandles(
    symbol,
    startTime * 1000,
    endTime * 1000
  );

  if (!candles.length) {
    console.warn(`⚠️ Tidak ada candle baru untuk ${symbol}.`);
    return { success: true, message: "No new data" };
  }

  // 🔹 Simpan ke database
  console.log(`💾 Menyimpan ${candles.length} candle ke database...`);
  const result = await saveCandles(symbol, candles);

  return {
    success: result.success,
    total: candles.length,
    savedToDb: result.success,
    lastTime: new Date(endTime * 1000).toISOString(),
  };
}
