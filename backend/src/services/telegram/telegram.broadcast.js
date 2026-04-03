/**
 * File: telegram.broadcast.js
 * -------------------------------------------------
 * Tujuan: Mengisolasi logika pengiriman pesan ke Telegram dan broadcast ke banyak user.
 * - Mengirim pesan via Telegram Bot API
 * - Loop broadcast ke banyak user dengan delay (anti rate-limit)
 *
 * Refactor ini hanya memindahkan kode (tanpa mengubah behavior/query/format pesan).
 */

import axios from "axios";
import { prisma } from "../../lib/prisma.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function isTelegramEnabled() {
  return (
    process.env.TELEGRAM_ENABLED === "true" ||
    process.env.TELEGRAM_ENABLED === true
  );
}

// Log konfigurasi (tetap sama, hanya pindah file)
console.log(`📱 Telegram Configuration:`);
console.log(`   Enabled: ${isTelegramEnabled()}`);
console.log(
  `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "✅ Configured" : "❌ Missing"}`,
);
console.log(`   Mode: Multi-Indicator Only`);

/**
 * Mengirim pesan ke Telegram (wajib menyertakan chatId).
 *
 * @param {string} message - Pesan yang akan dikirim.
 * @param {string} chatId - Telegram Chat ID tujuan (wajib).
 * @param {object} [options] - Opsi tambahan.
 * @param {string} [options.parseMode] - Default: "Markdown".
 * @param {boolean} [options.disablePreview] - Default: true (kecuali di-set false pada caller).
 * @returns {Promise<{success:boolean, messageId?:number, reason?:string, error?:any}>}
 */
export async function sendTelegramMessage(message, chatId, options = {}) {
  // WAJIB: chatId harus ada, tidak ada fallback
  if (!chatId) {
    console.error("❌ Chat ID is required");
    return { success: false, reason: "no_chat_id" };
  }

  if (!isTelegramEnabled()) {
    console.log("⚠️ Telegram notifications disabled (TELEGRAM_ENABLED=false)");
    return { success: false, reason: "disabled" };
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ Telegram bot token not configured");
    return { success: false, reason: "not_configured" };
  }

  try {
    // Call Telegram Bot API
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
 * Broadcast pesan ke semua user yang mengaktifkan notifikasi Telegram.
 *
 * Cara kerja:
 * 1) Query user yang telegramEnabled=true dan telegramChatId != null
 * 2) Kirim pesan satu per satu
 * 3) Tambah delay kecil untuk menghindari rate limiting dari Telegram
 *
 * @param {string} message - Pesan broadcast.
 * @param {object} [options] - Opsi yang diteruskan ke sendTelegramMessage.
 * @returns {Promise<object>} Hasil broadcast (jumlah sent/failed/total/errors).
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
          options,
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

        // Delay kecil untuk menghindari rate limiting (Telegram punya limit request per detik)
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
      `✅ Broadcast completed: ${results.sent} sent, ${results.failed} failed`,
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
 * Broadcast sinyal trading ke semua user (Multi-Indicator Only).
 *
 * @param {object} params
 * @param {string} params.symbol
 * @param {string} params.signal
 * @param {number} params.price
 * @param {string} [params.type] - Default: "multi" (dipertahankan)
 * @param {object} [params.details]
 * @returns {Promise<object>} Hasil broadcast.
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
