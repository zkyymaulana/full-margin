import express from "express";
import { getChart } from "../controllers/chart.controller.js";

const router = express.Router();

// Ambil data chart lengkap (candlestick + indikator + harga live)
router.get("/:symbol?", getChart);

export default router;
