import {
  calculateIndividualSignals,
  scoreSignal,
} from "./multiIndicator-analyzer.service.js";

/**
 * BACKTEST MULTI-INDICATOR STRATEGY
 * ---------------------------------
 * Dijalankan dengan bobot tetap (tanpa optimasi acak).
 * Hasil: ROI, WinRate, MaxDrawdown, Trades.
 */

function calcMaxDrawdown(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return 0.01;
  let peak = curve[0];
  let maxDD = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  return +Math.max(maxDD, 0.01).toFixed(2);
}

export async function backtestWithWeights(data, weights = {}, options = {}) {
  if (!data?.length) throw new Error("Data is required");

  const HOLD_THRESHOLD = options.fastMode
    ? 0.15
    : (options.holdThreshold ?? 0.15);
  const INITIAL = 10000;

  let cap = INITIAL;
  let pos = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  const keys = Object.keys(weights || {});

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const price = cur.close;
    if (!price) {
      equityCurve.push(cap);
      continue;
    }

    const sigs = calculateIndividualSignals(cur, prev);

    let sum = 0;
    let tot = 0;
    for (const k of keys) {
      const normKey = k === "ParabolicSAR" ? "PSAR" : k;
      const w = Number(weights[k] ?? 0);
      if (!w || !(normKey in sigs)) continue;
      const sval = scoreSignal(sigs[normKey]);
      sum += w * sval;
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

  const roi = +(((cap - INITIAL) / INITIAL) * 100).toFixed(2);
  const winRate = trades ? +((wins / trades) * 100).toFixed(2) : 0;
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  return {
    success: true,
    methodology: options.fastMode
      ? "Rule-Based Weighted Multi-Indicator Backtest (fastMode)"
      : "Rule-Based Weighted Multi-Indicator Backtest",
    roi,
    winRate,
    trades,
    finalCapital: +cap.toFixed(2),
    maxDrawdown,
    dataPoints: data.length,
    timestamp: new Date().toISOString(),
  };
}
