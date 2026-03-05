import axios from "axios";
import { prisma } from "../../lib/prisma.js";

/**
 * 📱 TELEGRAM NOTIFICATION SERVICE (MULTI-INDICATOR ONLY)
 * --------------------------------------------------------
 * Mengirim notifikasi trading signals ke Telegram
 * - Multi-user support: Broadcast ke semua user dengan telegramEnabled
 * - Anti-spam: Tidak mengirim notifikasi berulang untuk sinyal yang sama
 * - ONLY Multi-Indicator Signals (Single signals REMOVED)
 */

/* ==========================================================
   🔧 VALIDATION HELPER FUNCTIONS
========================================================== */

/**
 * Validate broadcast signal request parameters
 */
export function validateBroadcastSignalParams(params) {
  const { symbol, signal, price } = params;

  if (!symbol || !signal || !price) {
    throw new Error("symbol, signal, and price are required");
  }

  // Validate signal value
  const validSignals = ["buy", "sell", "neutral", "strong_buy", "strong_sell"];
  if (!validSignals.includes(signal.toLowerCase())) {
    throw new Error(
      `Invalid signal. Must be one of: ${validSignals.join(", ")}`
    );
  }

  // Validate price is a number
  if (typeof price !== "number" || isNaN(price) || price <= 0) {
    throw new Error("price must be a positive number");
  }

  return true;
}

/**
 * Build broadcast signal payload with defaults
 */
export function buildBroadcastSignalPayload(params) {
  const { symbol, signal, price, details = {} } = params;

  return {
    symbol: symbol.toUpperCase(),
    signal: signal.toLowerCase(),
    price,
    type: "multi", // Always multi
    details: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  };
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ENABLED =
  process.env.TELEGRAM_ENABLED === "true" ||
  process.env.TELEGRAM_ENABLED === true;

// Log configuration on startup
console.log(`📱 Telegram Configuration:`);
console.log(`   Enabled: ${TELEGRAM_ENABLED}`);
console.log(
  `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "✅ Configured" : "❌ Missing"}`
);
console.log(`   Mode: Multi-Indicator Only`);

// Cache untuk tracking sinyal terakhir (anti-spam)
const lastSignalCache = new Map();

/**
 * 📨 Kirim pesan ke Telegram (WAJIB dengan chatId)
 * @param {string} message - Pesan yang akan dikirim
 * @param {string} chatId - Telegram Chat ID tujuan (REQUIRED)
 * @param {object} options - Opsi tambahan
 */
async function sendTelegramMessage(message, chatId, options = {}) {
  // WAJIB: chatId harus ada, tidak ada fallback
  if (!chatId) {
    console.error("❌ Chat ID is required");
    return { success: false, reason: "no_chat_id" };
  }

  if (!TELEGRAM_ENABLED) {
    console.log("⚠️ Telegram notifications disabled (TELEGRAM_ENABLED=false)");
    return { success: false, reason: "disabled" };
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ Telegram bot token not configured");
    return { success: false, reason: "not_configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: options.parseMode || "Markdown",
      disable_web_page_preview: options.disablePreview !== false,
    });

    if (response.data.ok) {
      console.log(`✅ Telegram message sent to ${chatId}`);
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
 * 📊 HELPER: Interpret category scores to human-readable text
 */
function interpretTrendScore(score) {
  if (score >= 3) return "Very Strong Uptrend";
  if (score >= 1) return "Strong Uptrend";
  if (score >= 0.5) return "Moderate Uptrend";
  if (score > -0.5) return "Sideways";
  if (score > -1) return "Moderate Downtrend";
  if (score > -3) return "Strong Downtrend";
  return "Very Strong Downtrend";
}

function interpretMomentumScore(score) {
  if (score >= 4) return "Extreme Bullish Momentum";
  if (score >= 2) return "Strong Bullish Momentum";
  if (score >= 0.5) return "Moderate Bullish Momentum";
  if (score > -0.5) return "Neutral Momentum";
  if (score > -2) return "Moderate Bearish Momentum";
  if (score > -4) return "Strong Bearish Momentum";
  return "Extreme Bearish Momentum";
}

function interpretVolatilityScore(score) {
  if (score >= 2) return "High Volatility (Bullish)";
  if (score >= 0.5) return "Elevated Volatility (Bullish)";
  if (score > -0.5) return "Normal Volatility";
  if (score > -2) return "Elevated Volatility (Bearish)";
  return "High Volatility (Bearish)";
}

/**
 * 🎯 HELPER: Generate insight text based on category scores
 */
function generateInsight(categoryScores, signal) {
  const { trend, momentum, volatility } = categoryScores;

  // Determine dominant factors (absolute value > 1)
  const dominantFactors = [];

  if (Math.abs(trend) >= 1) {
    dominantFactors.push(trend > 0 ? "positive trend" : "negative trend");
  }

  if (Math.abs(momentum) >= 1) {
    dominantFactors.push(momentum > 0 ? "strong momentum" : "weak momentum");
  }

  if (Math.abs(volatility) >= 0.5) {
    dominantFactors.push(volatility > 0 ? "high volatility" : "low volatility");
  }

  // Build insight text
  const bias =
    signal === "buy" ? "Bullish" : signal === "sell" ? "Bearish" : "Neutral";

  if (dominantFactors.length === 0) {
    return `${bias} bias with mixed signals across indicators.`;
  }

  const factorsText = dominantFactors.join(" and ");
  return `${bias} bias supported mainly by ${factorsText}.`;
}

/**
 * 📨 FORMAT TELEGRAM SIGNAL MESSAGE
 * Formats trading signal data into structured, human-readable message
 */
function formatTelegramSignalMessage({
  symbol,
  signal,
  signalLabel,
  price,
  finalScore,
  strength,
  categoryScores = { trend: 0, momentum: 0, volatility: 0 },
  timeframe = "1h",
  performance,
}) {
  // Format price with currency
  const formatCurrency = (value) => {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Format date and time (MM/DD/YYYY, HH:MM)
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });

  // Format max drawdown safely
  const maxDrawdown =
    performance.maxDrawdown !== undefined &&
    performance.maxDrawdown !== null &&
    !isNaN(performance.maxDrawdown)
      ? performance.maxDrawdown.toFixed(2)
      : "0.00";

  // Generate insight
  const insight = generateInsight(categoryScores, signal);

  // Determine signal emoji (big circles like in the image)
  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";

  // Build structured message with icons
  const message = `${signalEmoji} *${signalLabel.toUpperCase()}* ${signalEmoji}

📊 *Symbol:* ${symbol}
💰 *Price:* ${formatCurrency(price)}
📈 *Score:* ${finalScore >= 0 ? "+" : ""}${finalScore.toFixed(2)}
💪 *Strength:* ${(strength * 100).toFixed(1)}%
⏱️ *Timeframe:* ${timeframe}
🕐 *Time:* ${dateStr}, ${timeStr}

📊 *Market Interpretation:*
• Trend: ${categoryScores.trend >= 0 ? "+" : ""}${categoryScores.trend.toFixed(2)} (${interpretTrendScore(categoryScores.trend)})
• Momentum: ${categoryScores.momentum >= 0 ? "+" : ""}${categoryScores.momentum.toFixed(2)} (${interpretMomentumScore(categoryScores.momentum)})
• Volatility: ${categoryScores.volatility >= 0 ? "+" : ""}${categoryScores.volatility.toFixed(2)} (${interpretVolatilityScore(categoryScores.volatility)})

📈 *Performance Metrics:*
• ROI: ${performance.roi.toFixed(2)}%
• Win Rate: ${performance.winRate.toFixed(2)}%
• Max Drawdown: ${maxDrawdown}%
• Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}
• Trades: ${performance.trades}

💡 *Insight:*
${insight}

⚠️ _Decision Support Only — Not Financial Advice_`;

  return message;
}

/**
 * 🔔 Kirim notifikasi sinyal multi-indicator ke semua user yang aktif
 * ✅ FULLY SCORE-BASED: No voting, no arbitrary threshold
 * ✅ Signal direction: score > 0 → BUY, score < 0 → SELL, score == 0 → NEUTRAL
 * ✅ STRONG label: strength >= 0.6
 */
export async function sendMultiIndicatorSignal({
  symbol,
  signal,
  price,
  strength = 0,
  finalScore = 0,
  signalLabel = null,
  signalEmoji = null,
  categoryScores = { trend: 0, momentum: 0, volatility: 0 },
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

  // ✅ Use provided label OR calculate them
  let displayLabel = signalLabel;

  if (!displayLabel) {
    if (signal === "buy") {
      displayLabel = strength >= 0.6 ? "Strong Buy" : "Buy";
    } else if (signal === "sell") {
      displayLabel = strength >= 0.6 ? "Strong Sell" : "Sell";
    } else {
      displayLabel = "Neutral";
    }
  }

  console.log("📱 Telegram Signal:", {
    symbol,
    signal,
    finalScore,
    strength,
    displayLabel,
    categoryScores,
  });

  // ✅ Format message using new structured layout
  const message = formatTelegramSignalMessage({
    symbol,
    signal,
    signalLabel: displayLabel,
    price,
    finalScore,
    strength,
    categoryScores,
    timeframe,
    performance,
  });

  // Broadcast ke semua user yang aktif
  try {
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
      return { success: false, reason: "no_users" };
    }

    console.log(`📤 Broadcasting to ${enabledUsers.length} users...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const user of enabledUsers) {
      const result = await sendTelegramMessage(
        message.trim(),
        user.telegramChatId
      );

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({
          userId: user.id,
          email: user.email,
          reason: result.reason,
        });
      }

      // Delay kecil untuk menghindari rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Multi-indicator signal broadcast: ${results.sent} sent, ${results.failed} failed`
    );

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: enabledUsers.length,
    };
  } catch (error) {
    console.error(
      "❌ Error broadcasting multi-indicator signal:",
      error.message
    );
    return { success: false, reason: "broadcast_error", error: error.message };
  }
}

/**
 * 📊 Kirim summary harian ke semua user
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

  return await broadcastTelegram(message.trim());
}

/**
 * ⚠️ Kirim notifikasi error/warning ke semua admin
 */
export async function sendErrorNotification(error, context = "") {
  const message = `
⚠️ *SYSTEM ERROR*

🔴 ${context}

Error: ${error.message}

🕐 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  return await broadcastTelegram(message.trim());
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
 * ✅ Test koneksi Telegram - broadcast ke semua user
 */
export async function testTelegramConnection() {
  const message = `
✅ *TELEGRAM CONNECTION TEST*

System: Crypto Trading Bot
Status: Connected
Mode: Multi-Indicator Only
Time: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  return await broadcastTelegram(message.trim());
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
 * 📣 Broadcast sinyal trading ke semua user (Multi-Indicator Only)
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
⏰ *Type:* Multi-Indicator
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
