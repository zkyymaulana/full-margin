import axios from "axios";
import { prisma } from "../../lib/prisma.js";

/**
 * 📱 TELEGRAM NOTIFICATION SERVICE
 * --------------------------------
 * Mengirim notifikasi trading signals ke Telegram
 * - Anti-spam: Tidak mengirim notifikasi berulang untuk sinyal yang sama
 * - Support single & multi-indicator signals
 * - Format pesan yang informatif dan rapi
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// Fix: Parse boolean properly - check for string "true" or any truthy value
const TELEGRAM_ENABLED =
  process.env.TELEGRAM_ENABLED === "true" ||
  process.env.TELEGRAM_ENABLED === true;

// Log configuration on startup
console.log(`📱 Telegram Configuration:`);
console.log(`   Enabled: ${TELEGRAM_ENABLED}`);
console.log(
  `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "✅ Configured" : "❌ Missing"}`
);
console.log(`   Chat ID: ${TELEGRAM_CHAT_ID ? "✅ Configured" : "❌ Missing"}`);

// Cache untuk tracking sinyal terakhir (anti-spam)
const lastSignalCache = new Map();

/**
 * 📨 Kirim pesan ke Telegram (support dynamic chat ID)
 * @param {string} message - Pesan yang akan dikirim
 * @param {string} chatId - Telegram Chat ID tujuan
 */
async function sendTelegramMessage(message, chatId = null, options = {}) {
  // Jika chatId tidak diberikan, gunakan default dari env (backward compatibility)
  const targetChatId = chatId || TELEGRAM_CHAT_ID;

  if (!TELEGRAM_ENABLED) {
    console.log("⚠️ Telegram notifications disabled (TELEGRAM_ENABLED=false)");
    return { success: false, reason: "disabled" };
  }

  if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
    console.error("❌ Telegram credentials not configured");
    console.error(
      `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "Present" : "Missing"}`
    );
    console.error(`   Chat ID: ${targetChatId ? "Present" : "Missing"}`);
    return { success: false, reason: "not_configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: targetChatId,
      text: message,
      parse_mode: options.parseMode || "Markdown",
      disable_web_page_preview: options.disablePreview !== false,
    });

    if (response.data.ok) {
      console.log(`✅ Telegram message sent to ${targetChatId}`);
      return { success: true, messageId: response.data.result.message_id };
    }

    console.error("❌ Telegram API returned error:", response.data);
    return { success: false, reason: "api_error", error: response.data };
  } catch (error) {
    console.error("❌ Failed to send Telegram message:", error.message);
    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error("   Response data:", error.response.data);
    }
    return { success: false, reason: "network_error", error: error.message };
  }
}

/**
 * 🔔 Kirim notifikasi sinyal single indicator
 */
export async function sendSingleIndicatorSignal({
  symbol,
  indicator,
  signal,
  price,
  indicatorValue,
  timeframe = "1h",
}) {
  // Check cache untuk anti-spam
  const cacheKey = `${symbol}_${indicator}_single`;
  const lastSignal = lastSignalCache.get(cacheKey);

  if (lastSignal === signal) {
    console.log(
      `⏭️ Skipping duplicate signal: ${symbol} ${indicator} ${signal}`
    );
    return { success: false, reason: "duplicate" };
  }

  // Update cache
  lastSignalCache.set(cacheKey, signal);

  // Format sinyal emoji
  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";
  const signalText = signal.toUpperCase();

  // Build message
  const message = `
${signalEmoji} *${signalText} SIGNAL* ${signalEmoji}

📊 *Symbol:* ${symbol}
📈 *Indicator:* ${indicator}
💰 *Price:* $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
📉 *Value:* ${indicatorValue?.toFixed(2) || "N/A"}
⏰ *Timeframe:* ${timeframe}
🕐 *Time:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}

_Single Indicator Strategy_
`;

  return await sendTelegramMessage(message.trim());
}

/**
 * 🔔 Kirim notifikasi sinyal multi-indicator (REFACTORED V2)
 * ✅ Hapus Active Indicators & Weights
 * ✅ Perbaiki Max Drawdown
 * ✅ Tambahkan STRONG BUY/STRONG SELL berdasarkan strength threshold
 */
export async function sendMultiIndicatorSignal({
  symbol,
  signal,
  price,
  strength = 0, // ✅ Terima strength dari caller
  activeIndicators,
  performance,
  timeframe = "1h",
}) {
  // Check cache untuk anti-spam
  const cacheKey = `${symbol}_multi`;
  const lastSignal = lastSignalCache.get(cacheKey);

  if (lastSignal === signal) {
    console.log(`⏭️ Skipping duplicate signal: ${symbol} multi ${signal}`);
    return { success: false, reason: "duplicate" };
  }

  // Update cache
  lastSignalCache.set(cacheKey, signal);

  // ✅ VALIDATION: Jika neutral, strength harus 0
  if (signal === "neutral" && strength !== 0) {
    console.warn(
      `⚠️ [Telegram] MISMATCH: neutral with strength ${strength} → forcing to 0`
    );
    strength = 0;
  }

  // ✅ Determine signal label dengan threshold
  // strength < 0.5 → "BUY" / "SELL"
  // strength >= 0.5 → "STRONG BUY" / "STRONG SELL"
  let signalLabel = signal.toUpperCase();
  let signalEmoji = "⚪";

  if (signal === "buy") {
    signalLabel = strength >= 0.5 ? "STRONG BUY" : "BUY";
    signalEmoji = strength >= 0.5 ? "🟢🟢" : "🟢";
  } else if (signal === "sell") {
    signalLabel = strength >= 0.5 ? "STRONG SELL" : "SELL";
    signalEmoji = strength >= 0.5 ? "🔴🔴" : "🔴";
  }

  // Format price dengan USD currency
  const formatCurrency = (value) => {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Format tanggal dan waktu (dd/mm/yyyy, HH:MM)
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });

  // ✅ Fix Max Drawdown: Jika undefined/null, set ke 0 atau ambil dari performance
  const maxDrawdown =
    performance.maxDrawdown !== undefined &&
    performance.maxDrawdown !== null &&
    !isNaN(performance.maxDrawdown)
      ? performance.maxDrawdown.toFixed(2)
      : "0.00";

  // ✅ Build message TANPA Active Indicators & Weights
  const message = `
${signalEmoji} *${signalLabel} SIGNAL* ${signalEmoji}

📊 *Symbol:* ${symbol}
💰 *Price:* ${formatCurrency(price)}
💪 *Signal Strength:* ${(strength * 100).toFixed(1)}%
⏱ *Timeframe:* ${timeframe}
🕒 *Time:* ${dateStr}, ${timeStr}

📈 *Performance Metrics:*
• ROI : ${performance.roi.toFixed(2)}%
• Win Rate : ${performance.winRate.toFixed(2)}%
• Max Drawdown : ${maxDrawdown}%
• Sharpe Ratio : ${performance.sharpe}
• Trades : ${performance.trades}

_Multi-Indicator Optimized Strategy (Backtested)_
`;

  return await sendTelegramMessage(message.trim());
}

/**
 * 📊 Kirim summary harian
 */
export async function sendDailySummary(symbols) {
  const summaryLines = symbols.map(
    (s) =>
      `• ${s.symbol}: ${s.signal === "buy" ? "🟢" : s.signal === "sell" ? "🔴" : "⚪"} ${s.signal.toUpperCase()} at $${s.price}`
  );

  const message = `
📊 *DAILY TRADING SUMMARY*

${summaryLines.join("\n")}

🕐 ${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  return await sendTelegramMessage(message.trim());
}

/**
 * ⚠️ Kirim notifikasi error/warning
 */
export async function sendErrorNotification(error, context = "") {
  const message = `
⚠️ *SYSTEM ERROR*

🔴 ${context}

Error: ${error.message}

🕐 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  return await sendTelegramMessage(message.trim());
}

/**
 * 🧹 Clear signal cache (untuk reset)
 */
export function clearSignalCache(symbol = null) {
  if (symbol) {
    for (const key of lastSignalCache.keys()) {
      if (key.startsWith(symbol)) {
        lastSignalCache.delete(key);
      }
    }
    console.log(`🧹 Cleared signal cache for ${symbol}`);
  } else {
    lastSignalCache.clear();
    console.log("🧹 Cleared all signal cache");
  }
}

/**
 * ✅ Test koneksi Telegram
 */
export async function testTelegramConnection() {
  const message = `
✅ *TELEGRAM CONNECTION TEST*

System: Crypto Trading Bot
Status: Connected
Time: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  return await sendTelegramMessage(message.trim());
}

/**
 * 📣 Broadcast pesan ke semua user yang mengaktifkan notifikasi Telegram
 * @param {string} message - Pesan yang akan dikirim
 * @param {object} options - Opsi pengiriman pesan
 * @returns {object} - Hasil broadcast
 */
export async function broadcastTelegram(message, options = {}) {
  try {
    console.log("📣 Broadcasting Telegram message to all enabled users...");

    // Ambil semua user yang mengaktifkan notifikasi Telegram
    const enabledUsers = await prisma.user.findMany({
      where: {
        telegramEnabled: true,
        telegramChatId: { not: null },
      },
      select: {
        id: true,
        email: true,
        telegramChatId: true,
      },
    });

    if (enabledUsers.length === 0) {
      console.log("⚠️ No users with Telegram enabled");
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: "No users to notify",
      };
    }

    console.log(`📤 Sending to ${enabledUsers.length} users...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Kirim pesan ke setiap user
    for (const user of enabledUsers) {
      try {
        const result = await sendTelegramMessage(
          message,
          user.telegramChatId,
          options
        );

        if (result.success) {
          results.sent++;
          console.log(`  ✅ Sent to ${user.email} (${user.telegramChatId})`);
        } else {
          results.failed++;
          results.errors.push({
            userId: user.id,
            email: user.email,
            reason: result.reason,
          });
          console.log(`  ❌ Failed to send to ${user.email}: ${result.reason}`);
        }

        // Delay kecil untuk menghindari rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: user.id,
          email: user.email,
          error: error.message,
        });
        console.error(`  ❌ Error sending to ${user.email}:`, error.message);
      }
    }

    console.log(
      `✅ Broadcast completed: ${results.sent} sent, ${results.failed} failed`
    );

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: enabledUsers.length,
      errors: results.errors,
    };
  } catch (error) {
    console.error("❌ Broadcast error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 📣 Broadcast sinyal trading ke semua user
 */
export async function broadcastTradingSignal({
  symbol,
  signal,
  price,
  type = "multi",
  details = {},
}) {
  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";
  const signalText = signal.toUpperCase();

  let message = `
${signalEmoji} *${signalText} SIGNAL* ${signalEmoji}

📊 *Symbol:* ${symbol}
💰 *Price:* $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⏰ *Type:* ${type === "multi" ? "Multi-Indicator" : "Single-Indicator"}
🕐 *Time:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  if (details.indicators) {
    message += `\n🎯 *Active Indicators:*\n${details.indicators}`;
  }

  if (details.performance) {
    message += `\n\n📈 *Performance:*\n${details.performance}`;
  }

  return await broadcastTelegram(message.trim());
}

// Export sendTelegramMessage for backward compatibility
export { sendTelegramMessage };
