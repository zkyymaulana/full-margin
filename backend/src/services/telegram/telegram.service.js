import { prisma } from "../../lib/prisma.js";
import { getWatchersForCoin } from "../watchlist/watchlist.service.js";
import { formatTelegramSignalMessage } from "./telegram.message.js";
import { sendTelegramMessage } from "./telegram.broadcast.js";

/**
 * File: telegram.service.js
 * -------------------------------------------------
 * Tujuan: Orchestrator utama notifikasi Telegram.
 * - Mengatur alur pengiriman sinyal (multi-indicator) ke user
 * - Mengelola pengiriman notifikasi sinyal ke user yang eligible
 * - Berinteraksi dengan database untuk mencari user yang eligible
 * - Memanggil modul broadcast untuk pengiriman ke Telegram API
 *
 * ✅ PERSISTENT CACHE (Database):
 * - Cache disimpan di tabel SignalCache
 * - Survive server restart, deployment, scaling
 * - Production-ready untuk Render.com
 */

/**
 * 💾 Update signal cache in database
 */
async function updateSignalCacheDB(symbol, cacheType, signal) {
  try {
    await prisma.signalCache.upsert({
      where: {
        symbol_cacheType: { symbol, cacheType },
      },
      update: {
        lastSignal: signal,
      },
      create: {
        symbol,
        cacheType,
        lastSignal: signal,
      },
    });
  } catch (error) {
    console.error(`❌ Error updating signal cache:`, error.message);
  }
}

/**
 * Membersihkan cache sinyal dari DATABASE.
 *
 * Cara kerja cache:
 * - Menyimpan sinyal terakhir per symbol di tabel SignalCache
 * - Jika sinyal sama muncul lagi, notifikasi akan di-skip
 * - Persistent across server restarts
 *
 */
export async function clearSignalCache(symbol = null) {
  try {
    if (symbol) {
      // Delete cache for specific symbol (both watchlist & broadcast)
      await prisma.signalCache.deleteMany({
        where: { symbol },
      });
      console.log(`🧹 Cleared database signal cache for ${symbol}`);
    } else {
      // Delete all cache
      await prisma.signalCache.deleteMany();
      console.log("🧹 Cleared all database signal cache");
    }
  } catch (error) {
    console.error("❌ Error clearing signal cache:", error.message);
  }
}

/**
 * Test koneksi Telegram untuk SATU user (bukan broadcast).
 *
 */
export async function testTelegramConnectionForUser(userId) {
  if (!userId) {
    return {
      success: false,
      reason: "invalid_user",
      message: "User ID is required",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      telegramChatId: true,
      telegramEnabled: true,
    },
  });

  if (!user) {
    return {
      success: false,
      reason: "user_not_found",
      message: "User not found",
    };
  }

  if (!user.telegramChatId) {
    return {
      success: false,
      reason: "no_chat_id",
      message: "Telegram chat ID is not set for this user",
    };
  }

  if (!user.telegramEnabled) {
    return {
      success: false,
      reason: "telegram_disabled",
      message: "Telegram notifications are disabled for this user",
    };
  }

  const message = `
*CRYPTO ANALYZE CONNECTION TEST*

Name: ${user.name || user.email || `User ${user.id}`}
Status: Connected
Time: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`;

  const result = await sendTelegramMessage(message.trim(), user.telegramChatId);

  return {
    ...result,
    userId: user.id,
    chatId: user.telegramChatId,
  };
}

/**
 * Mengirim sinyal ke user yang mem-watch koin tertentu.
 *
 * Alur:
 * 1) Ambil watchers via watchlist service
 * 2) Filter yang telegramEnabled & punya chatId
 * 3) Format pesan dengan formatter yang sama
 * 4) Kirim satu per satu dengan delay (anti rate limit)
 *
 * 🎯 PENGIRIMAN SINYAL:
 * - Semua sinyal hasil deteksi dikirim ke watcher yang eligible
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
    console.log(`🔔 [${symbol}] Sending watchlist signal: ${signal}`);

    const watchers = await getWatchersForCoin(coinId);

    if (!watchers.length) {
      console.log(`📭 No watchers for coin ${symbol} (id: ${coinId})`);
      return { success: true, sent: 0, total: 0 };
    }

    const eligibleWatchers = watchers.filter(
      (w) => w.user.telegramEnabled && w.user.telegramChatId,
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
        watcher.user.telegramChatId,
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
      `✅ Watchlist signal sent for ${symbol}: ${results.sent}/${eligibleWatchers.length} watchers notified`,
    );

    if (results.sent > 0) {
      await updateSignalCacheDB(symbol, "watchlist", signal);
    } else {
      console.warn(
        `⚠️ [${symbol}] No successful watchlist sends, cache not updated`,
      );
    }

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
