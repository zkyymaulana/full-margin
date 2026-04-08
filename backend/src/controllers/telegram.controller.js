import {
  testTelegramConnection,
  clearSignalCache,
  broadcastTelegram,
} from "../services/telegram/index.js";
import {
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
} from "../services/signals/signal-detection.service.js";
import { prisma } from "../lib/prisma.js";
import axios from "axios";

// Menguji koneksi bot Telegram dan memastikan bot bisa mengirim pesan.
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

// Menjalankan test deteksi multi-indikator untuk satu simbol.
export async function testMultiSignalController(req, res) {
  try {
    // Gunakan symbol dari params, fallback ke BTC-USD jika tidak ada.
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

// Menjalankan test deteksi sinyal untuk banyak simbol sekaligus.
export async function testAllSignalsController(req, res) {
  try {
    // Ambil simbol dari request, atau fallback ke database jika kosong.
    let symbols = req.body.symbols;

    if (!symbols || symbols.length === 0) {
      // Jika tidak ada simbol di request, ambil top coin dari database.
      const coins = await prisma.coin.findMany({
        where: {
          rank: { not: null },
          symbol: { contains: "-" },
        },
        orderBy: { rank: "asc" },
        select: { symbol: true },
        take: 20,
      });

      symbols = coins.map((c) => c.symbol).filter(Boolean);

      if (symbols.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No symbols found in database. Please sync data first.",
        });
      }
    }

    // Mode deteksi dipaksa ke multi sesuai flow aplikasi.
    const result = await detectAndNotifyAllSymbols(symbols, "multi");

    return res.json({
      success: true,
      mode: "multi",
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

// Menghapus cache sinyal untuk satu simbol atau semua simbol.
export async function clearCacheController(req, res) {
  try {
    // Jika symbol kosong, cache semua simbol akan dihapus.
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

// Mengambil status konfigurasi Telegram pada server.
export async function getTelegramConfigController(req, res) {
  try {
    const config = {
      enabled: process.env.TELEGRAM_ENABLED === "true",
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      signalMode: "multi", // Fixed to multi only
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

// Mengaktifkan atau menonaktifkan notifikasi Telegram.
export async function toggleTelegramController(req, res) {
  try {
    // Body request hanya menerima field boolean `enabled`.
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be a boolean value",
      });
    }

    // Simpan status enabled di environment runtime.
    process.env.TELEGRAM_ENABLED = enabled.toString();

    return res.json({
      success: true,
      message: `Telegram notifications ${enabled ? "enabled" : "disabled"}`,
      config: {
        enabled: process.env.TELEGRAM_ENABLED === "true",
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
        signalMode: "multi",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Menangani webhook Telegram untuk perintah /start, /connect, dan /status.
export async function telegramWebhookController(req, res) {
  try {
    // Payload webhook dari Telegram dikirim ke body request.
    const update = req.body;

    // Simpan log payload webhook untuk debugging.
    console.log(
      "📥 Telegram webhook received:",
      JSON.stringify(update, null, 2),
    );

    // Ambil message dari payload update.
    const message = update.message;
    if (!message) {
      return res.json({ success: true, message: "No message in update" });
    }

    const chatId = message.chat.id.toString();
    const text = message.text;
    const from = message.from;

    console.log(`📨 Message from ${from.first_name} (${chatId}): ${text}`);

    // Tangani perintah /start.
    if (text === "/start") {
      // Kirim panduan awal agar user tahu langkah menghubungkan akun.
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const welcomeMessage = `
👋 *Welcome to Crypto Trading Bot!*

Your Chat ID: \`${chatId}\`

To enable notifications:
1. Copy your Chat ID above
2. Go to your profile settings
3. Paste the Chat ID and enable notifications

You'll start receiving *Multi-Indicator* trading signals automatically! 📊
`;

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: welcomeMessage.trim(),
          parse_mode: "Markdown",
        },
      );

      console.log(`✅ Sent welcome message to ${chatId}`);
    }

    // Tangani perintah /connect untuk mengaitkan chatId ke user.
    else if (text.startsWith("/connect ")) {
      // Format expected: /connect <userId>
      const userId = parseInt(text.split(" ")[1]);

      if (!userId || isNaN(userId)) {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: "❌ Invalid user ID. Use: /connect <userId>",
          },
        );
        return res.json({ success: true });
      }

      // Update akun user dengan chatId Telegram.
      try {
        // Simpan chatId agar user bisa menerima sinyal Telegram.
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
            text: `✅ *Telegram Connected!*\n\nAccount: ${user.email}\nNotifications: Enabled\nSignal Mode: Multi-Indicator\n\nYou'll now receive trading signals! 📊`,
            parse_mode: "Markdown",
          },
        );

        console.log(`✅ Connected Telegram for user ${userId} (${user.email})`);
      } catch (error) {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: `❌ Error: ${error.message}`,
          },
        );
      }
    }

    // Tangani perintah /status untuk cek status akun Telegram user.
    else if (text === "/status") {
      // Cek apakah chatId ini sudah terhubung dengan user aplikasi.
      const user = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
      });

      if (user) {
        const statusMessage = `
📊 *Your Status*

Email: ${user.email}
Notifications: ${user.telegramEnabled ? "✅ Enabled" : "❌ Disabled"}
Signal Mode: Multi-Indicator
Chat ID: \`${chatId}\`
`;
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: statusMessage.trim(),
            parse_mode: "Markdown",
          },
        );
      } else {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: chatId,
            text: "❌ No account connected. Use /start to get your Chat ID.",
          },
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

// Kirim pesan broadcast Telegram ke semua user yang terhubung.
export async function broadcastController(req, res) {
  try {
    // Ambil pesan broadcast dari body request.
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
