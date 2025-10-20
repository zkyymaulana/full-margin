import { Router } from "express";
import {
  getMultiIndicators,
  getMultiIndicatorGridSearch,
  getMultiIndicatorCustomWeights,
} from "../controllers/multiIndicator.controller.js";

const router = Router();

// ✅ Multi-Indicator Analysis Routes
router.get("/:symbol?", getMultiIndicators);

// 🎯 NEW: Grid Search Analysis Route (Sukma & Namahoot 2025)
router.get("/:symbol/grid-search", getMultiIndicatorGridSearch);

// 🎯 NEW: Custom Weights Analysis Route
router.post("/:symbol/custom-weights", getMultiIndicatorCustomWeights);

export default router;
