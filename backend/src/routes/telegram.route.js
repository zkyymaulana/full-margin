import express from "express";
import {
  testTelegramController,
  testTelegramLatencyController,
  testMultiSignalController,
  testAllSignalsController,
  getTelegramConfigController,
  toggleTelegramController,
} from "../controllers/index.js";

const router = express.Router();

// Get Telegram configuration status (public)
router.get("/config", getTelegramConfigController);

// Toggle Telegram on/off (public - untuk frontend)
router.post("/toggle", toggleTelegramController);

// Test Telegram connection
router.get("/test", testTelegramController);

// Test Telegram latency
router.get("/test-latency", testTelegramLatencyController);

// Test multi-indicator signal detection (manual testing only)
router.get("/test-multi/:symbol", testMultiSignalController);

// Test all symbols signal detection (manual testing only)
router.post("/test-all", testAllSignalsController);

export default router;
