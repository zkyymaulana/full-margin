/**
 * 📊 COMPARISON CONTROLLER (Clean Architecture)
 * ---------------------------------------------------------------
 * HTTP Layer - handles only request/response
 * All business logic delegated to comparison.service.js
 *
 * Responsibilities:
 * - Validate request parameters
 * - Call service layer
 * - Format HTTP responses
 * - Handle HTTP status codes
 */

import { compareStrategies } from "../services/comparison/comparison.service.js";

/**
 * 🎯 Compare Trading Strategies Endpoint
 *
 * POST /api/comparison/compare
 * Body: { symbol, startDate, endDate }
 *
 * Returns unified comparison structure:
 * {
 *   success: boolean,
 *   symbol: string,
 *   timeframe: string,
 *   period: { start, end, days },
 *   comparison: { single, multi, bestStrategy },
 *   bestWeights: object,
 *   weightSource: string,
 *   analysis: {
 *     periodDays, candles, dataPoints,
 *     bestSingle: { indicator, roi, winRate, maxDrawdown, trades },
 *     multiBeatsBestSingle: boolean,
 *     roiDifference: number,
 *     winRateComparison: { multi, bestSingle, difference }
 *   },
 *   timestamp: string
 * }
 */
export const compareIndicators = async (req, res) => {
  try {
    // 1️⃣ Validate request parameters
    const { symbol, startDate, endDate } = req.body;

    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: symbol, startDate, and endDate are required",
        example: {
          symbol: "BTC-USD",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      });
    }

    // 2️⃣ Validate date formats
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
      });
    }

    if (startDateObj >= endDateObj) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before endDate",
      });
    }

    console.log(
      `📊 Comparison request received: ${symbol} (${startDate} → ${endDate})`
    );

    // 3️⃣ Call service layer (pure business logic)
    const result = await compareStrategies(symbol, startDate, endDate);

    // 4️⃣ Handle service response
    if (!result.success) {
      return res.status(404).json(result);
    }

    // 5️⃣ Return successful response
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Comparison Controller Error:", error);

    // Handle specific error types
    if (error.message.includes("No data found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Generic internal server error
    return res.status(500).json({
      success: false,
      message: "Internal server error during comparison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
