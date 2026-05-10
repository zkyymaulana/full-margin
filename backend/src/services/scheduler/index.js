import cron from "node-cron";
import { runMainSyncJob } from "./mainSync.job.js";
import { checkAndSyncHistoricalData } from "./historical.job.js";

const SCHEDULER_TIMEZONE = "Asia/Jakarta";

// Jalankan semua scheduler.
export async function startAllSchedulers() {
  console.log("🚀 Starting schedulers...");

  try {
    // Pastikan historical data lengkap saat startup.
    await checkAndSyncHistoricalData({
      ensureFromStart: true,
    });

    // Main sync tiap jam.
    cron.schedule("0 * * * *", runMainSyncJob, {
      timezone: SCHEDULER_TIMEZONE,
    });

    // Historical check harian jam 3 pagi.
    cron.schedule("0 0 3 * * *", checkAndSyncHistoricalData, {
      timezone: SCHEDULER_TIMEZONE,
    });

    console.log("Scheduler started");
  } catch (err) {
    console.error("Failed starting schedulers:", err.message);
  }
}
