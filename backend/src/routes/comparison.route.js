import express from "express";
import {
  compareIndicatorStrategies,
  getIndicatorsForSymbol,
  getSymbolComparisonHistory,
  quickComparison,
  getComparisonStats,
} from "../controllers/comparison.controller.js";

const router = express.Router();

// 🎯 Main comparison endpoint
router.post("/compare", compareIndicatorStrategies);

// 🚀 Quick comparison with presets
router.post("/quick", quickComparison);

// 📊 Get available indicators for a symbol
router.get("/indicators/:symbol", getIndicatorsForSymbol);

// 📈 Get comparison history for a symbol
router.get("/history/:symbol", getSymbolComparisonHistory);

// 📊 Get comparison statistics overview
router.get("/stats", getComparisonStats);

export default router;
