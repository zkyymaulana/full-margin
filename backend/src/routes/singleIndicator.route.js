import { Router } from "express";
import {
  backtestSingleIndicatorController,
  backtestAllIndicatorsController,
} from "../controllers/singleIndicator.controller.js";

const router = Router();

/* ==========================================================
   📊 SINGLE INDICATOR BACKTEST ENDPOINTS
   Based on: Sukma & Namahoot (2025)
========================================================== */

// Backtest single indicator
// GET  /api/single-indicator/:symbol/backtest/:indicator
// POST /api/single-indicator/:symbol/backtest/:indicator
router.get("/:symbol/backtest/:indicator", backtestSingleIndicatorController);
router.post("/:symbol/backtest/:indicator", backtestSingleIndicatorController);

// Compare all indicators
// GET /api/single-indicator/:symbol/backtest-all
router.get("/:symbol/backtest-all", backtestAllIndicatorsController);

export default router;
