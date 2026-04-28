import cron from "node-cron";
import {
  syncLatestCandles,
  getActiveSymbols,
  syncHistoricalData,
} from "../sync/candle-sync.service.js";
import { calculateAndSaveIndicators } from "../indicators/indicator.service.js";
import {
  detectAndNotifyAllSymbols,
  autoOptimizeCoinsWithoutWeights,
} from "../signals/signal-detection.service.js";
import { prisma } from "../../lib/prisma.js";
import { getRunningJobs } from "../multiIndicator/optimization-job.service.js";
import { syncTopCoins, syncTopCoinRanksFromCmc } from "../market/index.js";

/* ============================================================
   🧠 Global Cache & Job Tracker
============================================================ */
const activeJobs = new Map();
let symbolsCache = [];
let symbolsCacheTime = 0;
const SYMBOLS_CACHE_TTL = 5 * 60 * 1000; // 5 menit
const TARGET_ACTIVE_SYMBOLS = Number(process.env.TARGET_ASSET_LIMIT || "10");
const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || "Asia/Jakarta";
const HOURLY_SYNC_CRON = process.env.HOURLY_SYNC_CRON || "0 * * * *";
const STARTUP_NOTIFICATION_MUTE_MS = 15 * 60 * 1000;

function getEnvBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return raw.toLowerCase() === "true";
}

let isMainSyncRunning = false;
let schedulerStartedAt = 0;

function hasActiveOptimization() {
  return getRunningJobs().length > 0;
}

/* ============================================================
   🚀 Start All Scheduler Jobs
============================================================ */
// Menyalakan semua scheduler utama backend.
export async function startAllSchedulers() {
  if (activeJobs.size > 0) {
    console.log("ℹ️ Scheduler already running. Skip duplicate initialization.");
    return;
  }

  console.log("🚀 Starting crypto schedulers...");

  try {
    schedulerStartedAt = Date.now();
    await refreshSymbolsCache();
    await checkAndSyncHistoricalData({ forceBackfill: true });

    // Buat daftar job yang akan dijalankan
    const jobs = [
      {
        name: "hourly-candle-sync",
        schedule: HOURLY_SYNC_CRON,
        task: () => runMainSyncJob({ isBackup: false }),
        desc: "🕐 Hourly sync every hour (minute 0)",
      },
      getEnvBool("ENABLE_BACKUP_SYNC", false) && {
        name: "backup-sync",
        schedule: "0 2 * * * *",
        task: () => runMainSyncJob({ isBackup: true }),
        desc: "🔄 Backup sync (2 minutes after close)",
      },
      {
        name: "symbols-refresh",
        schedule: "0 */30 * * * *",
        task: refreshSymbolsCache,
        desc: "♻️ Refresh symbols cache (every 30 min)",
      },
      getEnvBool("ENABLE_DAILY_HISTORICAL_CHECK", false) && {
        name: "daily-historical-check",
        schedule: "0 0 3 * * *",
        task: checkAndSyncHistoricalData,
        desc: "📆 Daily historical check (3 AM)",
      },
    ].filter(Boolean);

    // Jalankan semua job
    jobs.forEach(({ name, schedule, task, desc }) => {
      if (!cron.validate(schedule)) {
        console.error(
          `❌ Invalid cron expression for ${name}: ${schedule}. Job skipped.`,
        );
        return;
      }

      const job = cron.schedule(
        schedule,
        async () => {
          console.log(
            `⏰ [${new Date().toISOString()}] Executing ${name} | expr="${schedule}" | tz="${SCHEDULER_TIMEZONE}"`,
          );
          await task();
        },
        { scheduled: false, timezone: SCHEDULER_TIMEZONE },
      );

      job.start();
      activeJobs.set(name, job);
      console.log(
        `📅 [${new Date().toISOString()}] Scheduled ${name} | expr="${schedule}" | tz="${SCHEDULER_TIMEZONE}" | ${desc}`,
      );
    });

    console.log("✅ All schedulers started successfully!");
  } catch (err) {
    console.error("❌ Failed to start schedulers:", err.message);
  }
}

/* ============================================================
   🔁 Main Sync Process (Candle → Indicators → Signals)
============================================================ */
async function runMainSyncJob(options = {}) {
  const { isBackup = false, ignoreStartupMute = false } = options;

  const startTime = Date.now();
  const syncType = isBackup ? "Backup" : "Main";
  const perfLabel = `perf:${syncType.toLowerCase()}-sync:${new Date(startTime).toISOString()}`;
  const perf = {
    startedAtIso: new Date(startTime).toISOString(),
    refreshSymbolsMs: 0,
    rankSyncMs: 0,
    candleSyncMs: 0,
    notificationMs: 0,
  };

  isMainSyncRunning = true;
  console.time(perfLabel);
  console.log(
    `🚦 [${perf.startedAtIso}] ${syncType} sync started | symbolsCached=${symbolsCache.length}`,
  );

  try {
    // Refresh symbols cache jika expired
    if (
      Date.now() - symbolsCacheTime > SYMBOLS_CACHE_TTL ||
      !symbolsCache.length
    ) {
      const refreshStart = Date.now();
      await refreshSymbolsCache();
      perf.refreshSymbolsMs = Date.now() - refreshStart;
      console.log(
        `⏱️ [${new Date().toISOString()}] ${syncType} sync phase: refreshSymbols done in ${perf.refreshSymbolsMs}ms`,
      );
    }

    if (!symbolsCache.length) throw new Error("No active symbols found");

    console.log(`🎯 ${syncType} sync for ${symbolsCache.length} symbols...`);

    // Sinkronisasi rank terbaru dari CMC pada setiap siklus cron utama.
    const rankSyncStart = Date.now();
    const rankSync = await syncTopCoinRanksFromCmc();
    perf.rankSyncMs = Date.now() - rankSyncStart;
    if (!rankSync?.success) {
      console.warn(
        `⚠️ ${syncType} sync phase: rank sync gagal (${rankSync?.error || "unknown error"})`,
      );
    } else {
      console.log(
        `⏱️ [${new Date().toISOString()}] ${syncType} sync phase: rank sync done in ${perf.rankSyncMs}ms (updated=${rankSync.updatedCount}, nullFixed=${rankSync.fixedNullCount})`,
      );
    }

    // 1️⃣ Sinkronisasi candle (indicators calculated automatically inside)
    const candleSyncStart = Date.now();
    await syncLatestCandles(symbolsCache);
    perf.candleSyncMs = Date.now() - candleSyncStart;
    console.log(
      `⏱️ [${new Date().toISOString()}] ${syncType} sync phase: candle sync + indicator calculation done in ${perf.candleSyncMs}ms`,
    );

    // 2️⃣ Deteksi sinyal & kirim notifikasi Telegram (hanya untuk main job)
    // Always use "multi" mode - single indicator removed
    if (!isBackup) {
      const isWithinStartupMuteWindow =
        Date.now() - schedulerStartedAt < STARTUP_NOTIFICATION_MUTE_MS;

      if (!ignoreStartupMute && isWithinStartupMuteWindow) {
        console.log(
          "🔕 Skip Telegram notification during startup stabilization window",
        );
      } else {
        console.log(
          `⏱️ [${new Date().toISOString()}] ${syncType} sync phase: notification dispatch starting`,
        );
        const notifyStart = Date.now();
        await detectAndNotifyAllSymbols(symbolsCache, "multi");
        perf.notificationMs = Date.now() - notifyStart;
        console.log(
          `⏱️ [${new Date().toISOString()}] ${syncType} sync phase: notification dispatch done in ${perf.notificationMs}ms`,
        );
      }
    }
  } catch (err) {
    console.error(`❌ ${syncType} sync failed:`, err.message);
  } finally {
    console.timeEnd(perfLabel);
    isMainSyncRunning = false;
  }
}

/* ============================================================
  🧩 Supporting Jobs
============================================================ */
async function refreshSymbolsCache() {
  try {
    symbolsCache = await getActiveSymbols();
    symbolsCacheTime = Date.now();
    console.log(`Symbols cache refreshed (${symbolsCache.length})`);
  } catch (err) {
    console.error("Failed to refresh symbols:", err.message);
  }
}

/* ============================================================
   🕒 Historical Data Check
============================================================ */
async function checkAndSyncHistoricalData(options = {}) {
  const { forceBackfill = false } = options;

  if (hasActiveOptimization()) {
    console.warn("⏭️ Historical check skipped: optimization job is running");
    return;
  }

  if (!symbolsCache.length) await refreshSymbolsCache();

  // Jika kuota simbol aktif sudah terpenuhi, skip backfill historis berat.
  if (!forceBackfill && symbolsCache.length >= TARGET_ACTIVE_SYMBOLS) {
    console.log(
      `⏭️ Historical backfill skipped: active symbols already meet target (${symbolsCache.length}/${TARGET_ACTIVE_SYMBOLS})`,
    );
    return;
  }

  console.log(
    `🔍 Checking historical data for ${symbolsCache.length} symbols...`,
  );

  const targetStart = process.env.CANDLE_START_DATE || "2020-01-01T00:00:00Z";
  const targetStartTime = new Date(targetStart).getTime();
  const now = Date.now();

  const outdated = [];
  const missingIndicators = [];

  // Get timeframe ID once
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe: "1h" },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.error('❌ Timeframe "1h" not found in database');
    return;
  }

  for (const s of symbolsCache) {
    try {
      // Get coin ID
      const coin = await prisma.coin.findUnique({
        where: { symbol: s },
        select: { id: true },
      });

      if (!coin) {
        console.log(`⚠️ ${s}: Coin not found in database`);
        outdated.push(s);
        continue;
      }

      // Check candle data
      const last = await prisma.candle.findFirst({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
        orderBy: { time: "desc" },
        select: { time: true },
      });
      const time = last ? Number(last.time) : 0;
      if (time < now - 3 * 3600 * 1000) outdated.push(s);

      // ✅ NEW: Check if indicators are missing for existing candles
      if (last) {
        const candleCount = await prisma.candle.count({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
          },
        });
        const indicatorCount = await prisma.indicator.count({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
          },
        });

        // If we have more candles than indicators (accounting for 50-period warmup)
        if (candleCount > 50 && indicatorCount < candleCount - 50) {
          const missing = candleCount - indicatorCount - 50;
          console.log(`⚠️ ${s}: Found ${missing} candles without indicators`);
          missingIndicators.push({ symbol: s, missing });
        }
      }
    } catch (err) {
      console.error(`❌ ${s}: Check failed -`, err.message);
      outdated.push(s);
    }
  }

  if (outdated.length) {
    console.log(`⚠️ Syncing ${outdated.length} outdated symbols...`);
    await syncHistoricalData(outdated, targetStart.split("T")[0]);
  } else console.log("✅ All symbols up-to-date!");

  // ✅ NEW: Calculate missing indicators ONE BY ONE (tidak sekaligus)
  if (missingIndicators.length) {
    console.log(
      `📊 Calculating indicators for ${missingIndicators.length} symbols...`,
    );
    console.log(`⏱️ This may take a while for large datasets...`);

    for (let i = 0; i < missingIndicators.length; i++) {
      const { symbol, missing } = missingIndicators[i];
      try {
        console.log(
          `\n[${i + 1}/${missingIndicators.length}] Processing ${symbol} (${missing.toLocaleString()} missing)...`,
        );
        await calculateAndSaveIndicators(symbol, "1h");

        // ✅ Small delay between symbols to prevent overload
        if (i < missingIndicators.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(
          `❌ ${symbol}: Failed to calculate indicators -`,
          err.message,
        );
        // Continue with next symbol instead of crashing
        continue;
      }
    }

    console.log(`\n✅ Finished processing ${missingIndicators.length} symbols`);
  }
}

/* ============================================================
   ⏹️ Stop & Status
============================================================ */
// Menghentikan seluruh scheduler yang sedang aktif.
export function stopAllSchedulers() {
  console.log("⏹️ Stopping schedulers...");
  for (const [name, job] of activeJobs) {
    job.destroy();
    console.log(`⏹️ Stopped ${name}`);
  }
  activeJobs.clear();
  console.log("✅ All stopped");
}

// Mengambil status scheduler, statistik job, dan informasi cache simbol.
export const getSchedulerStatus = () => ({
  activeJobs: [...activeJobs.keys()],
  jobCount: activeJobs.size,
  symbolsCache: {
    count: symbolsCache.length,
    lastRefresh: new Date(symbolsCacheTime),
    symbols: symbolsCache,
  },
  uptime: process.uptime(),
});

/* ============================================================
   🧘 Graceful Shutdown
============================================================ */
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
function shutdown() {
  console.log("\n🛑 Graceful shutdown...");
  stopAllSchedulers();
  process.exit(0);
}
