import { PrismaClient } from "@prisma/client";
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles, getCandleCount } from "./candle.service.js";

const prisma = new PrismaClient();

/**
 * 🧩 Sinkronisasi data candle Coinbase
 * Jika belum ada candle di DB → ambil full data historis
 * Jika sudah ada → tidak perlu sync ulang
 */
export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  try {
    const count = await getCandleCount(symbol);

    if (count > 0) {
      console.log(
        `⏸ ${symbol} sudah memiliki ${count} candle, skip full sync.`
      );
      return { success: true, skipped: true, message: "Already synced" };
    }

    console.log(`🚀 Mengambil data historis ${symbol} dari Coinbase...`);
    const startTime = new Date("2020-10-01T00:00:00Z").getTime();
    const endTime = Date.now();

    const candles = await fetchHistoricalCandles(symbol, startTime, endTime);

    if (!candles.length) {
      console.warn(`⚠️ Tidak ada data untuk ${symbol}`);
      return { success: false, message: "No data fetched" };
    }

    console.log(`💾 Menyimpan ${candles.length} candle ke database...`);
    const result = await saveCandles(symbol, candles);

    console.log(`✅ ${candles.length} candle ${symbol} berhasil disimpan.`);
    return {
      success: result.success,
      total: candles.length,
      savedToDb: result.success,
    };
  } catch (err) {
    console.error(`❌ syncCoinbaseCandles error (${symbol}):`, err.message);
    return { success: false, message: err.message };
  } finally {
    await prisma.$disconnect();
  }
}
