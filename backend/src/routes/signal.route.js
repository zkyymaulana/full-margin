// routes/signal.route.js
import express from "express";
import { getSignals } from "../controllers/signal.controller.js";
const router = express.Router();
router.get("/:symbol?", getSignals);
export default router;
