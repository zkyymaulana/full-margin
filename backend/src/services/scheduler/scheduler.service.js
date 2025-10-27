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

// Store active cron jobs
const activeJobs = new Map();
const jobStats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRun: null,
  lastRunDuration: 0,
  historicalSyncCompleted: false,
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

    // Check and perform historical data sync if needed (runs once on startup)
    await checkAndSyncHistoricalData();

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

    // Start daily historical check job - runs daily at 3 AM to check for missing data
    startDailyHistoricalCheckJob();

    // 🆕 Start weekly optimization check job - runs every Sunday at 2 AM
    startWeeklyOptimizationCheckJob();

    console.log("✅ All schedulers started successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to start schedulers:", error.message);
    throw error;
  }
}

async function checkAndSyncHistoricalData() {
  console.log("🔍 Quick historical data check for all symbols...");

  try {
    if (symbolsCache.length === 0) {
      console.log("⚠️ No symbols found, skipping historical check");
      return;
    }

    // Get target start date from env or default to 2020-01-01
    const targetStartDate =
      process.env.CANDLE_START_DATE || "2020-01-01T00:00:00Z";
    const targetStartTime = new Date(targetStartDate).getTime();
    const currentTime = Date.now();

    console.log(
      `📅 Target start date: ${new Date(targetStartTime).toISOString()}`
    );
    console.log(`📊 Checking ${symbolsCache.length} symbols...`);

    const symbolsNeedingSync = [];
    let completeCount = 0;

    // Quick check each symbol
    for (const symbol of symbolsCache) {
      try {
        // Get only the newest candle time (fastest query)
        const newestCandle = await prisma.candle.findFirst({
          where: { symbol, timeframe: "1h" },
          orderBy: { time: "desc" },
          select: { time: true },
        });

        if (!newestCandle) {
          // No data at all
          console.log(`❌ ${symbol}: No data`);
          symbolsNeedingSync.push(symbol);
          continue;
        }

        const newestTime =
          newestCandle.time instanceof Date
            ? newestCandle.time.getTime()
            : Number(newestCandle.time);

        // Check if data is up to date (within last 3 hours)
        const threeHoursAgo = currentTime - 3 * 60 * 60 * 1000;

        if (newestTime < threeHoursAgo) {
          console.log(
            `⚠️ ${symbol}: Outdated (last: ${new Date(newestTime).toISOString()})`
          );
          symbolsNeedingSync.push(symbol);
        } else {
          console.log(`✅ ${symbol}: Up to date`);
          completeCount++;
        }
      } catch (error) {
        console.error(`❌ ${symbol}: Check failed - ${error.message}`);
        symbolsNeedingSync.push(symbol);
      }
    }

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 QUICK CHECK SUMMARY:`);
    console.log(`   ✅ Up to date: ${completeCount}/${symbolsCache.length}`);
    console.log(
      `   ⚠️  Need sync: ${symbolsNeedingSync.length}/${symbolsCache.length}`
    );
    console.log(`${"=".repeat(60)}\n`);

    // If any symbols need sync, start historical sync in background
    if (symbolsNeedingSync.length > 0) {
      console.log(
        `🔄 Starting quick sync for ${symbolsNeedingSync.length} symbols...`
      );
      console.log(`⏰ This will run in the background.`);

      // Start historical sync in background
      syncHistoricalData(symbolsNeedingSync, targetStartDate.split("T")[0])
        .then((result) => {
          jobStats.historicalSyncCompleted = true;
          console.log("✅ Historical sync completed!");
          console.log(
            `   💾 Total candles: ${result.totalCandles.toLocaleString()}`
          );
          console.log(
            `   ✅ Success: ${result.successful}/${symbolsNeedingSync.length}`
          );
          console.log(
            `   ❌ Failed: ${result.failed}/${symbolsNeedingSync.length}`
          );
        })
        .catch((error) => {
          console.error("❌ Historical sync failed:", error.message);
        });
    } else {
      console.log("✅ All symbols are up to date!");
      jobStats.historicalSyncCompleted = true;
    }
  } catch (error) {
    console.error("❌ Historical data check failed:", error.message);
  }
}

function startDailyHistoricalCheckJob() {
  // Runs daily at 3 AM to check for and fill any gaps in historical data
  const job = cron.schedule(
    "0 0 3 * * *",
    async () => {
      console.log(
        `🔍 [${new Date().toISOString()}] Running daily historical data check...`
      );
      await checkAndSyncHistoricalData();
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta",
    }
  );

  job.start();
  activeJobs.set("daily-historical-check", job);
  console.log("🔍 Daily historical check job scheduled (every day at 3:00 AM)");
}

function startWeeklyOptimizationCheckJob() {
  // Runs every Sunday at 2 AM to check which coins need optimization
  const job = cron.schedule(
    "0 0 2 * * 0",
    async () => {
      console.log(
        `🔍 [${new Date().toISOString()}] Running weekly optimization check...`
      );

      if (symbolsCache.length === 0) {
        await refreshSymbolsCache();
      }

      await autoOptimizeCoinsWithoutWeights(symbolsCache);
    },
    {
      scheduled: false,
      timezone: "Asia/Jakarta",
    }
  );

  job.start();
  activeJobs.set("weekly-optimization-check", job);
  console.log(
    "🔍 Weekly optimization check job scheduled (every Sunday at 2:00 AM)"
  );
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

    // Step 3: 🔔 DETECT AND SEND TELEGRAM SIGNALS (only in main job, not backup)
    if (!isBackup) {
      console.log(`\n🔔 Detecting and sending trading signals...`);

      try {
        // Detect signals for all symbols
        // Mode: "multi" = only multi-indicator signals (recommended for production)
        // Mode: "single" = only single indicator signals
        // Mode: "both" = both single and multi (may cause spam)
        const signalMode = process.env.SIGNAL_MODE || "multi";

        await detectAndNotifyAllSymbols(symbolsCache, signalMode);

        console.log(`✅ Signal detection and notification completed`);
      } catch (signalError) {
        console.error(`❌ Error in signal detection:`, signalError.message);
        // Don't throw error, continue with the main job
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
