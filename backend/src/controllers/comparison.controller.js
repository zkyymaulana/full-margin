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
 * 🎯 Compare Trading Strategies Endpoint (Simplified Academic)
 *
 * Provides clean academic comparison results focusing on three core metrics:
 * ROI, Win Rate, and Max Drawdown without balance tracking complexity.
 */
export async function compareIndicators(req, res) {
  try {
    const { symbol, start, end } = req.body;

    if (!symbol || !start || !end) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: symbol, start, end",
      });
    }

    console.log(`🚀 Starting academic comparison for ${symbol}`);

    // 🔧 Ambil hasil utama
    const raw = await compareStrategies(symbol, start, end);

    if (!raw || raw.success === false) {
      return res.status(404).json({
        success: false,
        message: raw?.message || "No data found in DB",
      });
    }

    // 🔍 Ambil dari dalam raw.comparison
    const comp = raw.comparison || {};
    const cleanedSingle = {};
    if (comp.single) {
      for (const [k, v] of Object.entries(comp.single)) {
        cleanedSingle[k] = cleanResult(v);
      }
    }

    const cleanedMulti = cleanResult(comp.multi);

    const result = {
      success: true,
      symbol: symbol.toUpperCase(),
      comparison: {
        single: cleanedSingle,
        multi: cleanedMulti,
        bestStrategy: comp.bestStrategy || "unknown",
        bestSingleIndicator: comp.bestSingleIndicator || "unknown",
      },
    };

    // Log hasil summary
    const best = cleanedSingle[comp.bestSingleIndicator] || {
      roi: 0,
      winRate: 0,
      maxDrawdown: 0,
    };
    const multi = cleanedMulti || { roi: 0, winRate: 0, maxDrawdown: 0 };
    console.log(
      `📊 ${symbol}: BestSingle(${comp.bestSingleIndicator}) ROI=${best.roi}% | WR=${best.winRate}% | DD=${best.maxDrawdown}% | Multi ROI=${multi.roi}% | WR=${multi.winRate}%`
    );

    res.json(result);
  } catch (err) {
    console.error("❌ compareIndicators error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
