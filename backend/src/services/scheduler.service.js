import { PrismaClient } from "@prisma/client";
import { fetchHistoricalCandles } from "./coinbase.service.js";
import { saveCandles, getLastSavedCandleTime } from "./candle.service.js";
import {
  toJakartaTime,
  getLastClosedHourlyCandleEndTime,
} from "../utils/time.helper.js"; // pastikan path sesuai

const prisma = new PrismaClient();
const ONE_HOUR_MS = 60 * 60 * 1000;

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
 * 🔄 Scheduler otomatis — periksa tiap 1 menit
 * Hanya menyimpan candle yang sudah close (jam penuh, bukan berjalan)
 */
export function startCandleAutoUpdater(symbol) {
  console.log(`🕐 Scheduler dimulai untuk ${symbol}`);

  setInterval(async () => {
    try {
      const lastSaved = await getLastSavedCandleTime(symbol);
      const lastSavedTime = lastSaved ? Number(lastSaved) : 0;

      // Ambil waktu terakhir candle close (UTC)
      const lastClosedUTC = getLastClosedHourlyCandleEndTime();

      // Jika candle terakhir yang close > dari waktu terakhir di DB → ambil baru
      if (lastClosedUTC > lastSavedTime) {
        console.log(
          `🕒 Deteksi candle baru ${symbol}\n   ⏱️ Dari ${toJakartaTime(
            lastSavedTime
          )} → ${toJakartaTime(lastClosedUTC)}`
        );

        // Ambil candle baru dari API
        const candles = await fetchHistoricalCandles(
          symbol,
          lastSavedTime || lastClosedUTC - ONE_HOUR_MS,
          lastClosedUTC
        );

        // Filter hanya candle yang benar-benar sudah close
        const closedCandles = candles.filter(
          (c) => c.time * 1000 <= lastClosedUTC
        );

        if (closedCandles.length > 0) {
          await saveCandles(symbol, closedCandles);
          console.log(
            `✅ ${closedCandles.length} candle baru ${symbol} disimpan.\n   📅 Terakhir: ${toJakartaTime(
              closedCandles.at(-1).time * 1000
            )}`
          );
        } else {
          console.log(`⏸️ Tidak ada candle close baru untuk ${symbol}.`);
        }
      } else {
        console.log(
          `⏸️ ${symbol} sudah up-to-date.\n   📅 Terakhir di DB: ${toJakartaTime(
            lastSavedTime
          )}`
        );
      }
    } catch (err) {
      console.error(`❌ Scheduler error (${symbol}):`, err.message);
    }
  }, 60 * 1000); // jalankan tiap 1 menit
}
