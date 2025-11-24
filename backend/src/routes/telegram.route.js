import express from "express";
import {
  testTelegramController,
  testMultiSignalController,
  testAllSignalsController,
  clearCacheController,
  getTelegramConfigController,
  toggleTelegramController,
  telegramWebhookController,
  broadcastController,
  broadcastSignalController,
} from "../controllers/telegram.controller.js";

const router = express.Router();

/**
 * 📱 TELEGRAM NOTIFICATION ROUTES (MULTI-INDICATOR ONLY)
 * -------------------------------------------------------
 * Testing dan management notifikasi Telegram
 * Single indicator endpoints REMOVED
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

// Test Telegram connection
router.get("/test", testTelegramController);

// Test multi-indicator signal detection (manual testing only)
router.get("/test-multi/:symbol", testMultiSignalController);

// Test all symbols signal detection (manual testing only)
router.post("/test-all", testAllSignalsController);

// Clear signal cache
router.delete("/cache", clearCacheController);

export default router;
