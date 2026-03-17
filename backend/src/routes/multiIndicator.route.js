import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
  optimizeAllCoinsController,
  getOptimizationEstimateController,
  streamOptimizationProgressController,
  cancelOptimizationController,
} from "../controllers/index.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// ✅ SSE endpoint - NO AUTH MIDDLEWARE (handles auth internally via query token)
router.get("/:symbol/optimize-stream", streamOptimizationProgressController);

// ✅ All other routes - USE AUTH MIDDLEWARE
router.get(
  "/:symbol/estimate",
  authMiddleware,
  getOptimizationEstimateController
);
router.post(
  "/:symbol/optimize-weights",
  authMiddleware,
  optimizeIndicatorWeightsController
);
router.get("/optimize-all", authMiddleware, optimizeAllCoinsController);
router.get(
  "/:symbol/backtest",
  authMiddleware,
  backtestWithOptimizedWeightsController
);
router.post("/:symbol/cancel", authMiddleware, cancelOptimizationController);

export default router;
