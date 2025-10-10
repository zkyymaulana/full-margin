import { PrismaClient } from "@prisma/client";
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles, getLastSavedCandleTime } from "./candle.service.js";

const prisma = new PrismaClient();

/**
 * 🔁 Jalankan scheduler untuk semua coin yang tersimpan di database
 */
export async function startAllSchedulers() {
  console.log("🚀 Memulai scheduler untuk semua coin...");

  try {
    // Ambil semua symbol dari tabel Coin
    const coins = await prisma.coin.findMany({
      select: { symbol: true },
    });

    if (!coins.length) {
      console.warn(
        "⚠️ Tidak ada coin di database. Jalankan sync terlebih dahulu."
      );
      return;
    }

    for (const coin of coins) {
      startCandleAutoUpdater(coin.symbol);
    }

    console.log(`✅ Scheduler aktif untuk ${coins.length} coin.`);
  } catch (err) {
    console.error("❌ Gagal memulai scheduler:", err.message);
  }
}

/**
 * 🔄 Scheduler otomatis setiap 1 jam (update candle saat close)
 * @param {string} symbol - contoh: "BTC-USD"
 */
export function startCandleAutoUpdater(symbol) {
  console.log(`🕐 Scheduler dimulai untuk ${symbol}`);

  // Jalankan setiap 1 menit
  setInterval(async () => {
    try {
      const lastSaved = await getLastSavedCandleTime(symbol);
      const now = new Date();

      // Hitung waktu UTC candle terakhir yang seharusnya close
      const lastClosedUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(), // candle terakhir sudah close di jam ini
        0,
        0,
        0
      );

      // ✅ ubah BigInt → Number
      const lastSavedTime = lastSaved ? Number(lastSaved) : 0;

      // Jika belum ada candle terakhir, atau sudah 1 jam lewat → fetch 1 candle terbaru
      if (lastClosedUTC > lastSavedTime) {
        console.log(
          `🕐 Candle baru terdeteksi untuk ${symbol}, fetching 1 candle terakhir...`
        );

        const candles = await fetchHistoricalCandles(
          symbol,
          lastClosedUTC - 3600 * 1000,
          lastClosedUTC
        );

        if (candles.length > 0) {
          await saveCandles(symbol, candles);
          console.log(
            `✅ Candle ${symbol} untuk ${new Date(
              candles.at(-1).time * 1000
            ).toISOString()} berhasil disimpan.`
          );
        } else {
          console.log(`⚠️ Tidak ada candle baru tersedia untuk ${symbol}.`);
        }
      } else {
        console.log(`⏸️ Belum waktunya update, ${symbol} sudah up-to-date.`);
      }
    } catch (err) {
      console.error(`❌ Scheduler error (${symbol}):`, err.message);
    }
  }, 60 * 1000); // periksa tiap 1 menit
}
