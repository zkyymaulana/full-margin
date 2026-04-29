import { prisma } from "../../lib/prisma.js";
import { syncHistoricalData } from "../sync/candle-sync.service.js";
import { getSymbolsCache, refreshSymbolsCache } from "./cache.js";
import { getActiveSymbols } from "../sync/candle-sync.service.js";

/**
 * Cek apakah data historis sudah lengkap / outdated
 * Jika belum → lakukan backfill
 */
export async function checkAndSyncHistoricalData(options = {}) {
  const targetStart =
    options.startDate || process.env.CANDLE_START_DATE || "2020-01-01";
  const targetStartTime = new Date(targetStart).getTime();
  const ensureFromStart = options.ensureFromStart === true;

  let symbols = getSymbolsCache();

  // Jika cache kosong → refresh dulu
  if (!symbols.length) {
    await refreshSymbolsCache(getActiveSymbols);
    symbols = getSymbolsCache();
  }

  console.log(`Checking historical data (${symbols.length} symbols)...`);

  const outdated = [];
  const needsFullHistory = [];

  // Loop semua symbol
  for (const s of symbols) {
    try {
      // Ambil coin dari DB
      const coin = await prisma.coin.findUnique({
        where: { symbol: s },
        select: { id: true },
      });

      if (!coin) {
        outdated.push(s);
        continue;
      }

      // Ambil candle terakhir
      const last = await prisma.candle.findFirst({
        where: { coinId: coin.id },
        orderBy: { time: "desc" },
      });

      const time = last ? Number(last.time) : 0;

      if (ensureFromStart) {
        const first = await prisma.candle.findFirst({
          where: { coinId: coin.id },
          orderBy: { time: "asc" },
          select: { time: true },
        });
        const firstTime = first ? Number(first.time) : null;

        if (!firstTime || firstTime > targetStartTime) {
          needsFullHistory.push(s);
        }
      }

      // Jika data lebih dari 3 jam tidak update → dianggap outdated
      if (time < Date.now() - 3 * 3600 * 1000) {
        outdated.push(s);
      }
    } catch (err) {
      console.error(`❌ ${s} error:`, err.message);
      outdated.push(s);
    }
  }

  if (ensureFromStart && needsFullHistory.length) {
    console.log(
      `Syncing ${needsFullHistory.length} symbols from ${targetStart}...`,
    );
    await syncHistoricalData(needsFullHistory, targetStart, {
      forceFromStart: true,
    });
  }

  const recentOutdated = outdated.filter(
    (symbol) => !needsFullHistory.includes(symbol),
  );

  // Jika ada data outdated → lakukan sync
  if (recentOutdated.length) {
    console.log(`Syncing ${recentOutdated.length} outdated symbols...`);
    await syncHistoricalData(recentOutdated, targetStart);
  }

  console.log("Historical check selesai");
}
