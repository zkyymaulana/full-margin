import express from "express";
import {
  login,
  logout,
  register,
  loginWithGoogle,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", loginWithGoogle);
router.post("/logout", logout);

export default router;
