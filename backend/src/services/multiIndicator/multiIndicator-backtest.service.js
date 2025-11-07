import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";

export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false } = {}
) {
  if (!data?.length) throw new Error("Data historis kosong");

  const HOLD_THRESHOLD = 0.15;
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
    if (!price) continue;

    const signals = calculateIndividualSignals(cur, prev);
    const weighted = keys.map(
      (k) => (weights[k] ?? 0) * scoreSignal(signals[k] ?? "neutral")
    );
    const score = weighted.reduce((a, b) => a + b, 0) / (keys.length || 1);

    // Simple trading rule
    if (score > HOLD_THRESHOLD && !position) {
      position = "BUY";
      entry = price;
    } else if (score < -HOLD_THRESHOLD && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;
    }

    equityCurve.push(capital);
  }

  return {
    success: true,
    methodology: fastMode
      ? "Fast Rule-Based Multi-Indicator Backtest"
      : "Rule-Based Multi-Indicator Backtest",
    roi: +(((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100).toFixed(2),
    winRate: trades ? +((wins / trades) * 100).toFixed(2) : 0,
    trades,
    finalCapital: +capital.toFixed(2),
    maxDrawdown: calcMaxDrawdown(equityCurve),
    dataPoints: data.length,
  };
}
