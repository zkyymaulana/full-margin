import { prisma } from "../lib/prisma.js";
import {
  backtestSingleIndicator,
  backtestAllIndicators,
} from "../services/backtest/backtest.service.js";

// 🕒 Format tanggal ke Bahasa Indonesia (Asia/Jakarta)
const formatDate = (t) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(t)));

/* ==========================================================
   🔧 Ambil Semua Data Candle & Indikator
========================================================== */
async function getIndicatorsWithPrices(symbol, timeframe) {
  console.log(
    `📊 Fetching dataset for ${symbol} (${timeframe}) between 2020–2025...`
  );
  const start = Date.now();

  // Rentang waktu (dalam epoch milliseconds)
  const startTime = new Date("2020-01-01T00:00:00Z").getTime();
  const endTime = new Date("2025-01-01T00:00:00Z").getTime();

  // Ambil data indikator dan candle sesuai rentang waktu
  const [indicators, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: {
        symbol,
        timeframe,
        time: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { time: "asc" },
    }),
    prisma.candle.findMany({
      where: {
        symbol,
        timeframe,
        time: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  const priceMap = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicators
    .map((i) => ({ ...i, close: priceMap.get(i.time.toString()) }))
    .filter((i) => i.close != null);

  const duration = (Date.now() - start) / 1000;

  const range = {
    start: formatDate(data[0]?.time),
    end: formatDate(data[data.length - 1]?.time),
  };

  const dataset = {
    candleStart: formatDate(candles[0]?.time),
    indicatorStart: formatDate(indicators[0]?.time),
    candleCount: candles.length,
    indicatorCount: indicators.length,
  };

  return { data, total: data.length, range, dataset, duration };
}

/* ==========================================================
   📊 BACKTEST SINGLE INDICATOR
========================================================== */
export async function backtestSingleIndicatorController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const indicator = req.params.indicator || req.body.indicator;
    const timeframe = "1h";

    if (!indicator) {
      return res.status(400).json({
        success: false,
        message:
          "Indicator name required. Valid: SMA, EMA, RSI, MACD, BollingerBands, Stochastic, PSAR, StochasticRSI",
      });
    }

    console.log(
      `\n📊 Starting single indicator backtest for ${symbol} - ${indicator}`
    );
    const { data, total, range, dataset } = await getIndicatorsWithPrices(
      symbol,
      timeframe
    );

    if (total < 50) {
      return res.status(400).json({
        success: false,
        message: `Data tidak cukup untuk backtest (${total}/50)`,
        symbol,
        timeframe,
      });
    }

    const start = Date.now();
    const result = await backtestSingleIndicator(data, indicator);

    res.json({
      success: true,
      symbol,
      timeframe,
      indicator,
      totalData: total,
      range,
      dataset,
      processingTime,
      timestamp: new Date().toISOString(),
      ...result,
    });
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
   📊 BACKTEST SEMUA INDIKATOR (COMPARISON)
========================================================== */
export async function backtestAllIndicatorsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    console.log(
      `\n📊 Starting all indicators backtest for ${symbol} (${timeframe})`
    );
    const { data, total, range, dataset } = await getIndicatorsWithPrices(
      symbol,
      timeframe
    );

    if (total < 50) {
      return res.status(400).json({
        success: false,
        message: `Data tidak cukup untuk backtest (${total}/50)`,
        symbol,
        timeframe,
      });
    }

    const start = Date.now();
    const result = await backtestAllIndicators(data);
    const processingTime = `${((Date.now() - start) / 1000).toFixed(2)}s`;

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: total,
      range,
      dataset,
      processingTime,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("❌ backtestAllIndicators:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
