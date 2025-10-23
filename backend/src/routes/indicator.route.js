import express from "express";
import {
  getIndicators,
  calculateIndicators,
  getSignalSummary,
} from "../controllers/indicator.controller.js";

const router = express.Router();

// Get indicators for a symbol
router.get("/:symbol?", getIndicators);

// Force calculate/recalculate indicators
router.post("/calculate/:symbol?", calculateIndicators);

// Get signal summary for quick analysis
router.get("/signals/:symbol?", getSignalSummary);

export default router;
