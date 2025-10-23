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
