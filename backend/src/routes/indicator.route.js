import express from "express";
import { getSignals } from "../controllers/index.js";

const router = express.Router();

// Get indicators symbol
router.get("/:symbol?", getSignals);

export default router;
