import {
  getUserProfile,
  updateUserProfile,
  validateUserAuthorization,
  validateTelegramInput,
  buildTelegramUpdateData,
  updateUserTelegramSettings,
} from "../services/user/profile.service.js";

// Ambil profil user yang sedang login.
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

// Perbarui data profil user yang sedang login.
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

// Perbarui pengaturan Telegram milik user tertentu.
export async function updateTelegramSettings(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const authUserId = req.user?.id;
    const { telegramChatId, telegramEnabled } = req.body;

    // Pastikan user hanya bisa mengubah data miliknya sendiri.
    validateUserAuthorization(userId, authUserId);

    // Validasi format input Telegram.
    validateTelegramInput(telegramChatId, telegramEnabled);

    // Bentuk payload update sesuai field yang valid.
    const updateData = buildTelegramUpdateData(telegramChatId, telegramEnabled);

    // Simpan perubahan ke database lewat service.
    const updatedUser = await updateUserTelegramSettings(userId, updateData);

    return res.json({
      success: true,
      message: "Telegram settings updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    // Tentukan status code berdasarkan jenis error.
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
