import express from "express";
import { getChart } from "../controllers/index.js";

const router = express.Router();

// Ambil data chart lengkap (candlestick + indikator + harga live)
router.get("/:symbol?", getChart); //blom

export default router;
