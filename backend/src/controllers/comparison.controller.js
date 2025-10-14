import {
  compareStrategies,
  getAvailableIndicators,
  getComparisonHistory,
  DEFAULT_INDICATOR_WEIGHTS,
} from "../services/comparison.service.js";

/**
 * 🎯 Compare single vs multi-indicator trading strategies
 * POST /api/comparison/compare
 * Body: {
 *   symbol: "BTC-USD",
 *   singleIndicator: "rsi",
 *   multiConfig: { weights: { rsi: 0.3, macd: 0.4, sma20: 0.3 } },
 *   startDate: "2024-01-01",
 *   endDate: "2024-10-01",
 *   timeframe: "1h",
 *   initialCapital: 10000
 * }
 */
export async function compareIndicatorStrategies(req, res) {
  try {
    const {
      symbol,
      singleIndicator,
      multiConfig = {},
      startDate,
      endDate,
      timeframe = "1h",
      initialCapital = 10000,
    } = req.body;

    // Validation
    if (!symbol || !singleIndicator || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: symbol, singleIndicator, startDate, endDate",
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD or ISO format",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    // Check if date range is reasonable (not too long)
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      return res.status(400).json({
        success: false,
        message: "Date range too large. Maximum 365 days allowed",
      });
    }

    console.log(
      `🔍 Comparison request: ${symbol} | ${singleIndicator} vs Multi | ${daysDiff} days`
    );

    // Run comparison
    const comparison = await compareStrategies(
      symbol,
      singleIndicator,
      multiConfig,
      start,
      end,
      timeframe,
      initialCapital
    );

    res.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in compareIndicatorStrategies:", error);

    let statusCode = 500;
    let message = "Internal server error during comparison";

    if (error.message.includes("Insufficient data")) {
      statusCode = 400;
      message = error.message;
    } else if (error.message.includes("not found")) {
      statusCode = 404;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error.message,
    });
  }
}

/**
 * 📊 Get available indicators for a symbol
 * GET /api/comparison/indicators/:symbol?timeframe=1h
 */
export async function getIndicatorsForSymbol(req, res) {
  try {
    const { symbol } = req.params;
    const { timeframe = "1h" } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
      });
    }

    const indicators = await getAvailableIndicators(symbol, timeframe);

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        indicators,
        defaultWeights: DEFAULT_INDICATOR_WEIGHTS,
      },
    });
  } catch (error) {
    console.error("❌ Error getting indicators:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available indicators",
      error: error.message,
    });
  }
}

/**
 * 📈 Get comparison history for a symbol
 * GET /api/comparison/history/:symbol?limit=10
 */
export async function getSymbolComparisonHistory(req, res) {
  try {
    const { symbol } = req.params;
    const { limit = 10 } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
      });
    }

    const history = await getComparisonHistory(symbol, parseInt(limit));

    res.json({
      success: true,
      data: {
        symbol,
        history,
        count: history.length,
      },
    });
  } catch (error) {
    console.error("❌ Error getting comparison history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching comparison history",
      error: error.message,
    });
  }
}

/**
 * 🎯 Quick comparison with preset configurations
 * POST /api/comparison/quick
 * Body: {
 *   symbol: "BTC-USD",
 *   preset: "conservative" | "aggressive" | "balanced",
 *   days: 30
 * }
 */
export async function quickComparison(req, res) {
  try {
    const { symbol, preset = "balanced", days = 30 } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
      });
    }

    // Preset configurations
    const presets = {
      conservative: {
        singleIndicator: "sma20",
        multiConfig: {
          weights: {
            sma20: 0.35,
            ema20: 0.25,
            rsi: 0.2,
            macd: 0.15,
            psar: 0.05,
          },
        },
      },
      balanced: {
        singleIndicator: "rsi",
        multiConfig: {
          weights: DEFAULT_INDICATOR_WEIGHTS,
        },
      },
      aggressive: {
        singleIndicator: "macd",
        multiConfig: {
          weights: {
            sma20: 0.1,
            ema20: 0.15,
            rsi: 0.3,
            macd: 0.35,
            psar: 0.1,
          },
        },
      },
    };

    const config = presets[preset];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Invalid preset. Use: conservative, balanced, or aggressive",
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`🚀 Quick ${preset} comparison for ${symbol} (${days} days)`);

    const comparison = await compareStrategies(
      symbol,
      config.singleIndicator,
      config.multiConfig,
      startDate,
      endDate,
      "1h",
      10000
    );

    res.json({
      success: true,
      data: {
        ...comparison,
        preset,
        configuration: config,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in quick comparison:", error);

    let statusCode = 500;
    let message = "Internal server error during quick comparison";

    if (error.message.includes("Insufficient data")) {
      statusCode = 400;
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error.message,
    });
  }
}

/**
 * 📊 Get comparison statistics overview
 * GET /api/comparison/stats
 */
export async function getComparisonStats(req, res) {
  try {
    // This would typically aggregate data from stored comparison results
    // For now, return basic statistics

    const stats = {
      totalComparisons: 0, // Would come from database
      popularIndicators: [
        { name: "RSI", usage: 45 },
        { name: "MACD", usage: 38 },
        { name: "SMA 20", usage: 32 },
        { name: "EMA 20", usage: 28 },
        { name: "PSAR", usage: 15 },
      ],
      averagePerformance: {
        singleIndicatorROI: 0,
        multiIndicatorROI: 0,
        winRateImprovement: 0,
      },
      recommendations: [
        "Multi-indicator strategies tend to have lower drawdown",
        "RSI works well for ranging markets",
        "MACD is effective in trending markets",
        "Combining momentum and trend indicators often improves consistency",
      ],
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error getting comparison stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching comparison statistics",
      error: error.message,
    });
  }
}
