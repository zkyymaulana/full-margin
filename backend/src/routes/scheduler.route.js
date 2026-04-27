import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { startSchedulers, updateListingDates } from "../controllers/index.js";

const router = express.Router();

// Protected routes (require authentication)
router.post("/start", authMiddleware, startSchedulers);
router.post("/stop", authMiddleware);
router.post("/update-listing-dates", authMiddleware, updateListingDates);

export default router;
