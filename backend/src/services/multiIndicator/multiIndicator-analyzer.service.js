import { prisma } from "../../lib/prisma.js";
import { backtestWithWeights } from "./multiIndicator-backtest.service.js";

/**
 * 🎯 MULTI-INDICATOR ANALYZER SERVICE (Simplified Rule-Based)
 * ------------------------------------------------------------
 * - Hanya tiga jenis sinyal: BUY, NEUTRAL, SELL
 * - Mengikuti pendekatan Sukma & Namahoot (2025):
 *   kombinasi kategori indikator (Trend, Momentum, Volatility)
 * - Tanpa optimasi acak atau algoritmik
 */

// ===========================
// KONSTANTA PARAMETER
// ===========================
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

// ===========================
// SIGNAL FUNCTIONS
// ===========================
const signalFuncs = {
  rsi: (v) => {
    if (v < RSI_OVERSOLD) return "buy";
    if (v > RSI_OVERBOUGHT) return "sell";
    return "neutral";
  },

  macd: (m, s) => {
    if (!m || !s) return "neutral";
    if (m > s) return "buy";
    if (m < s) return "sell";
    return "neutral";
  },

  stochastic: (k, d) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    if (k > d) return "buy";
    if (k < d) return "sell";
    return "neutral";
  },

  stochasticRsi: (k, d) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    return "neutral";
  },

  sma: (s20, s50, p) => {
    if (!p || !s20 || !s50) return "neutral";
    if (p > s20 && s20 > s50) return "buy";
    if (p < s20 && s20 < s50) return "sell";
    return "neutral";
  },

  ema: (e20, e50, p) => {
    if (!p || !e20 || !e50) return "neutral";
    if (p > e20 && e20 > e50) return "buy";
    if (p < e20 && e20 < e50) return "sell";
    return "neutral";
  },

  psar: (p, ps) => {
    if (!p || !ps) return "neutral";
    if (p > ps) return "buy";
    if (p < ps) return "sell";
    return "neutral";
  },

  bollingerBands: (p, up, low) => {
    if (!p || !up || !low) return "neutral";
    if (p < low) return "buy";
    if (p > up) return "sell";
    return "neutral";
  },
};

// ===========================
// SIGNAL SCORING (tanpa "strong")
// ===========================
const scoreSignal = (signal) => {
  switch (signal) {
    case "buy":
      return 1;
    case "neutral":
      return 0;
    case "sell":
      return -1;
    default:
      return 0;
  }
};

// ===========================
// SIGNAL AGGREGATOR
// ===========================
function calculateIndividualSignals(ind, prevInd = null) {
  const p = ind.close;

  return {
    SMA: signalFuncs.sma(ind.sma20, ind.sma50, p),
    EMA: signalFuncs.ema(ind.ema20, ind.ema50, p),
    RSI: signalFuncs.rsi(ind.rsi),
    MACD: signalFuncs.macd(ind.macd, ind.macdSignal ?? ind.macdSignalLine),
    BollingerBands: signalFuncs.bollingerBands(p, ind.bbUpper, ind.bbLower),
    Stochastic: signalFuncs.stochastic(ind.stochK, ind.stochD),
    PSAR: signalFuncs.psar(p, ind.psar),
    StochasticRSI: signalFuncs.stochasticRsi(ind.stochRsiK, ind.stochRsiD),
  };
}

// ===========================
// RULE-BASED OPTIMIZATION ala Sukma & Namahoot (2025)
// ===========================
export async function optimizeIndicatorWeights(data, options = {}) {
  if (!data?.length) throw new Error("Data historis tidak ditemukan");

  const TREND = ["SMA", "EMA", "PSAR"];
  const MOMENTUM = ["RSI", "MACD", "Stochastic", "StochasticRSI"];
  const VOLATILITY = ["BollingerBands"];

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

  const COMBINATIONS = [
    { name: "Trend Only", indicators: TREND },
    { name: "Momentum Only", indicators: MOMENTUM },
    { name: "Volatility Only", indicators: VOLATILITY },
    { name: "Trend + Momentum", indicators: [...TREND, ...MOMENTUM] },
    {
      name: "Trend + Momentum + Volatility",
      indicators: [...TREND, ...MOMENTUM, ...VOLATILITY],
    },
  ];

  const results = [];

  for (const combo of COMBINATIONS) {
    const weights = {};
    combo.indicators.forEach((key) => {
      weights[key] = BASE_WEIGHTS[key];
    });

    const res = await backtestWithWeights(data, weights, { fastMode: true });
    results.push({
      combo: combo.name,
      indicators: combo.indicators,
      weights,
      ...res,
    });

    console.log(
      `✅ ${combo.name}: ROI ${res.roi}% | WR ${res.winRate}% | DD ${res.maxDrawdown}%`
    );
  }

  const best = results.reduce((a, b) => (b.roi > a.roi ? b : a));

  return {
    success: true,
    methodology:
      "Rule-Based Multi-Indicator Evaluation (Sukma & Namahoot, 2025)",
    combinationsTested: results.length,
    bestCombo: best.combo,
    bestWeights: best.weights,
    performance: {
      roi: best.roi,
      winRate: best.winRate,
      maxDrawdown: best.maxDrawdown,
      trades: best.trades,
    },
    allResults: results,
  };
}

export { calculateIndividualSignals, scoreSignal };
