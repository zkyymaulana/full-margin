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
import {
  syncTopCoins,
  syncTopCoinRanksFromCmc,
} from "../market/syncTopCoins.service.js";

/* ============================================================
   🧠 Global Cache & Job Tracker
============================================================ */
const activeJobs = new Map();
let symbolsCache = [];
let symbolsCacheTime = 0;
const SYMBOLS_CACHE_TTL = 5 * 60 * 1000; // 5 menit
let isMainSyncRunning = false;

const jobStats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  skippedRuns: 0,
  lastRun: null,
  lastRunDuration: 0,
  historicalSyncCompleted: false,
};

function hasActiveOptimization() {
  return getRunningJobs().length > 0;
}

/* ============================================================
   🚀 Start All Scheduler Jobs
============================================================ */
// Menyalakan semua scheduler utama backend.
export async function startAllSchedulers() {
  console.log("🚀 Starting crypto schedulers...");

  try {
    await refreshSymbolsCache();
    const runStartupHistoricalCheck =
      (process.env.RUN_HISTORICAL_CHECK_ON_STARTUP ?? "true") === "true";

    if (runStartupHistoricalCheck) {
      await checkAndSyncHistoricalData();
    } else {
      console.log("⏭️ Startup historical check skipped by configuration");
    }

    // Buat daftar job yang akan dijalankan
    const jobs = [
      {
        name: "hourly-candle-sync",
        schedule: "0 0 * * * *",
        task: runMainSyncJob,
        desc: "🕐 Hourly sync every hour (after candle close)",
      },
      {
        name: "backup-sync",
        schedule: "0 2 * * * *",
        task: () => runMainSyncJob(true),
        desc: "🔄 Backup sync (2 minutes after close)",
      },
      {
        name: "symbols-refresh",
        schedule: "0 */30 * * * *",
        task: refreshSymbolsCache,
        desc: "♻️ Refresh symbols cache (every 30 min)",
      },
      {
        name: "health-check",
        schedule: "0 */5 * * * *",
        task: logHealthCheck,
        desc: "💖 Health check (every 5 min)",
      },
      {
        name: "daily-historical-check",
        schedule: "0 0 3 * * *",
        task: checkAndSyncHistoricalData,
        desc: "📆 Daily historical check (3 AM)",
      },
      {
        name: "weekly-optimization-check",
        schedule: "0 0 2 * * 0",
        task: weeklyOptimizationCheck,
        desc: "📊 Weekly optimization (Sunday 2 AM)",
      },
      {
        name: "midnight-rank-sync",
        schedule: "0 0 0 * * *",
        task: runMidnightRankSync,
        desc: "🌙 Daily CMC rank sync (00:00)",
      },
    ];

    // Jalankan semua job
    jobs.forEach(({ name, schedule, task, desc }) => {
      const job = cron.schedule(
        schedule,
        async () => {
          console.log(`⏰ [${new Date().toISOString()}] ${desc}`);
          await task();
        },
        { scheduled: false, timezone: "Asia/Jakarta" },
      );

      job.start();
      activeJobs.set(name, job);
      console.log(`✅ ${desc}`);
    });

    console.log("✅ All schedulers started successfully!");
  } catch (err) {
    console.error("❌ Failed to start schedulers:", err.message);
  }
}

/* ============================================================
   🔁 Main Sync Process (Candle → Indicators → Signals)
============================================================ */
async function runMainSyncJob(isBackup = false) {
  const startTime = Date.now();
  jobStats.totalRuns++;

  if (hasActiveOptimization()) {
    jobStats.skippedRuns++;
    console.warn(
      `⏭️ ${isBackup ? "Backup" : "Main"} sync skipped: optimization is currently running`,
    );
    return;
  }

  if (isMainSyncRunning) {
    jobStats.skippedRuns++;
    console.warn(
      `⏭️ ${isBackup ? "Backup" : "Main"} sync skipped: previous sync still running`,
    );
    return;
  }

  isMainSyncRunning = true;

  try {
    // Refresh symbols cache jika expired
    if (
      Date.now() - symbolsCacheTime > SYMBOLS_CACHE_TTL ||
      !symbolsCache.length
    )
      await refreshSymbolsCache();

    if (!symbolsCache.length) throw new Error("No active symbols found");

    console.log(
      `🎯 ${isBackup ? "Backup" : "Main"} sync for ${symbolsCache.length} symbols...`,
    );

    // 1️⃣ Sinkronisasi candle (indicators calculated automatically inside)
    await syncLatestCandles(symbolsCache);

    // 2️⃣ Deteksi sinyal & kirim notifikasi Telegram (hanya untuk main job)
    // Always use "multi" mode - single indicator removed
    if (!isBackup) {
      await detectAndNotifyAllSymbols(symbolsCache, "multi");
    }

    jobStats.successfulRuns++;
    jobStats.lastRun = new Date();
    jobStats.lastRunDuration = Date.now() - startTime;
    console.log(
      `✅ ${isBackup ? "Backup" : "Main"} sync completed in ${jobStats.lastRunDuration}ms`,
    );
  } catch (err) {
    jobStats.failedRuns++;
    console.error(
      `❌ ${isBackup ? "Backup" : "Main"} sync failed:`,
      err.message,
    );
  } finally {
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
    console.log(`🔄 Symbols cache refreshed (${symbolsCache.length})`);
  } catch (err) {
    console.error("❌ Failed to refresh symbols:", err.message);
  }
}

async function weeklyOptimizationCheck() {
  if (hasActiveOptimization()) {
    console.warn(
      "⏭️ Weekly optimization check skipped: optimization job is running",
    );
    return;
  }

  if (!symbolsCache.length) await refreshSymbolsCache();
  await autoOptimizeCoinsWithoutWeights(symbolsCache);
}

async function runMidnightRankSync() {
  try {
    console.log("🌙 Running midnight rank synchronization...");

    const topCoinSync = await syncTopCoins();
    if (!topCoinSync?.success) {
      throw new Error(topCoinSync?.error || "Sync top coins gagal");
    }

    const rankSync = await syncTopCoinRanksFromCmc();
    if (!rankSync?.success) {
      throw new Error(rankSync?.error || "Rank sync CMC gagal");
    }

    console.log(
      `✅ Midnight rank sync selesai | updated: ${rankSync.updatedCount}, null fixed: ${rankSync.fixedNullCount}`,
    );
  } catch (err) {
    console.error("❌ Midnight rank sync failed:", err.message);
  }
}

function logHealthCheck() {
  const { totalRuns, successfulRuns } = jobStats;
  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(
    `💖 Health Check | Runs: ${totalRuns} | Success: ${((successfulRuns / totalRuns) * 100 || 0).toFixed(1)}% | Memory: ${mem.toFixed(1)}MB`,
  );
  if (mem > 500 && global.gc) {
    global.gc();
    console.log("🧹 Forced garbage collection");
  }
}

/* ============================================================
   🕒 Historical Data Check
============================================================ */
async function checkAndSyncHistoricalData() {
  if (hasActiveOptimization()) {
    console.warn("⏭️ Historical check skipped: optimization job is running");
    return;
  }

  if (!symbolsCache.length) await refreshSymbolsCache();
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
  stats: jobStats,
  symbolsCache: {
    count: symbolsCache.length,
    lastRefresh: new Date(symbolsCacheTime),
    symbols: symbolsCache,
  },
  uptime: process.uptime(),
  memory: process.memoryUsage(),
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
