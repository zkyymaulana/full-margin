import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../services/watchlist/watchlist.service.js";

// Ambil semua coin di watchlist user yang sedang login.
export async function getWatchlistHandler(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await getWatchlist(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Tambahkan satu coin ke watchlist user.
export async function addToWatchlistHandler(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const coinId = parseInt(req.body?.coinId);
    if (!coinId || isNaN(coinId))
      return res.status(400).json({
        success: false,
        message: "coinId is required and must be a number",
      });

    const entry = await addToWatchlist(userId, coinId);

    // Cek status Telegram user agar response lebih informatif.
    const { prisma } = await import("../lib/prisma.js");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramEnabled: true, telegramChatId: true },
    });

    const telegramConnected = user?.telegramEnabled && user?.telegramChatId;

    res.status(201).json({
      success: true,
      message: telegramConnected
        ? "Added to watchlist. You will receive Telegram alerts for this coin."
        : "Added to watchlist. Connect Telegram to receive alerts.",
      telegramConnected,
      data: entry,
    });
  } catch (err) {
    const status = err.message.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

// Hapus coin tertentu dari watchlist user.
export async function removeFromWatchlistHandler(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const coinId = parseInt(req.params.coinId);
    if (!coinId || isNaN(coinId))
      return res
        .status(400)
        .json({ success: false, message: "coinId param must be a number" });

    await removeFromWatchlist(userId, coinId);
    res.json({ success: true, message: "Removed from watchlist", coinId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
