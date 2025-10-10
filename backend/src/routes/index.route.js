import express from "express";
import marketcapRoute from "./marketcap.route.js";
import chartRoutes from "./chart.route.js";
import candleRoute from "./candle.route.js";

const router = express.Router();

router.use("/marketcap", marketcapRoute);
router.use("/chart", chartRoutes);
router.use("/candle", candleRoute);

export default router;
