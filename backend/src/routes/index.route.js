// src/routes/index.route.js
import express from "express";
import candleRoute from "./candle.route.js";
import chartRoute from "./chartdata.route.js";
import marketcapRoute from "./marketcap.route.js";
// import indicatorsRoute from "./indicators.route.js";
// import signalsRoute from "./signals.route.js";
// import backtestRoute from "./backtest.route.js";

const router = express.Router();

router.use("/candle", candleRoute);
router.use("/chart", chartRoute);
router.use("/marketcap", marketcapRoute);
// router.use("/indicators", indicatorsRoute);
// router.use("/signals", signalsRoute);
// router.use("/backtest", backtestRoute);

// default handler
router.use("*", (_, res) =>
  res.status(404).json({ success: false, message: "Endpoint not found" })
);

export default router;
