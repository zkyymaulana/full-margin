import { prisma } from "../lib/prisma.js";
import { compareStrategies } from "../services/comparison/comparison.service.js";

export async function compareIndicators(req, res) {
  try {
    const { symbol, start, end } = req.body;

    // Validate required parameters (removed indicator requirement)
    if (!symbol || !start || !end) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: symbol, start, end",
      });
    }

    console.log(`🚀 Starting comparison for ${symbol}`);

    // Call the comparison service (no longer passing specific indicator)
    const comparison = await compareStrategies(symbol, start, end);

    console.log(`✅ Finished comparison: all indicators vs multi`);

    res.json({
      success: true,
      symbol,
      comparison,
    });
  } catch (err) {
    console.error("❌ Comparison error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
