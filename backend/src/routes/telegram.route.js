import express from "express";
import {
  testTelegramController,
  testSingleSignalController,
  testMultiSignalController,
  testAllSignalsController,
  clearCacheController,
  getTelegramConfigController,
  toggleTelegramController,
  updateSignalModeController,
  telegramWebhookController,
  broadcastController,
  broadcastSignalController,
} from "../controllers/telegram.controller.js";

const router = express.Router();

/**
 * 📱 TELEGRAM NOTIFICATION ROUTES
 * -------------------------------
 * Testing dan management notifikasi Telegram
 */

// 🤖 Webhook untuk Telegram Bot (NO AUTH - webhook dari Telegram)
router.post("/webhook", telegramWebhookController);

// 📣 Broadcast endpoints
router.post("/broadcast", broadcastController);
router.post("/broadcast-signal", broadcastSignalController);

// Get Telegram configuration status (public)
router.get("/config", getTelegramConfigController);

// Toggle Telegram on/off (public - untuk frontend)
router.post("/toggle", toggleTelegramController);

// Update signal mode (public - untuk frontend)
router.post("/signal-mode", updateSignalModeController);

// Test Telegram connection
router.get("/test", testTelegramController);

// Test single indicator signal detection (manual testing only)
router.get("/test-single/:symbol", testSingleSignalController);

// Test multi-indicator signal detection (manual testing only)
router.get("/test-multi/:symbol", testMultiSignalController);

// Test all symbols signal detection (manual testing only)
router.post("/test-all", testAllSignalsController);

// Clear signal cache
router.delete("/cache", clearCacheController);

export default router;
