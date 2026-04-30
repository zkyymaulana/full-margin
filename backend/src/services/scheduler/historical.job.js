import { prisma } from "../../lib/prisma.js";
import { syncHistoricalData } from "../sync/candle-sync.service.js";
import { getSymbolsCache, refreshSymbolsCache } from "./cache.js";
import { getActiveSymbols } from "../sync/candle-sync.service.js";

// Cek apakah data historis sudah lengkap atau sudah usang, Jika belum, maka lakukan backfill.
export async function checkAndSyncHistoricalData(options = {}) {
  const targetStart =
    options.startDate || process.env.CANDLE_START_DATE || "2020-01-01";

  const targetStartTime = new Date(targetStart).getTime();

  let symbols = getSymbolsCache();

  if (!symbols.length) {
    await refreshSymbolsCache(getActiveSymbols);
    symbols = getSymbolsCache();
  }

  console.log(`Checking historical data (${symbols.length} symbols)...`);

  // timeframe 1h (ms)
  const tfMs = 60 * 60 * 1000;
  const now = Date.now();

  const gaps = [];

  for (const s of symbols) {
    try {
      const coin = await prisma.coin.findUnique({
        where: { symbol: s },
        select: { id: true },
      });

      if (!coin) continue;

      const last = await prisma.candle.findFirst({
        where: { coinId: coin.id },
        orderBy: { time: "desc" },
        select: { time: true },
      });

      const lastTime = last ? Number(last.time) : null;

      // CASE 1: belum ada data sama sekali
      if (!lastTime) {
        gaps.push({
          symbol: s,
          startTime: targetStartTime,
          endTime: now,
          reason: "no_data",
        });
        continue;
      }

      // CASE 2: ada gap (candle hilang)
      const missingCandles = Math.floor((now - lastTime) / tfMs);

      if (missingCandles > 0) {
        gaps.push({
          symbol: s,
          startTime: lastTime + tfMs,
          endTime: now,
          missingCandles,
        });
      }
    } catch (err) {
      console.error(`${s} error:`, err.message);
    }
  }

  // SYNC SEMUA GAP
  for (const item of gaps) {
    console.log(
      `${item.symbol} → syncing ${item.missingCandles || "full"} candles...`,
    );

    await syncHistoricalData(
      [item.symbol],
      new Date(item.startTime).toISOString(),
      {
        endTime: item.endTime,
        forceFromStart: item.reason === "no_data",
      },
    );
  }

  console.log("Historical check selesai");
}
