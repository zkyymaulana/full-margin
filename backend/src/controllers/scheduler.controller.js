import {
  startAllSchedulers,
  stopAllSchedulers,
  getSchedulerStatus,
} from "../services/scheduler/scheduler.service.js";
import { updateAllListingDates } from "../services/sync/candle-sync.service.js";

export async function startSchedulers(req, res) {
  try {
    await startAllSchedulers();
    res.json({
      success: true,
      message: "All schedulers started successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Start schedulers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start schedulers",
      error: error.message,
    });
  }
}

export async function stopSchedulers(req, res) {
  try {
    stopAllSchedulers();
    res.json({
      success: true,
      message: "All schedulers stopped successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stop schedulers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop schedulers",
      error: error.message,
    });
  }
}

export async function getStatus(req, res) {
  try {
    const status = getSchedulerStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get scheduler status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get scheduler status",
      error: error.message,
    });
  }
}

/**
 * Update listing dates for all coins based on earliest candles
 */
export async function updateListingDates(req, res) {
  try {
    console.log("📅 Manual listing date update triggered...");
    const results = await updateAllListingDates();

    res.json({
      success: true,
      message: "Listing dates updated successfully",
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Update listing dates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update listing dates",
      error: error.message,
    });
  }
}
