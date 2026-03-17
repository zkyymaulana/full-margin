import { prisma } from "../../lib/prisma.js";
import { getWatchersForCoin } from "../watchlist/watchlist.service.js";
import { formatTelegramSignalMessage } from "./telegram.message.js";
import {
  broadcastTelegram,
  sendTelegramMessage,
} from "./telegram.broadcast.js";

/**
 * File: telegram.service.js
 * -------------------------------------------------
 * Tujuan: Orchestrator utama notifikasi Telegram.
 * - Mengatur alur pengiriman sinyal (multi-indicator) ke user
 * - Mengelola anti-spam cache supaya sinyal yang sama tidak dikirim berulang
 * - Berinteraksi dengan database untuk mencari user yang eligible
 * - Memanggil modul broadcast untuk pengiriman ke Telegram API
 */

// Cache untuk tracking sinyal terakhir (anti-spam)
// Key yang dipakai: "<SYMBOL>_multi" (dipertahankan seperti sebelumnya)
const lastSignalCache = new Map();

/**
 * 🔔 Kirim notifikasi sinyal multi-indicator ke semua user yang aktif
 *
 * Tujuan:
 * - Membentuk pesan dari hasil deteksi sinyal
 * - Broadcast ke semua user yang telegramEnabled
 * - Menggunakan cache untuk anti-spam (skip jika sinyal sama dengan sebelumnya)
 *
 * Catatan penting:
 * - Algoritma dan format pesan tidak diubah.
 * - Query database dan delay tetap sama.
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

  // Jika sinyal sama persis dengan terakhir, maka skip kirim agar tidak spam
  if (lastSignal === signal) {
    console.log(`⏭️ Skipping duplicate signal: ${symbol} multi ${signal}`);
    return { success: false, reason: "duplicate" };
  }

  // Update cache (menyimpan sinyal terakhir untuk symbol tersebut)
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

  // Format message menggunakan modul message (format tidak berubah)
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

  // Broadcast ke semua user yang aktif (query tetap sama)
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
 * Kirim ringkasan harian ke semua user yang mengaktifkan Telegram.
 *
 * @param {Array<{symbol:string, signal:string, price:number}>} symbols
 * @returns {Promise<object>} Hasil broadcast.
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

  // Delegasi ke broadcast module
  return await broadcastTelegram(message.trim());
}

/**
 * Kirim notifikasi error/warning ke semua admin (menggunakan broadcast umum).
 *
 * @param {Error} error
 * @param {string} [context] - Informasi konteks error.
 * @returns {Promise<object>} Hasil broadcast.
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
 * Membersihkan cache sinyal (anti-spam).
 *
 * Cara kerja cache:
 * - Menyimpan sinyal terakhir per symbol dalam Map
 * - Jika sinyal sama muncul lagi, notifikasi akan di-skip
 *
 * @param {string|null} [symbol] - Jika diisi, hanya cache untuk symbol itu yang dibersihkan.
 * @returns {void}
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
 * Test koneksi Telegram dengan cara broadcast pesan test.
 *
 * @returns {Promise<object>} Hasil broadcast.
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
 * Mengirim sinyal ke user yang mem-watch koin tertentu.
 *
 * Alur:
 * 1) Ambil watchers via watchlist service
 * 2) Filter yang telegramEnabled & punya chatId
 * 3) Format pesan dengan formatter yang sama
 * 4) Kirim satu per satu dengan delay (anti rate limit)
 */
export async function sendSignalToWatchers({
  coinId,
  symbol,
  signal,
  price,
  strength = 0,
  finalScore = 0,
  signalLabel = null,
  categoryScores = { trend: 0, momentum: 0, volatility: 0 },
  performance = {
    roi: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    trades: 0,
  },
  timeframe = "1h",
}) {
  try {
    const watchers = await getWatchersForCoin(coinId);

    if (!watchers.length) {
      console.log(`📭 No watchers for coin ${symbol} (id: ${coinId})`);
      return { success: true, sent: 0, total: 0 };
    }

    const eligibleWatchers = watchers.filter(
      (w) => w.user.telegramEnabled && w.user.telegramChatId
    );

    if (!eligibleWatchers.length) {
      console.log(`📭 No Telegram-enabled watchers for coin ${symbol}`);
      return { success: true, sent: 0, total: watchers.length };
    }

    let displayLabel = signalLabel;
    if (!displayLabel) {
      if (signal === "buy")
        displayLabel = strength >= 0.6 ? "Strong Buy" : "Buy";
      else if (signal === "sell")
        displayLabel = strength >= 0.6 ? "Strong Sell" : "Sell";
      else displayLabel = "Neutral";
    }

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

    const results = { sent: 0, failed: 0, errors: [] };

    for (const watcher of eligibleWatchers) {
      const result = await sendTelegramMessage(
        message.trim(),
        watcher.user.telegramChatId
      );
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({
          userId: watcher.user.id,
          email: watcher.user.email,
          reason: result.reason,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Watchlist signal sent for ${symbol}: ${results.sent}/${eligibleWatchers.length} watchers notified`
    );

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: watchers.length,
      eligible: eligibleWatchers.length,
    };
  } catch (error) {
    console.error("❌ Error sending signal to watchers:", error.message);
    return { success: false, reason: "error", error: error.message };
  }
}

// Export sendTelegramMessage untuk kompatibilitas (tanpa ubah controller lama)
export { sendTelegramMessage };
