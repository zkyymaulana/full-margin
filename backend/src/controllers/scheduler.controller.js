import {
  startAllSchedulers,
  stopAllSchedulers,
  getSchedulerStatus,
} from "../services/scheduler/scheduler.service.js";
import {
  backfillSignalsForExistingData,
  backfillAllSymbolsSignals,
} from "../services/indicators/indicator.service.js";

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

export async function backfillSignals(req, res) {
  try {
    const { symbol } = req.params;
    const timeframe = req.query.timeframe || "1h";

    if (symbol) {
      // Backfill specific symbol
      await backfillSignalsForExistingData(symbol, timeframe);
      res.json({
        success: true,
        message: `Signal backfill completed for ${symbol}`,
        symbol,
        timeframe,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Backfill all symbols
      await backfillAllSymbolsSignals(timeframe);
      res.json({
        success: true,
        message: "Signal backfill completed for all symbols",
        timeframe,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Backfill signals error:", error);
    res.status(500).json({
      success: false,
      message: "Signal backfill failed",
      error: error.message,
    });
  }
}
