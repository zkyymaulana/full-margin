import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";
import {
  calculateIndividualSignals,
  scoreSignal,
} from "../services/multiIndicator/multiIndicator-analyzer.service.js";

/* ==========================================================
   🔧 HELPER: Fetch Dataset within Fixed Epoch Window
========================================================== */
async function getIndicatorsWithPrices(
  symbol,
  timeframe,
  startEpoch,
  endEpoch
) {
  console.log(
    `📊 Fetching dataset for ${symbol} (${timeframe}) between ${new Date(Number(startEpoch)).toISOString()} and ${new Date(Number(endEpoch)).toISOString()}...`
  );
  const t0 = Date.now();

  const [indicatorData, candles] = await Promise.all([
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
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  if ((indicatorData?.length ?? 0) === 0 || (candles?.length ?? 0) === 0) {
    console.warn(
      "⚠️  No candle data found for",
      symbol,
      "in given epoch range"
    );
  }

  const candleMap = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicatorData
    .map((i) => ({
      ...i,
      close: candleMap.get(i.time.toString()),
    }))
    .filter((i) => i.close != null);

  console.log(`✅ Loaded ${data.length} data points in ${Date.now() - t0}ms`);
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

    const startEpoch = new Date("2020-01-01").getTime();
    const endEpoch = new Date("2025-01-01").getTime();

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

    // 1) Try cache
    const cached = await prisma.indicatorWeight.findFirst({
      where: {
        symbol,
        timeframe,
        startTrain: BigInt(startEpoch),
        endTrain: BigInt(endEpoch),
      },
    });

    if (cached) {
      console.log("⚡ Using cached optimized weights from DB");
      return res.json({
        success: true,
        cached: true,
        symbol,
        timeframe,
        startTrain: cached.startTrain,
        endTrain: cached.endTrain,
        bestWeights: cached.weights,
        bestResult: {
          roi: cached.roi,
          winRate: cached.winRate,
          maxDrawdown: cached.maxDrawdown,
          trades: cached.trades ?? 0,
        },
        candleCount: cached.candleCount,
        updatedAt: cached.updatedAt,
      });
    }

    console.log(`\n🎯 Starting multi-indicator optimization for ${symbol}`);
    const data = await getIndicatorsWithPrices(
      symbol,
      timeframe,
      startEpoch,
      endEpoch
    );

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data found in the requested epoch range.",
      });
    }

    if (data.length < 50) {
      return res.status(400).json({
        success: false,
        message: `Insufficient data for optimization (${data.length}/50 required)`,
      });
    }

    const result = await optimizeIndicatorWeights(data, selectedIndicators, {
      samples: Math.min(Math.max(Number(req.body.samples) || 800, 500), 1200),
      maxDurationSec: 170,
      symbol,
      timeframe,
      startTrain: startEpoch,
      endTrain: endEpoch,
      candleCount: data.length,
    });

    // Persist if service didn't already persist (safety)
    if (!result.persisted && !result.cachedPersist) {
      await prisma.indicatorWeight.upsert({
        where: {
          symbol_timeframe_startTrain_endTrain: {
            symbol,
            timeframe,
            startTrain: BigInt(startEpoch),
            endTrain: BigInt(endEpoch),
          },
        },
        update: {
          weights: result.bestWeights,
          roi: result.bestResult.roi,
          winRate: result.bestResult.winRate,
          maxDrawdown: result.bestResult.maxDrawdown,
          candleCount: data.length,
          trades: result.bestResult.trades ?? 0,
        },
        create: {
          symbol,
          timeframe,
          startTrain: BigInt(startEpoch),
          endTrain: BigInt(endEpoch),
          weights: result.bestWeights,
          roi: result.bestResult.roi,
          winRate: result.bestResult.winRate,
          maxDrawdown: result.bestResult.maxDrawdown,
          candleCount: data.length,
          trades: result.bestResult.trades ?? 0,
        },
      });
    }

    result.symbol = symbol;
    result.timeframe = timeframe;
    result.dataPoints = data.length;
    result.cached = false;
    result.startTrain = BigInt(startEpoch);
    result.endTrain = BigInt(endEpoch);

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

// Helper for backtest max drawdown
function calcMaxDrawdown(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return 0.01;
  let peak = curve[0];
  let maxDD = 0;
  let minVal = curve[0];
  for (const v of curve) {
    if (v > peak) peak = v;
    if (v < minVal) minVal = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  const start = curve[0];
  const baseDD = start > 0 ? ((start - minVal) / start) * 100 : 0;
  const finalDD = Math.max(maxDD, baseDD);
  return +(finalDD > 0 ? finalDD : 0.01).toFixed(2);
}

export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    // 1) Fetch latest optimized weights
    const latest = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: "No optimized weights found for this coin",
      });
    }

    const weights = latest.weights || {};
    const startTrain = latest.startTrain;
    const endTrain = latest.endTrain;

    // 2) Load indicators and candle closes within training window
    const [indicatorData, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: startTrain, lte: endTrain },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: startTrain, lte: endTrain },
        },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    const candleMap = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicatorData
      .map((i) => ({ ...i, close: candleMap.get(i.time.toString()) }))
      .filter((i) => i.close != null);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data found in the optimized period.",
      });
    }

    // 3) Simulate backtest using the optimized weights
    const HOLD_THRESHOLD = 0.15;
    const INITIAL_CAPITAL = 10000;

    let cap = INITIAL_CAPITAL;
    let pos = null;
    let entry = 0;
    let wins = 0;
    let trades = 0;
    const equityCurve = [];

    const indKeys = Object.keys(weights);

    for (let i = 0; i < data.length; i++) {
      const cur = data[i];
      const prev = i > 0 ? data[i - 1] : null;

      const signals = calculateIndividualSignals(cur, prev);

      let combined = 0;
      let totalW = 0;
      for (const k of indKeys) {
        const w = Number(weights[k] ?? 0);
        if (!w) continue;
        const s = scoreSignal(signals[k]);
        combined += w * s;
        totalW += w;
      }

      const combinedScore = totalW > 0 ? combined / totalW : 0;
      const price = cur.close;

      if (combinedScore > HOLD_THRESHOLD && !pos) {
        pos = "BUY";
        entry = price;
      } else if (combinedScore < -HOLD_THRESHOLD && pos === "BUY") {
        const pnl = price - entry;
        if (pnl > 0) wins++;
        cap += (cap / entry) * pnl;
        pos = null;
        trades++;
      }

      equityCurve.push(cap);
    }

    const roi = +(((cap - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100).toFixed(2);
    const winRate = trades ? +((wins / trades) * 100).toFixed(2) : 0;
    const maxDrawdown = calcMaxDrawdown(equityCurve);

    return res.json({
      success: true,
      symbol,
      timeframe,
      bestWeights: weights,
      roi,
      winRate,
      trades,
      maxDrawdown,
      finalCapital: +cap.toFixed(2),
    });
  } catch (err) {
    console.error("❌ backtestWithOptimizedWeights:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
