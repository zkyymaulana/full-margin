import express from "express";
import {
  analyzeSymbol,
  analyzeBatch,
} from "../controllers/analysis.controller.js";

const router = express.Router();

// Single symbol analysis
router.get("/:symbol", analyzeSymbol);

// Batch analysis for multiple symbols
router.post("/batch", analyzeBatch);

export default router;
