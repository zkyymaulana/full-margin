/**
 * 🛣️ Indicators Routes - Technical Indicators API Endpoints (Dynamic Edition)
 * Handles all indicator-related HTTP requests with dynamic symbol loading
 *
 * @description Routes untuk API endpoint indikator teknikal dengan loading symbol dinamis
 * @endpoints GET /api/indicators, GET /api/indicators/calculate, GET /api/indicators/symbols, GET /api/indicators/marketcap
 */

import express from "express";
import {
  getIndicators,
  calculateIndicators,
  getSupportedSymbolsList,
  getMarketCapAnalysis,
} from "../controllers/indicators.controller.js";

const router = express.Router();

/**
 * GET /api/indicators
 * Get calculated indicators for default symbol and timeframe (1h only)
 */
router.get("/", getIndicators);

/**
 * GET /api/indicators/calculate
 * Calculate indicators with custom parameters (1h only)
 * Query params: symbol, startTime, endTime
 */
router.get("/calculate", calculateIndicators);

/**
 * GET /api/indicators/symbols
 * Get list of supported symbols (Top 100 market cap coins on Coinbase)
 */
router.get("/symbols", getSupportedSymbolsList);

/**
 * GET /api/indicators/marketcap
 * Get detailed market cap analysis and coin matching results
 * Query params: refresh (boolean) - force refresh from APIs
 */
router.get("/marketcap", getMarketCapAnalysis);

/**
 * GET /api/indicators/health
 * Health check for indicators service
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "indicators",
    message: "📊 Indicators service is running - Dynamic Edition",
    dataProvider: "CoinGecko + Coinbase Pro API",
    timeframe: "1h (hardcoded)",
    supportedCoins: "Top 100 market cap coins dynamically loaded",
    features: [
      "Dynamic symbol loading from CoinGecko market cap",
      "Cross-platform matching with Coinbase availability",
      "Auto-refresh and caching support",
      "Fallback to Coinbase-only if CoinGecko fails",
    ],
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET /api/indicators - Get 1h indicators",
      "GET /api/indicators/calculate - Calculate custom 1h indicators",
      "GET /api/indicators/symbols - Get supported symbols list",
      "GET /api/indicators/marketcap - Get market cap analysis",
      "GET /api/indicators/health - Service health check",
    ],
  });
});

export default router;
