import express from "express";
import {
  register,
  login,
  logout,
  loginWithGoogle,
} from "../controllers/index.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", loginWithGoogle);
router.post("/logout", logout);

export default router;
