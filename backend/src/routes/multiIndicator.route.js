import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
  optimizeAllCoinsController,
} from "../controllers/multiIndicator.controller.js";

const router = Router();

router.post("/:symbol/optimize-weights", optimizeIndicatorWeightsController);

router.get("/optimize-all", optimizeAllCoinsController);

router.get("/:symbol/backtest", backtestWithOptimizedWeightsController);

export default router;
