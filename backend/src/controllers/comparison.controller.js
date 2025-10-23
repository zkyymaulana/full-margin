import { prisma } from "../lib/prisma.js";
import { compareStrategies } from "../services/comparison/comparison.service.js";

/**
 * ✅ Clean Result Helper - Extract Only Three Core Academic Metrics
 *
 * Simplified version focusing on the three core metrics without balance tracking.
 *
 * @param {Object} result - Raw backtesting result object
 * @returns {Object} Cleaned result with only roi, winRate, maxDrawdown
 */
function cleanResult(result) {
  if (!result) return null;

  // ✅ Extract only the three core academic metrics
  const cleaned = {
    roi: +Number(result.roi || 0).toFixed(2),
    winRate: +Number(result.winRate || 0).toFixed(2),
    maxDrawdown: +Number(result.maxDrawdown || 0).toFixed(2),
    trades: result.trades || 0,
  };

  // ✅ Validate realistic ranges
  // ROI should be between -100% and +500% (more realistic for academic studies)
  if (cleaned.roi < -100) cleaned.roi = -100.0;
  if (cleaned.roi > 500) cleaned.roi = 500.0;

  // Win rate should be between 0% and 100%
  if (cleaned.winRate < 0) cleaned.winRate = 0.0;
  if (cleaned.winRate > 100) cleaned.winRate = 100.0;

  // Max drawdown should be between 0% and 100%
  if (cleaned.maxDrawdown < 0) cleaned.maxDrawdown = 0.0;
  if (cleaned.maxDrawdown > 100) cleaned.maxDrawdown = 100.0;

  return cleaned;
}

/**
 * 🎯 Compare Trading Strategies Endpoint (Enhanced with Metadata)
 *
 * Provides comprehensive academic comparison results with total candle information
 * and ultra-conservative trading parameters for 1H timeframe.
 */
export const compareIndicators = async (req, res) => {
  try {
    const { symbol, startDate, endDate } = req.body;

    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Symbol, startDate, and endDate are required",
      });
    }

    // Fix parameter names to match service function signature (start, end)
    const result = await compareStrategies(symbol, startDate, endDate);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Use dataInfo instead of metadata to match service response
    const response = {
      success: true,
      symbol: result.symbol,
      timeframe: result.timeframe,
      totalCandles: result.dataInfo.totalCandles,
      totalIndicators: result.dataInfo.totalIndicators,
      periodDays: result.dataInfo.periodDays,
      startDate: result.dataInfo.startDate,
      endDate: result.dataInfo.endDate,
      tradingConfig: result.dataInfo.tradingConfig,
      analysis: result.analysis,
      comparison: result.comparison,
      // Include High-ROI comparison block in API response
      comparisonHighROI: result.comparisonHighROI,
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Comparison Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during comparison",
      error: error.message,
    });
  }
};
