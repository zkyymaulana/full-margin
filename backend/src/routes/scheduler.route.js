import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  startSchedulers,
  stopSchedulers,
  getStatus,
} from "../controllers/scheduler.controller.js";

const router = express.Router();

router.get("/status", getStatus);

// Protected routes (require authentication)
router.post("/start", authMiddleware, startSchedulers);
router.post("/stop", authMiddleware, stopSchedulers);

export default router;
