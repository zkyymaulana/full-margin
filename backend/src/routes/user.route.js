import express from "express";
import {
  getProfile,
  updateProfile,
  updateTelegramSettings,
} from "../controllers/index.js";

const router = express.Router();

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

router.patch("/:id/telegram", updateTelegramSettings);

export default router;
