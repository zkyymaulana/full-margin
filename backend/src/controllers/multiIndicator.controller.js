// src/controllers/multiIndicator.controller.js
import { prisma } from "../lib/prisma.js";
import {
  // pakai alias supaya jelas ini versi rule-based dari servicemu
  optimizeIndicatorWeights as optimizeRuleBased,
  calculateIndividualSignals,
  scoreSignal,
} from "../services/multiIndicator/multiIndicator-analyzer.service.js";

/* ==========================================================
   🔧 HELPER: Ambil indikator + harga (close) pada rentang epoch
========================================================== */
async function getIndicatorsWithPrices(
  symbol,
  timeframe,
  startEpoch,
  endEpoch
) {
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

  if (!indicatorData?.length || !candles?.length) {
    console.warn(
      "⚠️  Data indikator atau candle kosong untuk:",
      symbol,
      timeframe
    );
  }

  const candleMap = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicatorData
    .map((i) => ({
      ...i,
      close: candleMap.get(i.time.toString()),
    }))
    .filter((i) => i.close != null);

  console.log(`✅ Loaded ${data.length} rows in ${Date.now() - t0}ms`);
  return data;
}

/* ==========================================================
   🧮 UTIL: Max Drawdown dari equity curve
========================================================== */
function calcMaxDrawdown(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return 0.01;
  let peak = curve[0];
  let maxDD = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +Math.max(maxDD, 0.01).toFixed(2);
}

/* ==========================================================
   🎯 OPTIMIZE MULTI-INDICATOR WEIGHTS (Rule-Based)
   Konsisten dengan Sukma & Namahoot (2025)
========================================================== */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    // kalau mau fleksibel, bisa ambil dari query: ?timeframe=1h
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    // Window tetap (ikuti servicemu)
    const startEpoch = new Date("2020-01-01T00:00:00Z").getTime();
    const endEpoch = new Date("2025-01-01T00:00:00Z").getTime();

    console.log(
      `\n🎯 Starting rule-based optimization for ${symbol} (${timeframe})`
    );

    const data = await getIndicatorsWithPrices(
      symbol,
      timeframe,
      startEpoch,
      endEpoch
    );

    if (!data.length) {
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

    // Jalankan evaluasi/optimasi rule-based dari service
    // Pastikan service-mu men‐return { methodology, bestCombo, bestWeights, performance, allResults }
    const result = await optimizeRuleBased(data);

    // Safety guard kalau struktur balikannya tidak lengkap
    if (!result || !result.bestWeights || !result.performance) {
      return res.status(500).json({
        success: false,
        message: "Optimization service did not return expected fields.",
      });
    }

    // Simpan hasil terbaik ke DB (gunakan composite unique key)
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
        roi: result.performance.roi,
        winRate: result.performance.winRate,
        maxDrawdown: result.performance.maxDrawdown,
        candleCount: data.length,
        trades: result.performance.trades ?? 0,
      },
      create: {
        symbol,
        timeframe,
        startTrain: BigInt(startEpoch),
        endTrain: BigInt(endEpoch),
        weights: result.bestWeights,
        roi: result.performance.roi,
        winRate: result.performance.winRate,
        maxDrawdown: result.performance.maxDrawdown,
        candleCount: data.length,
        trades: result.performance.trades ?? 0,
      },
    });

    // Jangan kirim BigInt di JSON (ubah ke Number)
    return res.json({
      success: true,
      symbol,
      timeframe,
      methodology: result.methodology,
      bestCombo: result.bestCombo,
      bestWeights: result.bestWeights,
      performance: result.performance,
      allResults: result.allResults,
      dataPoints: data.length,
      startTrain: startEpoch,
      endTrain: endEpoch,
    });
  } catch (err) {
    console.error("❌ optimizeIndicatorWeights:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Unknown error",
    });
  }
}

/* ==========================================================
   📈 BACKTEST MENGGUNAKAN WEIGHTS TERBARU DI DB
========================================================== */
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    // Ambil bobot terbaru
    const latest = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: "No optimized weights found for this coin/timeframe.",
      });
    }

    const weights = latest.weights || {};
    const startTrain = latest.startTrain; // BigInt
    const endTrain = latest.endTrain; // BigInt

    // Muat kembali data pada periode training (konsisten)
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

    if (!data.length) {
      return res.status(400).json({
        success: false,
        message: "No data found in the optimized period.",
      });
    }

    // Backtest sederhana dengan scoring ter‐normalisasi
    const HOLD_THRESHOLD = 0.15;
    const INITIAL_CAPITAL = 10000;

    let cap = INITIAL_CAPITAL;
    let pos = null; // "BUY" atau null
    let entry = 0;
    let wins = 0;
    let trades = 0;
    const equityCurve = [];

    const indKeys = Object.keys(weights);

    for (let i = 0; i < data.length; i++) {
      const cur = data[i];
      const prev = i > 0 ? data[i - 1] : null;
      const price = cur.close;

      const signals = calculateIndividualSignals(cur, prev);

      let sum = 0;
      let tot = 0;
      for (const k of indKeys) {
        const w = Number(weights[k] ?? 0);
        if (!w) continue;
        // scoreSignal sekarang hanya -1, 0, 1 (tanpa strong)
        const sVal = scoreSignal(signals[k]);
        sum += w * sVal;
        tot += w;
      }

      const score = tot > 0 ? sum / tot : 0;

      if (score > HOLD_THRESHOLD && !pos) {
        pos = "BUY";
        entry = price;
      } else if (score < -HOLD_THRESHOLD && pos === "BUY") {
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
      methodology: "Rule-Based Weighted Multi-Indicator Backtest",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ backtestWithOptimizedWeights:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Unknown error",
    });
  }
}
