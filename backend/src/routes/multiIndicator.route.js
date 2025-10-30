import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
} from "../controllers/multiIndicator.controller.js";

const router = Router();

/* ==========================================================
   🚀 MULTI-INDICATOR STRATEGY (Sukma & Namahoot, 2025)
   "Enhancing Trading Strategies: A Multi-Indicator Analysis 
    for Profitable Algorithmic Trading"
========================================================== */

/**
 * POST /api/multi-indicator/:symbol/optimize-weights
 * ----------------------------------------------------------
 * Menjalankan evaluasi rule-based multi-indicator sesuai jurnal Sukma & Namahoot (2025).
 * - Tidak menggunakan optimasi acak
 * - Menguji kombinasi kategori: Trend, Momentum, Volatility
 * - Menyimpan hasil bobot terbaik ke database
 *
 * Request body (optional):
 * {
 *   "indicators": ["SMA", "EMA", "RSI", "MACD", "BollingerBands", "Stochastic", "PSAR", "StochasticRSI"]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "methodology": "Rule-Based Multi-Indicator Evaluation (Sukma & Namahoot, 2025)",
 *   "bestCombo": "Trend + Momentum + Volatility",
 *   "bestWeights": { ... },
 *   "performance": { "roi": 72.4, "winRate": 65.1, "maxDrawdown": 10.3 },
 *   ...
 * }
 */
router.post("/:symbol/optimize-weights", optimizeIndicatorWeightsController);

/**
 * GET /api/multi-indicator/:symbol/backtest
 * ----------------------------------------------------------
 * Melakukan backtest terhadap bobot indikator terbaik
 * yang telah disimpan di database.
 *
 * Response:
 * {
 *   "success": true,
 *   "symbol": "BTC-USD",
 *   "roi": 68.9,
 *   "winRate": 63.4,
 *   "maxDrawdown": 11.7,
 *   "finalCapital": 16890.0,
 *   "methodology": "Rule-Based Weighted Multi-Indicator Backtest"
 * }
 */
router.get("/:symbol/backtest", backtestWithOptimizedWeightsController);

export default router;
