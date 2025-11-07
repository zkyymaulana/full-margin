import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";
import { backtestWithWeights } from "../services/multiIndicator/multiIndicator-backtest.service.js";

/* --- Optimize --- */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();
    const startEpoch = Date.parse("2020-01-01T00:00:00Z");
    const endEpoch = Date.parse("2025-01-01T00:00:00Z");

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(startEpoch), lte: BigInt(endEpoch) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(startEpoch), lte: BigInt(endEpoch) },
        },
        select: { time: true, close: true },
      }),
    ]);

    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));
    if (!data.length)
      return res.status(400).json({ success: false, message: "Data kosong" });

    const result = await optimizeIndicatorWeights(data);
    await prisma.indicatorWeight.upsert({
      where: {
        symbol_timeframe_startTrain_endTrain: {
          symbol,
          timeframe,
          startTrain: BigInt(startEpoch),
          endTrain: BigInt(endEpoch),
        },
      },
      update: { ...result.performance, weights: result.bestWeights },
      create: {
        symbol,
        timeframe,
        startTrain: BigInt(startEpoch),
        endTrain: BigInt(endEpoch),
        ...result.performance,
        weights: result.bestWeights,
      },
    });

    res.json({ success: true, symbol, timeframe, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* --- Backtest --- */
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    const latest = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });
    if (!latest)
      return res
        .status(404)
        .json({ success: false, message: "No optimized weights found" });

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: latest.startTrain, lte: latest.endTrain },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: latest.startTrain, lte: latest.endTrain },
        },
        select: { time: true, close: true },
      }),
    ]);

    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));
    if (!data.length)
      return res
        .status(400)
        .json({ success: false, message: "Data tidak ditemukan" });

    const result = await backtestWithWeights(data, latest.weights);
    res.json({
      success: true,
      symbol,
      timeframe,
      bestWeights: latest.weights,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* --- Backtest (Equal Weight) --- */
export async function backtestWithEqualWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    // Ambil data historis
    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: { symbol, timeframe },
        select: { time: true, close: true },
      }),
    ]);

    // Gabungkan indikator & harga berdasarkan waktu
    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

    if (!data.length)
      return res.status(400).json({
        success: false,
        message: "Data historis kosong untuk simbol ini.",
      });

    // Tentukan semua indikator aktif
    const allIndicators = [
      "SMA",
      "EMA",
      "RSI",
      "MACD",
      "BollingerBands",
      "Stochastic",
      "PSAR",
      "StochasticRSI",
    ];

    // Buat semua bobot = 1
    const equalWeights = Object.fromEntries(allIndicators.map((k) => [k, 1]));

    // Jalankan backtest
    const result = await backtestWithWeights(data, equalWeights);

    return res.json({
      success: true,
      symbol,
      timeframe,
      methodology: "Equal-Weighted Multi-Indicator Backtest",
      weights: equalWeights,
      ...result,
    });
  } catch (err) {
    console.error("❌ Error in equal-weight backtest:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
