import {
  getUserProfile,
  updateUserProfile,
} from "../services/user/profile.service.js";

export async function getProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const profile = await getUserProfile(userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { updated } = await updateUserProfile(userId, req.body || {});
    res.json({ success: true, message: "Profil diperbarui", data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 📱 Update Telegram Settings untuk User
 * PATCH /api/users/:id/telegram
 */
export async function updateTelegramSettings(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const authUserId = req.user?.id;

    // Validasi: user hanya bisa update settings mereka sendiri
    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only update your own Telegram settings",
      });
    }

    const { telegramChatId, telegramEnabled } = req.body;

    // Validasi input
    if (
      telegramChatId !== undefined &&
      typeof telegramChatId !== "string" &&
      telegramChatId !== null
    ) {
      return res.status(400).json({
        success: false,
        message: "telegramChatId must be a string or null",
      });
    }

    if (telegramEnabled !== undefined && typeof telegramEnabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "telegramEnabled must be a boolean",
      });
    }

    // Build update data
    const updateData = {};
    if (telegramChatId !== undefined)
      updateData.telegramChatId = telegramChatId;
    if (telegramEnabled !== undefined)
      updateData.telegramEnabled = telegramEnabled;

    // Update user
    const { prisma } = await import("../lib/prisma.js");
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        telegramChatId: true,
        telegramEnabled: true,
      },
    });

    console.log(`✅ Updated Telegram settings for user ${userId}`);

    return res.json({
      success: true,
      message: "Telegram settings updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("❌ Error updating Telegram settings:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
