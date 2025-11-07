import express from "express";
import {
  getIndicators,
  calculateIndicators,
} from "../controllers/indicator.controller.js";

const router = express.Router();

// Get indicators symbol
router.get("/:symbol?", getIndicators);

// Manual calculate/recalculate indicators
router.post("/calculate/:symbol?", calculateIndicators);

export default router;
