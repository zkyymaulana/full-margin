import { testTelegramConnectionForUser } from "../services/telegram/index.js";
import {
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
} from "../services/signals/signal-detection.service.js";
import { prisma } from "../lib/prisma.js";

// Menguji koneksi bot Telegram dan memastikan bot bisa mengirim pesan.
export async function testTelegramController(req, res) {
  try {
    const authUserId = Number(req.user?.id);

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await testTelegramConnectionForUser(authUserId);

    if (!result.success) {
      const badRequestReasons = new Set([
        "invalid_user",
        "no_chat_id",
        "telegram_disabled",
        "disabled",
      ]);
      const statusCode = badRequestReasons.has(result.reason) ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: result.message || "Failed to send Telegram message",
        result,
      });
    }

    return res.json({
      success: result.success,
      message: "Telegram test message sent successfully",
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

// Mengambil status konfigurasi Telegram pada server.
export async function getTelegramConfigController(req, res) {
  try {
    const rawEnabled = process.env.TELEGRAM_ENABLED;
    const enabled = rawEnabled == null ? true : rawEnabled === "true";
    const config = {
      enabled,
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
