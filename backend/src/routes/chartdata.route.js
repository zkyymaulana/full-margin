// src/routes/chart.routes.js
// ambil data candle dari DB dan kirim ke frontend chart.
import express from "express";
import { getChart } from "../controllers/chartdata.controller.js";
const router = express.Router();

router.get("/:symbol?", getChart);
export default router;
