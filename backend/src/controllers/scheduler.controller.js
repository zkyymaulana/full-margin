import { startAllSchedulers } from "../services/scheduler/index.js";
import { updateAllListingDates } from "../services/sync/candle-sync.service.js";

// Menjalankan semua scheduler yang diperlukan backend.
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

// Memperbarui listing date semua coin berdasarkan candle paling awal.
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
