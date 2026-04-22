/* ============================================================
 📊 TECHNICAL INDICATOR UTILITIES
============================================================ */
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/* --- Signal Logic --- */
const signalFuncs = {
  rsi: (v) => {
    if (v == null) return "neutral";
    return v < RSI_OVERSOLD ? "buy" : v > RSI_OVERBOUGHT ? "sell" : "neutral";
  },
  macd: (m, s, h) => {
    if (m == null || s == null || h == null) return "neutral";
    if (m > s && h > 0) return "buy";
    if (m < s && h < 0) return "sell";
    return "neutral";
  },
  stochastic: (k, d) => {
    if (k == null || d == null) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    return "neutral";
  },
  stochasticRsi: (k, d) => {
    if (k == null || d == null) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    return "neutral";
  },
  sma: (s20, s50, p) =>
    p == null || s20 == null || s50 == null
      ? "neutral"
      : p > s50 && s20 > s50
        ? "buy"
        : p < s50 && s20 < s50
          ? "sell"
          : "neutral",
  ema: (e20, e50) =>
    e20 == null || e50 == null
      ? "neutral"
      : e20 > e50
        ? "buy"
        : e20 < e50
          ? "sell"
          : "neutral",
  psar: (p, ps) =>
    p == null || ps == null
      ? "neutral"
      : p > ps
        ? "buy"
        : p < ps
          ? "sell"
          : "neutral",
  bollingerBands: (p, up, low) => {
    if (p == null || up == null || low == null) return "neutral";
    if (p >= up) return "sell";
    if (p <= low) return "buy";
    return "neutral";
  },
};

/* --- Convert Buy/Sell/Neutral to Score --- */
export const scoreSignal = (s) => (s === "buy" ? 1 : s === "sell" ? -1 : 0);

/* --- Aggregate Signals per Candle --- */
export function calculateIndividualSignals(ind) {
  const p = ind.close;
  return {
    SMA: signalFuncs.sma(ind.sma20, ind.sma50, p),
    EMA: signalFuncs.ema(ind.ema20, ind.ema50),
    RSI: signalFuncs.rsi(ind.rsi),
    MACD: signalFuncs.macd(ind.macd, ind.macdSignalLine, ind.macdHist), // ✅ Standardized MACD naming for consistency
    BollingerBands: signalFuncs.bollingerBands(
      p,
      ind.bbUpper,
      ind.bbLower,
      ind.bbMiddle,
    ),
    Stochastic: signalFuncs.stochastic(ind.stochK, ind.stochD),
    PSAR: signalFuncs.psar(p, ind.psar),
    StochasticRSI: signalFuncs.stochasticRsi(ind.stochRsiK, ind.stochRsiD),
  };
}

/* --- Utility: Max Drawdown --- */
export function calculateMaxDrawDown(curve) {
  let peak = curve?.[0] ?? 0;
  let maxDD = 0;
  for (const v of curve || []) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(2);
}

// Hitung skor multi-indikator berbobot dan normalisasi hasil ke rentang [-1, +1].
// Hasil dipakai untuk analisis sinyal dan pengambilan keputusan otomatis.
export function calculateMultiIndicatorScore(signals, weights) {
  const indicators = Object.keys(weights);
  let weightedSum = 0;
  let totalWeight = 0;

  // Breakdown per indikator untuk transparansi
  const breakdown = [];
  for (const ind of indicators) {
    const w = weights[ind] ?? 0;
    const sig = signals[ind] ?? "neutral";
    const score = scoreSignal(sig); // Convert 'buy'/'sell'/'neutral' to +1/-1/0
    const contribution = w * score;

    weightedSum += contribution;
    totalWeight += w;

    breakdown.push({
      indicator: ind,
      signal: sig,
      weight: w.toFixed(2),
      score,
      contribution: contribution.toFixed(3),
    });
  }

  // FINAL SCORE NORMALIZATION (WAJIB)
  // Normalisasi ke rentang [-1, +1]
  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // SIGNAL CLASSIFICATION (MULTI-LEVEL THRESHOLD)
  let signal = "neutral";
  let signalLabel = "NEUTRAL";

  // Strong thresholds untuk eksekusi trading
  const STRONG_BUY_THRESHOLD = 0.6;
  const STRONG_SELL_THRESHOLD = -0.6;

  if (finalScore >= STRONG_BUY_THRESHOLD) {
    signal = "strong_buy";
    signalLabel = "STRONG BUY";
  } else if (finalScore > 0) {
    signal = "buy";
    signalLabel = "BUY";
  } else if (finalScore <= STRONG_SELL_THRESHOLD) {
    signal = "strong_sell";
    signalLabel = "STRONG SELL";
  } else if (finalScore < 0) {
    signal = "sell";
    signalLabel = "SELL";
  } else {
    // finalScore === 0
    signal = "neutral";
    signalLabel = "NEUTRAL";
  }

  // STRENGTH CALCULATION
  // Strength = absolute value of finalScore
  // Untuk neutral: strength HARUS = 0 (konsistensi)
  let strength = signal === "neutral" ? 0 : Math.abs(finalScore);

  // VALIDATION: Ensure consistency
  if (signal === "neutral" && strength !== 0) {
    strength = 0;
  }

  return {
    finalScore: parseFloat(finalScore.toFixed(3)), // Normalized score [-1, +1]
    strength: parseFloat(strength.toFixed(3)), // Confidence [0, 1]
    signal, // 'buy'/'sell'/'neutral'/'strong_buy'/'strong_sell'
    signalLabel, // 'BUY'/'SELL'/'STRONG BUY'/etc
    normalized: parseFloat(finalScore.toFixed(3)), // Alias untuk finalScore
  };
}
