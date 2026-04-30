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
console.log(`Telegram Configuration:`);
console.log(`Enabled: ${isTelegramEnabled()}`);
console.log(
  `   Bot Token: ${TELEGRAM_BOT_TOKEN ? "✅ Configured" : "❌ Missing"}`,
);
console.log(`   Mode: Multi-Indicator Only`);

// kirim pesan ke Telegram menggunakan Bot API
export async function sendTelegramMessage(message, chatId, options = {}) {
  // chatId wajib ada
  if (!chatId) {
    console.error("Chat ID is required");
    return { success: false, reason: "no_chat_id" };
  }

  // cek apakah fitur telegram aktif
  if (!isTelegramEnabled()) {
    console.log("Telegram notifications disabled (TELEGRAM_ENABLED=false)");
    return { success: false, reason: "disabled" };
  }

  // cek token bot tersedia
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("Telegram bot token not configured");
    return { success: false, reason: "not_configured" };
  }

  try {
    // endpoint Telegram Bot API
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    // kirim request ke Telegram
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: options.parseMode || "Markdown",
      disable_web_page_preview: options.disablePreview !== false,
    });

    // jika berhasil
    if (response.data.ok) {
      console.log(`Telegram message sent to ${chatId}`);
      return { success: true, messageId: response.data.result.message_id };
    }

    // jika API mengembalikan error
    console.error("Telegram API returned error:", response.data);
    return { success: false, reason: "api_error", error: response.data };
  } catch (error) {
    // jika terjadi error network / request
    console.error("Failed to send Telegram message:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    return { success: false, reason: "network_error", error: error.message };
  }
}

// kirim pesan ke semua user yang mengaktifkan notifikasi Telegram
export async function broadcastTelegram(message, options = {}) {
  try {
    console.log("Broadcasting Telegram message to all enabled users...");

    // ambil user dengan telegram aktif dan punya chatId
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

    // jika tidak ada user
    if (enabledUsers.length === 0) {
      console.log("No users with Telegram enabled");
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: "No users to notify",
      };
    }

    console.log(`Sending to ${enabledUsers.length} users...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    // kirim pesan ke setiap user satu per satu
    for (const user of enabledUsers) {
      try {
        const result = await sendTelegramMessage(
          message,
          user.telegramChatId,
          options,
        );

        if (result.success) {
          results.sent++;
          console.log(`  Sent to ${user.email} (${user.telegramChatId})`);
        } else {
          results.failed++;
          results.errors.push({
            userId: user.id,
            email: user.email,
            reason: result.reason,
          });
          console.log(`  Failed to send to ${user.email}: ${result.reason}`);
        }

        // delay kecil untuk menghindari rate limit Telegram
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: user.id,
          email: user.email,
          error: error.message,
        });
        console.error(`  Error sending to ${user.email}:`, error.message);
      }
    }

    console.log(
      `Broadcast completed: ${results.sent} sent, ${results.failed} failed`,
    );

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: enabledUsers.length,
      errors: results.errors,
    };
  } catch (error) {
    console.error("Broadcast error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
