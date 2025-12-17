import express from "express";
import { getSignals } from "../controllers/indicator.controller.js";

const router = express.Router();

// Get indicators symbol
router.get("/:symbol?", getSignals);

export default router;
