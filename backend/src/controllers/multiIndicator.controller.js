import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";

/* ==========================================================
   🔧 HELPER: Fetch Full Dataset (No Limit)
========================================================== */
async function getIndicatorsWithPrices(symbol, timeframe) {
  console.log(`📊 Fetching full dataset for ${symbol} (${timeframe})...`);
  const startTime = Date.now();

  const [indicatorData, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
    }),
    prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  const candleMap = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicatorData
    .map((i) => ({
      ...i,
      close: candleMap.get(i.time.toString()),
    }))
    .filter((i) => i.close != null);

  const duration = Date.now() - startTime;
  console.log(`✅ Loaded ${data.length} data points in ${duration}ms`);

  return data;
}

/* ==========================================================
   🎯 OPTIMIZE MULTI-INDICATOR WEIGHTS
   Based on: Sukma & Namahoot (2025)
========================================================== */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    const defaultIndicators = [
      "SMA",
      "EMA",
      "RSI",
      "MACD",
      "BollingerBands",
      "Stochastic",
      "PSAR",
      "StochasticRSI",
    ];
    const selectedIndicators = req.body.indicators || defaultIndicators;

    const validIndicators = defaultIndicators;
    const invalidIndicators = selectedIndicators.filter(
      (ind) => !validIndicators.includes(ind)
    );

    if (invalidIndicators.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid indicators: ${invalidIndicators.join(", ")}. Valid options: ${validIndicators.join(", ")}`,
      });
    }

    console.log(`\n🎯 Starting multi-indicator optimization for ${symbol}`);
    const data = await getIndicatorsWithPrices(symbol, timeframe);

    if (data.length < 50) {
      return res.status(400).json({
        success: false,
        message: `Insufficient data for optimization (${data.length}/50 required)`,
        symbol,
        timeframe,
      });
    }

    const result = await optimizeIndicatorWeights(data, selectedIndicators);
    result.symbol = symbol;
    result.timeframe = timeframe;
    result.dataPoints = data.length;

    res.json(result);
  } catch (err) {
    console.error("❌ optimizeIndicatorWeights:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
