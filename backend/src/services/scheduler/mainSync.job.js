import { syncLatestCandles } from "../sync/candle-sync.service.js";
import { detectAndNotifyAllSymbols } from "../signals/signal-detection.service.js";
import { syncTopCoinRanksFromCmc } from "../market/index.js";
import { getWatchlistSymbolsForTelegram } from "../watchlist/index.js";
import {
  getSymbolsCache,
  isCacheExpired,
  refreshSymbolsCache,
} from "./cache.js";
import { getActiveSymbols } from "../sync/candle-sync.service.js";

// Flag untuk mencegah job berjalan bersamaan.
let isRunning = false;

// Job utama: refresh simbol, sync candle, update rank, kirim sinyal
export async function runMainSyncJob(options = {}) {
  const includeTimings = options.includeTimings === true;
  const watchlistOnly = options.watchlistOnly === true;
  // Cegah job ganda berjalan bersamaan.
  if (isRunning) {
    console.warn("Skip: previous sync masih berjalan");
    return { status: "skipped", reason: "already_running" };
  }

  isRunning = true;

  try {
    // Refresh cache jika kedaluwarsa atau kosong.
    if (isCacheExpired() || !getSymbolsCache().length) {
      await refreshSymbolsCache(getActiveSymbols);
    }

    let symbols = getSymbolsCache();

    if (watchlistOnly) {
      symbols = await getWatchlistSymbolsForTelegram();
    }

    if (!symbols.length) {
      if (watchlistOnly) {
        console.log("Skip: tidak ada watchlist dengan Telegram aktif");
        return { status: "skipped", reason: "no_watchlist_symbols" };
      }

      throw new Error("Tidak ada simbol aktif");
    }

    console.log(`Sync ${symbols.length} symbols...`);

    // Update rank dari CMC
    await syncTopCoinRanksFromCmc();

    // Sync candle lalu hitung indikator.
    await syncLatestCandles(symbols);

    // Deteksi sinyal dan kirim notifikasi.
    const notifyResult = await detectAndNotifyAllSymbols(symbols, "multi", {
      includeTimings,
    });

    console.log("Main sync selesai");
    return { status: "completed", notify: notifyResult };
  } catch (err) {
    console.error("Main sync error:", err.message);
    return { status: "failed", error: err.message };
  } finally {
    // Reset flag agar bisa jalan lagi di cron berikutnya.
    isRunning = false;
  }
}
