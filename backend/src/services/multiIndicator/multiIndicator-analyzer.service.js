/**
 * 🎯 MULTI-INDICATOR ANALYZER SERVICE (Optimized Academic Version)
 * ---------------------------------------------------------------
 * Based on Sukma & Namahoot (2025) – Rule-Based 3-Category System:
 * Momentum, Trend, Volatility
 * Pure manual weighting grid search (ω ∈ {0..4})
 */

const WEIGHT_RANGE = [0, 1, 2, 3, 4];
const INITIAL_CAPITAL = 10000;
const HOLD_THRESHOLD = 0.2;

/* ==========================================================
   🧠 UNIVERSAL SIGNAL FUNCTIONS (Compact Form)
========================================================== */
const signalFuncs = {
  rsi: (v) => (v < 30 ? "buy" : v > 70 ? "sell" : "neutral"),
  macd: (m, s, h) =>
    m && s && h != null
      ? m > s && h > 0
        ? "buy"
        : m < s && h < 0
          ? "sell"
          : "neutral"
      : "neutral",
  stochastic: (k, d) =>
    k && d
      ? k > 80 && d > 80
        ? "sell"
        : k < 20 && d < 20
          ? "buy"
          : "neutral"
      : "neutral",
  stochasticRsi: (k, d) =>
    k && d
      ? k > 80 && d > 80
        ? "sell"
        : k < 20 && d < 20
          ? "buy"
          : "neutral"
      : "neutral",
  sma: (s20, s50, p) =>
    p && s20 && s50
      ? p > s20 && p > s50 && s20 > s50
        ? "buy"
        : p < s20 && p < s50 && s20 < s50
          ? "sell"
          : "neutral"
      : "neutral",
  ema: (e20, e50, p) =>
    p && e20 && e50
      ? p > e20 && p > e50 && e20 > e50
        ? "buy"
        : p < e20 && p < e50 && e20 < e50
          ? "sell"
          : "neutral"
      : "neutral",
  psar: (p, ps) =>
    !p || !ps ? "neutral" : p > ps ? "buy" : p < ps ? "sell" : "neutral",
  bollingerBands: (p, up, low) => {
    if (!p || !up || !low) return "neutral";
    const w = up - low;
    return p > up - w * 0.1 ? "sell" : p < low + w * 0.1 ? "buy" : "neutral";
  },
};

const score = (s) => (s === "buy" ? 1 : s === "sell" ? -1 : 0);

/* ==========================================================
   ⚙️ CATEGORY SCORE CALCULATION
========================================================== */
function calcCategoryScores(ind) {
  const p = ind.close;
  const s = {
    rsi: signalFuncs.rsi(ind.rsi),
    macd: signalFuncs.macd(ind.macd, ind.macdSignal, ind.macdHist),
    stochastic: signalFuncs.stochastic(ind.stochK, ind.stochD),
    stochasticRsi: signalFuncs.stochasticRsi(ind.stochRsiK, ind.stochRsiD),
    sma: signalFuncs.sma(ind.sma20, ind.sma50, p),
    ema: signalFuncs.ema(ind.ema20, ind.ema50, p),
    psar: signalFuncs.psar(p, ind.psar),
    boll: signalFuncs.bollingerBands(p, ind.bbUpper, ind.bbLower),
  };

  return {
    momentum:
      ["rsi", "macd", "stochastic", "stochasticRsi"].reduce(
        (a, k) => a + score(s[k]),
        0
      ) / 4,
    trend: ["sma", "ema", "psar"].reduce((a, k) => a + score(s[k]), 0) / 3,
    volatility: score(s.boll),
    signals: s,
  };
}

const weightedScore = (sc, w) => {
  const sum = w.momentum + w.trend + w.volatility;
  return sum === 0
    ? 0
    : (w.momentum * sc.momentum +
        w.trend * sc.trend +
        w.volatility * sc.volatility) /
        sum;
};
const decision = (s) =>
  s > HOLD_THRESHOLD ? "BUY" : s < -HOLD_THRESHOLD ? "SELL" : "HOLD";

/* ==========================================================
   📈 SIMPLE BACKTEST ENGINE
========================================================== */
function backtest(data, w) {
  let cap = INITIAL_CAPITAL,
    pos = null,
    entry = 0,
    wins = 0,
    trades = 0;

  for (const c of data) {
    const sc = calcCategoryScores(c);
    const dec = decision(weightedScore(sc, w));
    const price = c.close;

    if (dec === "BUY" && !pos) {
      pos = "BUY";
      entry = price;
    } else if (dec === "SELL" && pos === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      cap += (cap / entry) * pnl;
      pos = null;
      trades++;
    }
  }

  const roi = ((cap - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  return {
    roi: +roi.toFixed(2),
    winRate: trades ? +((wins / trades) * 100).toFixed(2) : 0,
    trades,
    finalCapital: +cap.toFixed(2),
  };
}

/* ==========================================================
   🧩 GRID SEARCH GENERATOR
========================================================== */
const weightCombos = () => {
  const out = [];
  for (const m of WEIGHT_RANGE)
    for (const t of WEIGHT_RANGE)
      for (const v of WEIGHT_RANGE)
        if (m + t + v) out.push({ momentum: m, trend: t, volatility: v });
  return out;
};

/* ==========================================================
   🚀 MAIN ANALYSIS FUNCTION (GRID SEARCH)
========================================================== */
export async function analyzeMultiIndicatorGridSearch(
  data,
  symbol = "BTC-USD"
) {
  if (!data?.length)
    throw new Error("Historical data is required for analysis.");

  console.log(`🚀 Grid search ${symbol} (${data.length} data points)...`);
  const combos = weightCombos();
  let best = null;

  const results = combos.map((w, i) => {
    const r = backtest(data, w);
    if (!best || r.roi > best.roi) best = { ...r, w };
    if ((i + 1) % 25 === 0) console.log(`✅ Tested ${i + 1}/${combos.length}`);
    return { weights: w, ...r };
  });

  results.sort((a, b) => b.roi - a.roi);
  console.log(`🏆 Best ROI: ${best.roi}% with`, best.w);

  return {
    success: true,
    symbol,
    methodology:
      "Manual rule-based 3-category weighting (ω ∈ {0..4}) – Sukma & Namahoot (2025)",
    bestWeights: best.w,
    bestResult: { roi: best.roi, winRate: best.winRate, trades: best.trades },
    topResults: results.slice(0, 10),
    totalCombinations: results.length,
    timestamp: new Date().toISOString(),
  };
}

/* ==========================================================
   🧩 PREVIEW MODE (SINGLE POINT)
========================================================== */
export function analyzeMultiIndicatorWithWeights(indicator, weights) {
  const s = calcCategoryScores(indicator);
  const total = weightedScore(s, weights);
  return {
    multiIndicator: decision(total),
    totalScore: +total.toFixed(3),
    weights,
    categoryScores: {
      momentum: +s.momentum.toFixed(3),
      trend: +s.trend.toFixed(3),
      volatility: +s.volatility.toFixed(3),
    },
    signals: s.signals,
  };
}

/* ==========================================================
   🧩 DEFAULT ACADEMIC VERSION (Fixed Weights)
========================================================== */
export function analyzeMultiIndicator(indicator) {
  return analyzeMultiIndicatorWithWeights(indicator, {
    momentum: 3,
    trend: 2,
    volatility: 1,
  });
}
