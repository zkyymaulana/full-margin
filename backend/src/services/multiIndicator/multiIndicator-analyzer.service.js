import { backtestWithWeights } from "./multiIndicator-backtest.service.js";

const GROUPS = {
  TREND: ["SMA", "EMA", "PSAR"],
  MOMENTUM: ["RSI", "MACD", "Stochastic", "StochasticRSI"],
  VOLATILITY: ["BollingerBands"],
};

const BASE_WEIGHTS = {
  SMA: 1.5,
  EMA: 1.5,
  PSAR: 1.0,
  RSI: 1.0,
  MACD: 1.0,
  Stochastic: 0.8,
  StochasticRSI: 0.8,
  BollingerBands: 1.2,
};

const COMBOS = [
  { name: "Trend Only", indicators: GROUPS.TREND },
  { name: "Momentum Only", indicators: GROUPS.MOMENTUM },
  { name: "Volatility Only", indicators: GROUPS.VOLATILITY },
  {
    name: "Trend + Momentum",
    indicators: [...GROUPS.TREND, ...GROUPS.MOMENTUM],
  },
  {
    name: "All Combined",
    indicators: [...GROUPS.TREND, ...GROUPS.MOMENTUM, ...GROUPS.VOLATILITY],
  },
];

export async function optimizeIndicatorWeights(data) {
  const results = [];
  for (const combo of COMBOS) {
    const weights = Object.fromEntries(
      combo.indicators.map((k) => [k, BASE_WEIGHTS[k]])
    );
    const res = await backtestWithWeights(data, weights, { fastMode: true });
    results.push({
      combo: combo.name,
      indicators: combo.indicators,
      weights,
      ...res,
    });
  }

  const best = results.reduce((a, b) => (b.roi > a.roi ? b : a));
  const sum = Object.values(best.weights).reduce((a, b) => a + b, 0);
  const normalized = Object.fromEntries(
    Object.entries(best.weights).map(([k, v]) => [
      k,
      +((v / sum) * 10).toFixed(2),
    ])
  );

  return {
    success: true,
    methodology:
      "Rule-Based Multi-Indicator Evaluation (Sukma & Namahoot, 2025)",
    bestCombo: best.combo,
    bestWeights: normalized,
    performance: (({ roi, winRate, maxDrawdown, trades }) => ({
      roi,
      winRate,
      maxDrawdown,
      trades,
    }))(best),
    allResults: results,
  };
}
