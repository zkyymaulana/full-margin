import {
  getUserProfile,
  updateUserProfile,
  validateUserAuthorization,
  validateTelegramInput,
  buildTelegramUpdateData,
  updateUserTelegramSettings,
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
 * Update Telegram Settings untuk User
 * PATCH /api/users/:id/telegram
 */
export async function updateTelegramSettings(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const authUserId = req.user?.id;
    const { telegramChatId, telegramEnabled } = req.body;

    // Validate authorization using service function
    validateUserAuthorization(userId, authUserId);

    // Validate input using service function
    validateTelegramInput(telegramChatId, telegramEnabled);

    // Build update data using service function
    const updateData = buildTelegramUpdateData(telegramChatId, telegramEnabled);

    // Update user using service function
    const updatedUser = await updateUserTelegramSettings(userId, updateData);

    return res.json({
      success: true,
      message: "Telegram settings updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    // Handle specific error types
    const statusCode = err.message.includes("Forbidden")
      ? 403
      : err.message.includes("must be")
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
}
