// src/routes/candle.route.js
// sinkronisasi candle dari Coinbase.
import express from "express";
import { syncCandles } from "../controllers/candle.controller.js";

const router = express.Router();
router.get("/:symbol", syncCandles);
export default router;
