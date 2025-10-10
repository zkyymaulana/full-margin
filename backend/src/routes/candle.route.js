// src/routes/candle.route.js
import express from "express";
import { syncCoinbaseCandles } from "../controllers/candle.controller.js";

const router = express.Router();

router.get("/:symbol", syncCoinbaseCandles);

export default router;
