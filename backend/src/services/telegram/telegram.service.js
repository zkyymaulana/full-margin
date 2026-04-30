import { prisma } from "../../lib/prisma.js";
import { getWatchersForCoin } from "../watchlist/watchlist.service.js";
import { formatTelegramSignalMessage } from "./telegram.message.js";
import { sendTelegramMessage } from "./telegram.broadcast.js";

// file ini mengatur alur utama pengiriman notifikasi Telegram
// termasuk pengelolaan cache sinyal di database

// simpan atau update cache sinyal di database
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
    console.error(`Error updating signal cache:`, error.message);
  }
}

// hapus cache sinyal di database (per symbol atau semua)
export async function clearSignalCache(symbol = null) {
  try {
    if (symbol) {
      // hapus cache untuk symbol tertentu
      await prisma.signalCache.deleteMany({
        where: { symbol },
      });
      console.log(`Cleared database signal cache for ${symbol}`);
    } else {
      // hapus seluruh cache
      await prisma.signalCache.deleteMany();
      console.log("Cleared all database signal cache");
    }
  } catch (error) {
    console.error("Error clearing signal cache:", error.message);
  }
}

// Test koneksi Telegram untuk SATU user (bukan broadcast).
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

// kirim sinyal ke user yang memantau (watchlist) koin tertentu
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
    console.log(` [${symbol}] Sending watchlist signal: ${signal}`);

    // ambil semua user yang mem-watch koin ini
    const watchers = await getWatchersForCoin(coinId);

    if (!watchers.length) {
      console.log(`No watchers for coin ${symbol} (id: ${coinId})`);
      return { success: true, sent: 0, total: 0 };
    }

    // filter hanya user yang aktif telegram dan punya chatId
    const eligibleWatchers = watchers.filter(
      (w) => w.user.telegramEnabled && w.user.telegramChatId,
    );

    if (!eligibleWatchers.length) {
      console.log(`No Telegram-enabled watchers for coin ${symbol}`);
      return { success: true, sent: 0, total: watchers.length };
    }

    // tentukan label sinyal (fallback jika tidak ada)
    let displayLabel = signalLabel;
    if (!displayLabel) {
      if (signal === "buy")
        displayLabel = strength >= 0.6 ? "Strong Buy" : "Buy";
      else if (signal === "sell")
        displayLabel = strength >= 0.6 ? "Strong Sell" : "Sell";
      else displayLabel = "Neutral";
    }

    // format pesan telegram
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

    // kirim ke setiap watcher satu per satu
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

      // delay untuk hindari rate limit
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `Watchlist signal sent for ${symbol}: ${results.sent}/${eligibleWatchers.length} watchers notified`,
    );

    // update cache jika ada yang berhasil dikirim
    if (results.sent > 0) {
      await updateSignalCacheDB(symbol, "watchlist", signal);
    } else {
      console.warn(
        `[${symbol}] No successful watchlist sends, cache not updated`,
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
    console.error("Error sending signal to watchers:", error.message);
    return { success: false, reason: "error", error: error.message };
  }
}
