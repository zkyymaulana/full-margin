import { Router } from "express";
import {
  backtestSingleIndicatorController,
  backtestAllIndicatorsController,
} from "../controllers/singleIndicator.controller.js";

const router = Router();

router.get("/:symbol/backtest/:indicator", backtestSingleIndicatorController);
router.post("/:symbol/backtest/:indicator", backtestSingleIndicatorController);

// Compare all indicators
router.get("/:symbol/backtest-all", backtestAllIndicatorsController);

export default router;
