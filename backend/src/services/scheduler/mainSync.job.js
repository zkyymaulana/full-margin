import { syncLatestCandles } from "../sync/candle-sync.service.js";
import { detectAndNotifyAllSymbols } from "../signals/signal-detection.service.js";
import { syncTopCoinRanksFromCmc } from "../market/index.js";
import {
  getSymbolsCache,
  isCacheExpired,
  refreshSymbolsCache,
} from "./cache.js";
import { getActiveSymbols } from "../sync/candle-sync.service.js";

// Flag untuk mencegah job jalan bersamaan (concurrency guard)
let isRunning = false;

/**
 * Job utama:
 * - refresh symbol
 * - sync candle
 * - update rank
 * - kirim signal
 */
export async function runMainSyncJob({ isBackup = false } = {}) {
  // Cegah duplicate run
  if (isRunning) {
    console.warn("Skip: previous sync masih berjalan");
    return;
  }

  isRunning = true;

  try {
    // Refresh cache jika expired atau kosong
    if (isCacheExpired() || !getSymbolsCache().length) {
      await refreshSymbolsCache(getActiveSymbols);
    }

    const symbols = getSymbolsCache();

    if (!symbols.length) {
      throw new Error("❌ Tidak ada symbol aktif");
    }

    console.log(`🚀 Sync ${symbols.length} symbols...`);

    // Update rank dari CMC (hanya untuk main job, bukan backup)
    if (!isBackup) {
      await syncTopCoinRanksFromCmc();
    }

    // 1. Sync candle + hitung indikator
    await syncLatestCandles(symbols);

    // 2. Deteksi signal & kirim notifikasi
    if (!isBackup) {
      await detectAndNotifyAllSymbols(symbols, "multi");
    }

    console.log("Main sync selesai");
  } catch (err) {
    console.error("Main sync error:", err.message);
  } finally {
    // Reset flag agar bisa jalan lagi di next cron
    isRunning = false;
  }
}
