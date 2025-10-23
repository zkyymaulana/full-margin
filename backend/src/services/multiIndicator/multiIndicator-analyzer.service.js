/**
 * 🎯 MULTI-INDICATOR ANALYZER SERVICE (Enhanced Academic Version)
 * ---------------------------------------------------------------
 * Based on Academic Standards for Technical Analysis Research
 * Enhanced Rule-Based 3-Category System: Momentum, Trend, Volatility
 * Improved signal logic and scoring methodology
 */

const WEIGHT_RANGE = [0, 1, 2, 3, 4];
const INITIAL_CAPITAL = 10000;
const HOLD_THRESHOLD = 0.15; // Reduced for more sensitive signals
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/* ==========================================================
   🧠 ENHANCED SIGNAL FUNCTIONS (Academic Standards)
========================================================== */
const signalFuncs = {
  // RSI: Enhanced with multiple threshold levels
  rsi: (v) => {
    if (v < RSI_OVERSOLD) return "strong_buy";
    if (v < 40) return "buy";
    if (v > RSI_OVERBOUGHT) return "strong_sell";
    if (v > 60) return "sell";
    return "neutral";
  },

  // MACD: Enhanced with histogram momentum
  macd: (m, s, h, prevH) => {
    if (!m || !s || h == null) return "neutral";

    // MACD line crossover
    const macdCross = m > s ? 1 : m < s ? -1 : 0;

    // Histogram momentum (acceleration/deceleration)
    let histMomentum = 0;
    if (prevH != null) {
      if (h > 0 && h > prevH) histMomentum = 1; // Accelerating up
      if (h < 0 && h < prevH) histMomentum = -1; // Accelerating down
    }

    const score = macdCross + histMomentum;
    if (score >= 2) return "strong_buy";
    if (score >= 1) return "buy";
    if (score <= -2) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  // Enhanced Stochastic with divergence detection
  stochastic: (k, d, prevK, prevD) => {
    if (!k || !d) return "neutral";

    // Oversold/Overbought conditions
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
      // Check for bullish divergence (price falling but stoch rising)
      if (prevK && prevD && k > prevK && d > prevD) return "strong_buy";
      return "buy";
    }

    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
      // Check for bearish divergence (price rising but stoch falling)
      if (prevK && prevD && k < prevK && d < prevD) return "strong_sell";
      return "sell";
    }

    // %K crossing %D
    if (k > d && prevK && prevD && prevK <= prevD) return "buy";
    if (k < d && prevK && prevD && prevK >= prevD) return "sell";

    return "neutral";
  },

  // Enhanced Stochastic RSI
  stochasticRsi: (k, d, prevK, prevD) => {
    if (!k || !d) return "neutral";

    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
      if (prevK && prevD && k > prevK && d > prevD) return "strong_buy";
      return "buy";
    }

    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
      if (prevK && prevD && k < prevK && d < prevD) return "strong_sell";
      return "sell";
    }

    return "neutral";
  },

  // Enhanced SMA with multiple timeframe confirmation
  sma: (s20, s50, s200, p, prevS20, prevS50) => {
    if (!p || !s20 || !s50) return "neutral";

    let score = 0;

    // Price position relative to moving averages
    if (p > s20) score += 1;
    if (p > s50) score += 1;
    if (s200 && p > s200) score += 1;

    // Moving average alignment (trend strength)
    if (s20 > s50) score += 1;
    if (s200 && s50 > s200) score += 1;

    // Moving average momentum (acceleration)
    if (prevS20 && prevS50) {
      if (s20 > prevS20 && s50 > prevS50) score += 1;
      if (s20 < prevS20 && s50 < prevS50) score -= 1;
    }

    // Score interpretation
    if (score >= 5) return "strong_buy";
    if (score >= 3) return "buy";
    if (score <= -3) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  // Enhanced EMA (similar to SMA but more responsive)
  ema: (e20, e50, e200, p, prevE20, prevE50) => {
    if (!p || !e20 || !e50) return "neutral";

    let score = 0;

    if (p > e20) score += 1;
    if (p > e50) score += 1;
    if (e200 && p > e200) score += 1;
    if (e20 > e50) score += 1;
    if (e200 && e50 > e200) score += 1;

    if (prevE20 && prevE50) {
      if (e20 > prevE20 && e50 > prevE50) score += 1;
      if (e20 < prevE20 && e50 < prevE50) score -= 1;
    }

    if (score >= 5) return "strong_buy";
    if (score >= 3) return "buy";
    if (score <= -3) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  // Enhanced Parabolic SAR with trend strength
  psar: (p, ps, prevP, prevPS) => {
    if (!p || !ps) return "neutral";

    const currentSignal = p > ps ? "buy" : p < ps ? "sell" : "neutral";

    // Check for trend change (signal confirmation)
    if (prevP && prevPS) {
      const prevSignal =
        prevP > prevPS ? "buy" : prevP < prevPS ? "sell" : "neutral";

      // New bullish trend
      if (currentSignal === "buy" && prevSignal === "sell") return "strong_buy";
      // New bearish trend
      if (currentSignal === "sell" && prevSignal === "buy")
        return "strong_sell";
    }

    return currentSignal;
  },

  // Enhanced Bollinger Bands with squeeze detection
  bollingerBands: (p, up, mid, low, prevUp, prevLow) => {
    if (!p || !up || !mid || !low) return "neutral";

    const width = up - low;
    const position = (p - low) / width; // 0 = bottom, 1 = top

    // Bollinger Band squeeze detection
    let squeeze = false;
    if (prevUp && prevLow) {
      const prevWidth = prevUp - prevLow;
      squeeze = width < prevWidth * 0.95; // Width contracting
    }

    // Signal generation
    if (position <= 0.1) {
      // Near lower band
      return squeeze ? "strong_buy" : "buy";
    }
    if (position >= 0.9) {
      // Near upper band
      return squeeze ? "strong_sell" : "sell";
    }

    // Middle band bounce
    if (position >= 0.4 && position <= 0.6) return "neutral";

    return position < 0.5 ? "buy" : "sell";
  },
};

// Enhanced scoring system with signal strength weights
const scoreSignal = (signal) => {
  switch (signal) {
    case "strong_buy":
      return 2;
    case "buy":
      return 1;
    case "neutral":
      return 0;
    case "sell":
      return -1;
    case "strong_sell":
      return -2;
    default:
      return 0;
  }
};

/* ==========================================================
   ⚙️ ENHANCED CATEGORY SCORE CALCULATION
========================================================== */
function calcCategoryScores(ind, prevInd = null) {
  const p = ind.close;
  const prevP = prevInd?.close;

  // Enhanced signal calculations with previous values for trend detection
  const signals = {
    rsi: signalFuncs.rsi(ind.rsi),
    macd: signalFuncs.macd(
      ind.macd,
      ind.macdSignal,
      ind.macdHist,
      prevInd?.macdHist
    ),
    stochastic: signalFuncs.stochastic(
      ind.stochK,
      ind.stochD,
      prevInd?.stochK,
      prevInd?.stochD
    ),
    stochasticRsi: signalFuncs.stochasticRsi(
      ind.stochRsiK,
      ind.stochRsiD,
      prevInd?.stochRsiK,
      prevInd?.stochRsiD
    ),
    sma: signalFuncs.sma(
      ind.sma20,
      ind.sma50,
      ind.sma200,
      p,
      prevInd?.sma20,
      prevInd?.sma50
    ),
    ema: signalFuncs.ema(
      ind.ema20,
      ind.ema50,
      ind.ema200,
      p,
      prevInd?.ema20,
      prevInd?.ema50
    ),
    psar: signalFuncs.psar(p, ind.psar, prevP, prevInd?.psar),
    boll: signalFuncs.bollingerBands(
      p,
      ind.bbUpper,
      ind.bbMiddle,
      ind.bbLower,
      prevInd?.bbUpper,
      prevInd?.bbLower
    ),
  };

  // Calculate weighted category scores
  const momentum =
    scoreSignal(signals.rsi) * 0.4 +
    scoreSignal(signals.macd) * 0.3 +
    scoreSignal(signals.stochastic) * 0.2 +
    scoreSignal(signals.stochasticRsi) * 0.1;

  const trend =
    scoreSignal(signals.sma) * 0.4 +
    scoreSignal(signals.ema) * 0.4 +
    scoreSignal(signals.psar) * 0.2;

  const volatility = scoreSignal(signals.boll);

  return {
    momentum: +momentum.toFixed(3),
    trend: +trend.toFixed(3),
    volatility: +volatility.toFixed(3),
    signals,
    signalStrength: {
      momentum: Math.abs(momentum),
      trend: Math.abs(trend),
      volatility: Math.abs(volatility),
    },
  };
}

/* ==========================================================
   📈 SIMPLE BACKTEST ENGINE
========================================================== */
function backtest(data, w) {
  let cap = INITIAL_CAPITAL,
    pos = null,
    entry = 0,
    wins = 0,
    trades = 0;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const prevC = i > 0 ? data[i - 1] : null;
    const sc = calcCategoryScores(c, prevC);
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
      "Manual rule-based 3-category weighting (ω ∈ {0..4}) – Enhanced Academic Standards",
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

/* ==========================================================
   🛠️ HELPER FUNCTIONS
========================================================== */
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
