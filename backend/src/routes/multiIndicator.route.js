import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
  backtestWithEqualWeightsController,
  optimizeAllCoinsController,
  backtestAllWithBTCWeightsController,
} from "../controllers/multiIndicator.controller.js";

const router = Router();

router.post("/:symbol/optimize-weights", optimizeIndicatorWeightsController);

router.get("/optimize-all", optimizeAllCoinsController);

router.get("/:symbol/backtest", backtestWithOptimizedWeightsController);

router.get("/:symbol/backtest-equal", backtestWithEqualWeightsController);

router.get("/backtest-all-btc", backtestAllWithBTCWeightsController);

export default router;
