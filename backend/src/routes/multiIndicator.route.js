import { Router } from "express";
import {
  optimizeIndicatorWeightsController,
  backtestWithOptimizedWeightsController,
  optimizeAllCoinsController,
  getOptimizationEstimateController,
  getOptimizationStatusController,
  streamOptimizationProgressController,
  cancelOptimizationController,
} from "../controllers/index.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Stream progress optimasi secara realtime (pakai SSE, auth via query token)
router.get("/:symbol/optimize-stream", streamOptimizationProgressController);

// Menghitung estimasi waktu/biaya sebelum optimasi dijalankan
router.get(
  "/:symbol/estimate",
  authMiddleware,
  getOptimizationEstimateController,
);

// Mengambil status proses optimasi (running, selesai, gagal)
router.get("/:symbol/status", authMiddleware, getOptimizationStatusController);

// Menjalankan optimasi bobot indikator untuk 1 symbol
router.post(
  "/:symbol/optimize-weights",
  authMiddleware,
  optimizeIndicatorWeightsController,
);

// Menjalankan optimasi untuk semua coin
router.get("/optimize-all", authMiddleware, optimizeAllCoinsController);

// Menjalankan backtest menggunakan hasil optimasi
router.get(
  "/:symbol/backtest",
  authMiddleware,
  backtestWithOptimizedWeightsController,
);

// Menghentikan proses optimasi yang sedang berjalan
router.post("/:symbol/cancel", authMiddleware, cancelOptimizationController);

export default router;
