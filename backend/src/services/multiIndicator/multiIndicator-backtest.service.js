import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";
import { calcRiskMetrics } from "../backtest/backtest.utils.js";

/**
 * 📊 Backtest Multi-Indicator Strategy dengan Weighted Signals
 *
 * Metrik evaluasi sesuai skripsi:
 * - ROI (Return on Investment)
 * - Win Rate
 * - Maximum Drawdown (MDD)
 * - Sharpe Ratio
 */
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

  // 📊 Calculate performance metrics based on thesis requirements
  // 1. ROI = ((Final Capital - Initial Capital) / Initial Capital) * 100
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  // 2. Win Rate = (Winning Trades / Total Trades) * 100
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // 3. Maximum Drawdown = (Peak - Lowest After Peak) / Peak * 100
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  // 4. Sharpe Ratio = Average Return / Std Dev of Returns (risk-free rate = 0)
  const { sharpeRatio } = calcRiskMetrics(equityCurve);

  return {
    success: true,
    methodology: fastMode
      ? "Fast Rule-Based Multi-Indicator Backtest"
      : "Rule-Based Multi-Indicator Backtest",
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    maxDrawdown,
    sharpeRatio,
    dataPoints: data.length,
  };
}
