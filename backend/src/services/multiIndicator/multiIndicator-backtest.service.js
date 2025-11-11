import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";
import { calcRiskMetrics } from "../backtest/backtest.utils.js";

export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false } = {}
) {
  if (!data?.length) throw new Error("Data historis kosong");

  const INITIAL_CAPITAL = 10_000;
  let capital = INITIAL_CAPITAL;
  let position = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  const keys = Object.keys(weights);

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i ? data[i - 1] : null;
    const price = cur.close;
    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    const signals = calculateIndividualSignals(cur, prev);
    const weighted = keys.map(
      (k) => (weights[k] ?? 0) * scoreSignal(signals[k] ?? "neutral")
    );
    const score = weighted.reduce((a, b) => a + b, 0) / (keys.length || 1);

    // Sesuai jurnal Sukma (2025): tanpa threshold
    if (score > 0 && !position) {
      position = "BUY";
      entry = price;
    } else if (score < 0 && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;
    }

    equityCurve.push(capital);
  }

  // Close any open position at the end
  if (position === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  // Calculate risk metrics (Sharpe & Sortino Ratio)
  const { sharpeRatio, sortinoRatio } = calcRiskMetrics(equityCurve);

  return {
    success: true,
    methodology: fastMode
      ? "Fast Rule-Based Multi-Indicator Backtest"
      : "Rule-Based Multi-Indicator Backtest",
    roi: +(((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100).toFixed(2),
    winRate: trades ? +((wins / trades) * 100).toFixed(2) : 0,
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    maxDrawdown: calcMaxDrawdown(equityCurve),
    sharpeRatio,
    sortinoRatio,
    dataPoints: data.length,
  };
}
