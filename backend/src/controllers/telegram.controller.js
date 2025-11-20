import {
  testTelegramConnection,
  clearSignalCache,
  broadcastTelegram,
  broadcastTradingSignal,
} from "../services/telegram/telegram.service.js";
import {
  detectAndNotifySingleIndicatorSignals,
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
} from "../services/signals/signal-detection.service.js";
import { prisma } from "../lib/prisma.js";
import axios from "axios";

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

/**
 * 🤖 Telegram Webhook untuk auto-register chat ID
 * POST /api/telegram/webhook
 */
export async function telegramWebhookController(req, res) {
  try {
    const update = req.body;

    // Log incoming webhook
    console.log(
      "📥 Telegram webhook received:",
      JSON.stringify(update, null, 2)
    );

    // Extract message
    const message = update.message;
    if (!message) {
      return res.json({ success: true, message: "No message in update" });
    }

    const chatId = message.chat.id.toString();
    const text = message.text;
    const from = message.from;

    console.log(`📨 Message from ${from.first_name} (${chatId}): ${text}`);

    // Handle /start command
    if (text === "/start") {
      // Send welcome message
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const welcomeMessage = `
👋 *Welcome to Crypto Trading Bot!*

Your Chat ID: \`${chatId}\`

To enable notifications:
1. Copy your Chat ID above
2. Go to your profile settings
3. Paste the Chat ID and enable notifications

You'll start receiving trading signals automatically! 📊
`;

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: welcomeMessage.trim(),
          parse_mode: "Markdown",
        }
      );

      console.log(`✅ Sent welcome message to ${chatId}`);
    }

    // Handle /connect command with user ID
    else if (text.startsWith("/connect ")) {
      const userId = parseInt(text.split(" ")[1]);

      if (!userId || isNaN(userId)) {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: "❌ Invalid user ID. Use: /connect <userId>",
          }
        );
        return res.json({ success: true });
      }

      // Update user with chat ID
      try {
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            telegramChatId: chatId,
            telegramEnabled: true,
          },
        });

        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: `✅ *Telegram Connected!*\n\nAccount: ${user.email}\nNotifications: Enabled\n\nYou'll now receive trading signals! 📊`,
            parse_mode: "Markdown",
          }
        );

        console.log(`✅ Connected Telegram for user ${userId} (${user.email})`);
      } catch (error) {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: `❌ Error: ${error.message}`,
          }
        );
      }
    }

    // Handle /status command
    else if (text === "/status") {
      const user = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
      });

      if (user) {
        const statusMessage = `
📊 *Your Status*

Email: ${user.email}
Notifications: ${user.telegramEnabled ? "✅ Enabled" : "❌ Disabled"}
Chat ID: \`${chatId}\`
`;
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: statusMessage.trim(),
            parse_mode: "Markdown",
          }
        );
      } else {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: "❌ No account connected. Use /start to get your Chat ID.",
          }
        );
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 📣 Test broadcast ke semua user
 * POST /api/telegram/broadcast
 */
export async function broadcastController(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const result = await broadcastTelegram(message);

    return res.json({
      success: true,
      message: "Broadcast completed",
      result,
    });
  } catch (error) {
    console.error("❌ Broadcast error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * 📊 Test broadcast trading signal
 * POST /api/telegram/broadcast-signal
 */
export async function broadcastSignalController(req, res) {
  try {
    const { symbol, signal, price, type, details } = req.body;

    if (!symbol || !signal || !price) {
      return res.status(400).json({
        success: false,
        message: "symbol, signal, and price are required",
      });
    }

    const result = await broadcastTradingSignal({
      symbol,
      signal,
      price,
      type: type || "multi",
      details: details || {},
    });

    return res.json({
      success: true,
      message: "Trading signal broadcast completed",
      result,
    });
  } catch (error) {
    console.error("❌ Broadcast signal error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
