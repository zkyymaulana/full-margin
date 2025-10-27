import {
  testTelegramConnection,
  clearSignalCache,
} from "../services/telegram/telegram.service.js";
import {
  detectAndNotifySingleIndicatorSignals,
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
} from "../services/signals/signal-detection.service.js";

/**
 * 🧪 Test Telegram connection
 */
export async function testTelegramController(req, res) {
  try {
    const result = await testTelegramConnection();

    return res.json({
      success: result.success,
      message: result.success
        ? "Telegram test message sent successfully"
        : "Failed to send Telegram message",
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 🔍 Test single indicator signal detection
 */
export async function testSingleSignalController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    const result = await detectAndNotifySingleIndicatorSignals(symbol);

    return res.json({
      success: true,
      symbol,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 🎯 Test multi-indicator signal detection
 */
export async function testMultiSignalController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    const result = await detectAndNotifyMultiIndicatorSignals(symbol);

    return res.json({
      success: true,
      symbol,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 🔄 Test all symbols signal detection
 */
export async function testAllSignalsController(req, res) {
  try {
    const mode = req.query.mode || "multi"; // single, multi, both
    const symbols = req.body.symbols || ["BTC-USD", "ETH-USD"];

    const result = await detectAndNotifyAllSymbols(symbols, mode);

    return res.json({
      success: true,
      mode,
      symbols,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 🧹 Clear signal cache
 */
export async function clearCacheController(req, res) {
  try {
    const symbol = req.query.symbol;

    clearSignalCache(symbol);

    return res.json({
      success: true,
      message: symbol
        ? `Signal cache cleared for ${symbol}`
        : "All signal cache cleared",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * ⚙️ Get Telegram configuration status
 */
export async function getTelegramConfigController(req, res) {
  try {
    const config = {
      enabled: process.env.TELEGRAM_ENABLED === "true",
      configured: !!(
        process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
      ),
      signalMode: process.env.SIGNAL_MODE || "multi",
    };

    return res.json({
      success: true,
      config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 🔄 Toggle Telegram notifications (enable/disable)
 */
export async function toggleTelegramController(req, res) {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be a boolean value",
      });
    }

    // Update environment variable in memory
    process.env.TELEGRAM_ENABLED = enabled.toString();

    // Note: Untuk permanent changes, harus update .env file
    // Tapi untuk runtime toggle sudah cukup

    return res.json({
      success: true,
      message: `Telegram notifications ${enabled ? "enabled" : "disabled"}`,
      config: {
        enabled: process.env.TELEGRAM_ENABLED === "true",
        configured: !!(
          process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
        ),
        signalMode: process.env.SIGNAL_MODE || "multi",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * ⚙️ Update Telegram signal mode
 */
export async function updateSignalModeController(req, res) {
  try {
    const { mode } = req.body;

    const validModes = ["single", "multi", "both"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      });
    }

    // Update environment variable in memory
    process.env.SIGNAL_MODE = mode;

    return res.json({
      success: true,
      message: `Signal mode updated to: ${mode}`,
      config: {
        enabled: process.env.TELEGRAM_ENABLED === "true",
        configured: !!(
          process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
        ),
        signalMode: mode,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
