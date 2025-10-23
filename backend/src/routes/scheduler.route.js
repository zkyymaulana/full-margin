import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  startSchedulers,
  stopSchedulers,
  getStatus,
  backfillSignals,
} from "../controllers/scheduler.controller.js";

const router = express.Router();

// Get scheduler status (public for monitoring)
router.get("/status", getStatus);

// Protected routes (require authentication)
router.post("/start", authMiddleware, startSchedulers);
router.post("/stop", authMiddleware, stopSchedulers);

// Backfill signals routes
router.post("/backfill/signals", authMiddleware, backfillSignals); // Backfill all symbols
router.post("/backfill/signals/:symbol", authMiddleware, backfillSignals); // Backfill specific symbol

export default router;
