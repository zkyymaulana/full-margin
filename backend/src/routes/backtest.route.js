/**
 * 🛣️ Backtest Routes - Backtesting API Endpoints
 * Handles all backtesting-related HTTP requests
 * 
 * @description Routes untuk API endpoint backtesting strategi trading
 * @endpoints GET /api/backtest, POST /api/backtest/run, GET /api/backtest/results
 */

import express from "express";
import { getBacktestResults, runBacktest, getBacktestHistory } from "../controllers/backtest.controller.js";

const router = express.Router();

/**
 * GET /api/backtest
 * Get historical backtest results
 */
router.get("/", getBacktestResults);

/**
 * POST /api/backtest/run
 * Run new backtest with specified parameters
 */
router.post("/run", runBacktest);

/**
 * GET /api/backtest/results
 * Get detailed backtest results and statistics
 */
router.get("/results", getBacktestHistory);

/**
 * GET /api/backtest/health
 * Health check for backtest service
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "backtest",
    message: "🧪 Backtest service is running",
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET /api/backtest - Get historical backtest results",
      "POST /api/backtest/run - Run new backtest",
      "GET /api/backtest/results - Get detailed results",
      "GET /api/backtest/health - Service health check"
    ]
  });
});

export default router;