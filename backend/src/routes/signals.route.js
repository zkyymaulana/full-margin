// /**
//  * 🛣️ Signals Routes - Trading Signals API Endpoints
//  * Handles all signal-related HTTP requests
//  *
//  * @description Routes untuk API endpoint sinyal trading
//  * @endpoints GET /api/signals, GET /api/signals/multi, GET /api/signals/current
//  */

// import express from "express";
// import { getSignals, getMultiIndicatorSignals, getCurrentSignals } from "../controllers/signals.controller.js";

// const router = express.Router();

// /**
//  * GET /api/signals
//  * Get trading signals for individual indicators
//  */
// router.get("/", getSignals);

// /**
//  * GET /api/signals/multi
//  * Get multi-indicator combined signals analysis
//  */
// router.get("/multi", getMultiIndicatorSignals);

// /**
//  * GET /api/signals/current
//  * Get current market signals summary
//  */
// router.get("/current", getCurrentSignals);

// /**
//  * GET /api/signals/health
//  * Health check for signals service
//  */
// router.get("/health", (req, res) => {
//   res.json({
//     success: true,
//     service: "signals",
//     message: "🎯 Signals service is running",
//     timestamp: new Date().toISOString(),
//     endpoints: [
//       "GET /api/signals - Get individual indicator signals",
//       "GET /api/signals/multi - Get multi-indicator analysis",
//       "GET /api/signals/current - Get current market signals",
//       "GET /api/signals/health - Service health check"
//     ]
//   });
// });

// export default router;
