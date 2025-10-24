import { Router } from "express";
import { optimizeIndicatorWeightsController } from "../controllers/multiIndicator.controller.js";

const router = Router();

/* ==========================================================
   🚀 MULTI-INDICATOR WEIGHT OPTIMIZATION
   Based on: Sukma & Namahoot (2025)
   "Enhancing Trading Strategies: A Multi-Indicator Analysis 
    for Profitable Algorithmic Trading"
========================================================== */

// Optimize weights for multiple indicators
// POST /api/multi-indicator/:symbol/optimize-weights
// Body: { indicators?: string[] }
// Default: All 8 indicators (SMA, EMA, RSI, MACD, BollingerBands, Stochastic, PSAR, StochasticRSI)
router.post("/:symbol/optimize-weights", optimizeIndicatorWeightsController);

export default router;
