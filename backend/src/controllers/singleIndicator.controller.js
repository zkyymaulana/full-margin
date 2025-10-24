import { prisma } from "../lib/prisma.js";
import {
  backtestSingleIndicator,
  backtestAllIndicators,
} from "../services/indicators/indicator-backtest.service.js";

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
   📊 BACKTEST SINGLE INDICATOR
========================================================== */
export async function backtestSingleIndicatorController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const indicatorName = req.params.indicator || req.body.indicator;
    const timeframe = "1h";

    if (!indicatorName) {
      return res.status(400).json({
        success: false,
        message:
          "Indicator name is required. Valid options: SMA, EMA, RSI, MACD, BollingerBands, Stochastic, PSAR, StochasticRSI",
      });
    }

    console.log(
      `\n📊 Starting single indicator backtest for ${symbol} - ${indicatorName}`
    );
    const data = await getIndicatorsWithPrices(symbol, timeframe);

    if (data.length < 50) {
      return res.status(400).json({
        success: false,
        message: `Insufficient data for backtest (${data.length}/50 required)`,
        symbol,
        timeframe,
      });
    }

    const result = await backtestSingleIndicator(data, indicatorName);
    result.symbol = symbol;
    result.timeframe = timeframe;

    res.json(result);
  } catch (err) {
    console.error("❌ backtestSingleIndicator:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* ==========================================================
   📊 BACKTEST ALL INDICATORS (Comparison)
========================================================== */
export async function backtestAllIndicatorsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    console.log(`\n📊 Starting all indicators comparison for ${symbol}`);
    const data = await getIndicatorsWithPrices(symbol, timeframe);

    if (data.length < 50) {
      return res.status(400).json({
        success: false,
        message: `Insufficient data for backtest (${data.length}/50 required)`,
        symbol,
        timeframe,
      });
    }

    const result = await backtestAllIndicators(data);
    result.symbol = symbol;
    result.timeframe = timeframe;

    res.json(result);
  } catch (err) {
    console.error("❌ backtestAllIndicators:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
