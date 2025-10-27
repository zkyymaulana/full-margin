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
 * 📨 Kirim pesan ke Telegram
 */
async function sendTelegramMessage(message, options = {}) {
  if (!TELEGRAM_ENABLED) {
    console.log("⚠️ Telegram notifications disabled (TELEGRAM_ENABLED=false)");
    return { success: false, reason: "disabled" };
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ Telegram credentials not configured");
    console.error(
      `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "Present" : "Missing"}`
    );
    console.error(`   Chat ID: ${TELEGRAM_CHAT_ID ? "Present" : "Missing"}`);
    return { success: false, reason: "not_configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: options.parseMode || "Markdown",
      disable_web_page_preview: options.disablePreview !== false,
    });

    if (response.data.ok) {
      console.log("✅ Telegram message sent successfully");
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
 * 🔔 Kirim notifikasi sinyal multi-indicator
 */
export async function sendMultiIndicatorSignal({
  symbol,
  signal,
  price,
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

  // Format sinyal emoji
  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";
  const signalText = signal.toUpperCase();

  // Format active indicators
  const indicatorsList = activeIndicators
    .map(({ name, weight }) => `  • ${name}: ${weight}`)
    .join("\n");

  // Build message
  const message = `
${signalEmoji} *${signalText} SIGNAL* ${signalEmoji}

📊 *Symbol:* ${symbol}
💰 *Price:* $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⏰ *Timeframe:* ${timeframe}
🕐 *Time:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}

🎯 *Active Indicators:*
${indicatorsList}

📈 *Performance:*
  • ROI: ${performance.roi}%
  • Win Rate: ${performance.winRate}%
  • Sharpe: ${performance.sharpe}
  • Trades: ${performance.trades}

_Multi-Indicator Optimized Strategy_
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

export { sendTelegramMessage };
