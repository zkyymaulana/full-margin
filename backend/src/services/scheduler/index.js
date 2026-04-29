import cron from "node-cron";
import { runMainSyncJob } from "./mainSync.job.js";
import { checkAndSyncHistoricalData } from "./historical.job.js";

const SCHEDULER_TIMEZONE = "Asia/Jakarta";

/**
 * Start semua scheduler
 */
export async function startAllSchedulers() {
  console.log("🚀 Starting schedulers...");

  await checkAndSyncHistoricalData({ ensureFromStart: true });

  // 1. Main sync tiap jam
  cron.schedule("0 * * * *", () => runMainSyncJob({ isBackup: false }), {
    timezone: SCHEDULER_TIMEZONE,
  });

  // 2. Backup sync (opsional)
  cron.schedule("0 2 * * * *", () => runMainSyncJob({ isBackup: true }), {
    timezone: SCHEDULER_TIMEZONE,
  });

  // 3. Historical check (harian)
  cron.schedule("0 0 3 * * *", checkAndSyncHistoricalData, {
    timezone: SCHEDULER_TIMEZONE,
  });

  console.log("Scheduler started");
}
