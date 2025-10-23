// src/routes/index.route.js
import express from "express";
import authRoute from "./auth.route.js";
import marketcapRoute from "./marketcap.route.js";
import chartRoute from "./chart.route.js";
import indicatorRoute from "./indicator.route.js";
import multiIndicatorRoute from "./multiIndicator.route.js";
import comparisonRoute from "./comparison.route.js";
import schedulerRoute from "./scheduler.route.js";
import userRoute from "./user.route.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Authentication
router.use("/auth", authRoute);

// Market data
router.use("/marketcap", authMiddleware, marketcapRoute);

// User profile (protected)
router.use("/user", authMiddleware, userRoute);

// Analysis & Visualization
router.use("/chart", chartRoute);
router.use("/indicator", indicatorRoute);
router.use("/multiIndicator", multiIndicatorRoute);
router.use("/comparison", comparisonRoute);

// Scheduler management
router.use("/scheduler", schedulerRoute);

// Default 404 handler
router.use("*", (_, res) =>
  res.status(404).json({ success: false, message: "Endpoint not found" })
);

export default router;
