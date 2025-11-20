import express from "express";
import {
  getProfile,
  updateProfile,
  updateTelegramSettings,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);

// 📱 Telegram Settings
router.patch("/:id/telegram", verifyToken, updateTelegramSettings);

export default router;
