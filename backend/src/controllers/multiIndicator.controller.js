import { prisma } from "../lib/prisma.js";
import {
  analyzeMultiIndicator,
  analyzeMultiIndicatorWithWeights,
  analyzeMultiIndicatorGridSearch,
} from "../services/multiIndicator/multiIndicator-analyzer.service.js";

/* ==========================================================
   🔧 HELPERS
========================================================== */
async function getIndicatorsWithPrices(symbol, timeframe, limit) {
  const [indicators, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      take: limit,
    }),
    prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      take: limit,
      select: { time: true, close: true },
    }),
  ]);
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  return indicators.map((i) => ({
    ...i,
    close: map.get(i.time.toString()) || null,
  }));
}

/* ==========================================================
   🎯 DEFAULT MULTI INDICATOR ANALYSIS
========================================================== */
export async function getMultiIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const limit = Math.min(2000, parseInt(req.query.limit) || 500);

    const data = await getIndicatorsWithPrices(symbol, timeframe, limit);
    if (!data.length)
      return res.json({ success: true, symbol, timeframe, total: 0, data: [] });

    const result = data.map((i) => {
      const a = analyzeMultiIndicator(i);
      return {
        time: Number(i.time),
        price: i.close,
        multiIndicator: a.multiIndicator,
        totalScore: a.totalScore,
        weights: a.weights,
        categoryScores: a.categoryScores,
        signals: a.signals,
      };
    });

    res.json({
      success: true,
      symbol,
      strategy: "multi",
      timeframe,
      total: result.length,
      data: result,
    });
  } catch (err) {
    console.error("❌ getMultiIndicators:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ==========================================================
   🧩 GRID SEARCH (ω ∈ {0..4})
========================================================== */
export async function getMultiIndicatorGridSearch(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const limit = Math.min(1000, parseInt(req.query.limit) || 200);

    const indicators = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
      take: limit,
      include: { candle: { select: { close: true, timestamp: true } } },
    });

    const data = indicators
      .filter((i) => i.candle)
      .map((i) => ({
        ...i,
        close: i.candle.close,
        timestamp: i.candle.timestamp,
      }));

    if (data.length < 50)
      return res.status(400).json({
        success: false,
        message: `Insufficient data for grid search (${data.length}/50)`,
      });

    const result = await analyzeMultiIndicatorGridSearch(data, symbol);
    res.json(result);
  } catch (err) {
    console.error("❌ getMultiIndicatorGridSearch:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ==========================================================
   ⚙️ CUSTOM WEIGHTS ANALYSIS
========================================================== */
export async function getMultiIndicatorCustomWeights(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const limit = Math.min(500, parseInt(req.query.limit) || 100);
    const { momentum = 3, trend = 2, volatility = 1 } = req.body;
    const weights = { momentum, trend, volatility };

    // Validation
    if (![momentum, trend, volatility].every((w) => w >= 0 && w <= 4))
      return res
        .status(400)
        .json({ success: false, message: "Weights must be between 0 and 4" });

    const data = await getIndicatorsWithPrices(symbol, timeframe, limit);
    if (!data.length)
      return res.status(404).json({
        success: false,
        message: `No indicator data found for ${symbol}`,
      });

    const result = data.map((i) => {
      const a = analyzeMultiIndicatorWithWeights(i, weights);
      return {
        time: Number(i.time),
        price: i.close,
        multiIndicator: a.multiIndicator,
        totalScore: a.totalScore,
        weights: a.weights,
        categoryScores: a.categoryScores,
        signals: a.signals,
      };
    });

    res.json({
      success: true,
      symbol,
      weights,
      methodology: "Custom manual weighting – Sukma & Namahoot (2025)",
      total: result.length,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ getMultiIndicatorCustomWeights:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
