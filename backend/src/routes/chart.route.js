import express from "express";
import {
  getChart,
  getChartLiveTicker,
  getChartLiveOHLCV,
} from "../controllers/index.js";

const router = express.Router();

// Ambil ticker live untuk simbol tertentu.
router.get("/:symbol/live", getChartLiveTicker);

// Ambil OHLCV live untuk simbol + timeframe tertentu.
router.get("/:symbol/live-ohlcv", getChartLiveOHLCV);

// Ambil data chart lengkap (candlestick + indikator + harga live)
router.get("/:symbol?", getChart); //blom

export default router;
