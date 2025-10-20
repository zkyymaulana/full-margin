// src/routes/index.route.js
import express from "express";
import authRoute from "./auth.route.js";
import marketcapRoute from "./marketcap.route.js";
import chartRoute from "./chart.route.js";
import indicatorRoute from "./indicator.route.js";
import multiIndicatorRoute from "./multiIndicator.route.js";
import comparisonRoute from "./comparison.route.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Authentication
router.use("/auth", authRoute);

// Market data
router.use("/marketcap", authMiddleware, marketcapRoute);

// Analysis & Visualization
router.use("/chart", authMiddleware, chartRoute);
router.use("/indicator", authMiddleware, indicatorRoute);
router.use("/multiIndicator", authMiddleware, multiIndicatorRoute);
router.use("/comparison", authMiddleware, comparisonRoute);

// Default 404 handler
router.use("*", (_, res) =>
  res.status(404).json({ success: false, message: "Endpoint not found" })
);

export default router;
