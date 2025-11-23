import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
  backtestWithEqualWeightsController,
  optimizeAllCoinsController,
  backtestAllWithBTCWeightsController,
  validateSignalConsistencyController,
} from "../controllers/multiIndicator.controller.js";

const router = Router();

router.post("/:symbol/optimize-weights", optimizeIndicatorWeightsController);

router.get("/optimize-all", optimizeAllCoinsController);

router.get("/:symbol/backtest", backtestWithOptimizedWeightsController);

router.get("/:symbol/backtest-equal", backtestWithEqualWeightsController);

router.get("/backtest-all-btc", backtestAllWithBTCWeightsController);

// 🔍 Signal Validation Endpoint
router.get("/:symbol/validate-signals", validateSignalConsistencyController);

export default router;
