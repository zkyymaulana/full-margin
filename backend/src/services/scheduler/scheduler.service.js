import cron from "node-cron";
import {
  syncLatestCandles,
  getActiveSymbols,
} from "../sync/candle-sync.service.js";
import { calculateAndSaveIndicators } from "../indicators/indicator.service.js";

// Store active cron jobs
const activeJobs = new Map();
const jobStats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRun: null,
  lastRunDuration: 0,
};

// Cache untuk symbols agar tidak query database setiap kali
let symbolsCache = [];
let symbolsCacheTime = 0;
const SYMBOLS_CACHE_TTL = 5 * 60 * 1000; // 5 menit

export async function startAllSchedulers() {
  console.log("🚀 Starting all crypto data schedulers...");

  try {
    // Load initial symbols
    await refreshSymbolsCache();

    // Start main hourly job - runs at minute 59 of every hour (1 minute before candle close)
    // This gives us time to fetch and process data before the next candle starts
    startHourlyCandleJob();

    // Start backup job - runs at minute 2 of every hour (2 minutes after candle close)
    // This catches any data that might have been missed
    startBackupJob();

    // Start symbols refresh job - every 30 minutes
    startSymbolsRefreshJob();

    // Start health check job - every 5 minutes
    startHealthCheckJob();

    console.log("✅ All schedulers started successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to start schedulers:", error.message);
    throw error;
  }
}

function startHourlyCandleJob() {
  // Cron format: second minute hour day month dayOfWeek
  // "0 59 * * * *" = runs at second 0, minute 59 of every hour
  const job = cron.schedule(
    "0 59 * * * *",
    async () => {
      console.log(
        `⏰ [${new Date().toISOString()}] Starting hourly candle sync...`
      );
      await runMainSyncJob();
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta", // Sesuaikan dengan timezone Anda
    }
  );

  job.start();
  activeJobs.set("hourly-candle-sync", job);
  console.log(
    "🕐 Hourly candle sync job scheduled (59th minute of every hour)"
  );
}

function startBackupJob() {
  // Backup job runs 2 minutes after hour change
  const job = cron.schedule(
    "0 2 * * * *",
    async () => {
      console.log(`🔄 [${new Date().toISOString()}] Running backup sync...`);
      await runMainSyncJob(true);
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta",
    }
  );

  job.start();
  activeJobs.set("backup-sync", job);
  console.log("🔄 Backup sync job scheduled (2nd minute of every hour)");
}

function startSymbolsRefreshJob() {
  // Refresh symbols every 30 minutes
  const job = cron.schedule(
    "0 */30 * * * *",
    async () => {
      console.log(
        `🔄 [${new Date().toISOString()}] Refreshing symbols cache...`
      );
      await refreshSymbolsCache();
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta",
    }
  );

  job.start();
  activeJobs.set("symbols-refresh", job);
  console.log("🔄 Symbols refresh job scheduled (every 30 minutes)");
}

function startHealthCheckJob() {
  // Health check every 5 minutes
  const job = cron.schedule(
    "0 */5 * * * *",
    async () => {
      const stats = getJobStats();
      const memUsage = process.memoryUsage();

      console.log(
        `💖 Health Check - Runs: ${stats.totalRuns}, Success Rate: ${((stats.successfulRuns / stats.totalRuns) * 100 || 0).toFixed(1)}%, Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
      );

      // Force garbage collection if memory usage is high
      if (memUsage.heapUsed > 500 * 1024 * 1024) {
        // 500MB
        if (global.gc) {
          global.gc();
          console.log("🧹 Forced garbage collection");
        }
      }
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta",
    }
  );

  job.start();
  activeJobs.set("health-check", job);
  console.log("💖 Health check job scheduled (every 5 minutes)");
}

async function runMainSyncJob(isBackup = false) {
  const startTime = Date.now();
  jobStats.totalRuns++;

  try {
    // Pastikan symbols cache up to date
    if (
      symbolsCache.length === 0 ||
      Date.now() - symbolsCacheTime > SYMBOLS_CACHE_TTL
    ) {
      await refreshSymbolsCache();
    }

    if (symbolsCache.length === 0) {
      throw new Error("No active symbols found");
    }

    console.log(
      `🎯 ${isBackup ? "Backup" : "Main"} sync starting for ${symbolsCache.length} symbols...`
    );

    // Step 1: Sync candle data
    const candleResult = await syncLatestCandles(symbolsCache);

    // Step 2: Calculate indicators for symbols that got new candles
    const symbolsWithNewCandles = symbolsCache.filter((symbol) => {
      // Run indicators for all symbols in main job, only updated ones in backup
      return isBackup ? false : true; // Always run in main job, skip in backup for performance
    });

    if (symbolsWithNewCandles.length > 0) {
      console.log(
        `📊 Calculating indicators for ${symbolsWithNewCandles.length} symbols...`
      );

      // Calculate indicators in parallel but with concurrency limit
      const CONCURRENCY_LIMIT = 3;
      for (
        let i = 0;
        i < symbolsWithNewCandles.length;
        i += CONCURRENCY_LIMIT
      ) {
        const batch = symbolsWithNewCandles.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.allSettled(
          batch.map((symbol) => calculateAndSaveIndicators(symbol, "1h"))
        );

        // Small delay between batches
        if (i + CONCURRENCY_LIMIT < symbolsWithNewCandles.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    const duration = Date.now() - startTime;
    jobStats.successfulRuns++;
    jobStats.lastRun = new Date();
    jobStats.lastRunDuration = duration;

    console.log(
      `✅ ${isBackup ? "Backup" : "Main"} sync completed successfully (${duration}ms)`
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    jobStats.lastRun = new Date();
    jobStats.lastRunDuration = duration;

    console.error(
      `❌ ${isBackup ? "Backup" : "Main"} sync failed:`,
      error.message
    );

    // Don't throw error to prevent cron job from stopping
  }
}

async function refreshSymbolsCache() {
  try {
    const symbols = await getActiveSymbols();
    symbolsCache = symbols;
    symbolsCacheTime = Date.now();
    console.log(`🔄 Symbols cache refreshed: ${symbols.length} active symbols`);
  } catch (error) {
    console.error("❌ Failed to refresh symbols cache:", error.message);
  }
}

export function stopAllSchedulers() {
  console.log("⏹️ Stopping all schedulers...");

  for (const [name, job] of activeJobs) {
    job.destroy();
    console.log(`⏹️ Stopped ${name}`);
  }

  activeJobs.clear();
  console.log("✅ All schedulers stopped");
}

export function getSchedulerStatus() {
  return {
    activeJobs: Array.from(activeJobs.keys()),
    jobCount: activeJobs.size,
    stats: jobStats,
    symbolsCache: {
      count: symbolsCache.length,
      lastRefresh: new Date(symbolsCacheTime),
      symbols: symbolsCache,
    },
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
}

export function getJobStats() {
  return { ...jobStats };
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Graceful shutdown initiated...");
  stopAllSchedulers();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 SIGTERM received, shutting down...");
  stopAllSchedulers();
  process.exit(0);
});
