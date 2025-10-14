// src/routes/index.route.js
import express from "express";
import candleRoute from "./candle.route.js";
import chartRoute from "./chartdata.route.js";
import marketcapRoute from "./marketcap.route.js";
import analysisRoute from "./analysis.route.js";
import authRoute from "./auth.route.js";
import comparisonRoute from "./comparison.route.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use("/auth", authRoute);
router.use("/candle", candleRoute);
router.use("/chart", chartRoute);
router.use("/marketcap", marketcapRoute);
router.use("/analysis", authMiddleware, analysisRoute);
router.use("/comparison", authMiddleware, comparisonRoute);

// default handler
router.use("*", (_, res) =>
  res.status(404).json({ success: false, message: "Endpoint not found" })
);

export default router;
