/* ============================================================
 📊 TECHNICAL INDICATOR UTILITIES
============================================================ */
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/* --- Signal Logic --- */
export const signalFuncs = {
  rsi: (v) =>
    v < RSI_OVERSOLD ? "buy" : v > RSI_OVERBOUGHT ? "sell" : "neutral",
  macd: (m, s) =>
    !m || !s ? "neutral" : m > s ? "buy" : m < s ? "sell" : "neutral",
  stochastic: (k, d) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    return k > d ? "buy" : k < d ? "sell" : "neutral";
  },
  stochasticRsi: (k, d) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
    return "neutral";
  },
  sma: (s20, s50, p) =>
    !p || !s20 || !s50
      ? "neutral"
      : p > s20 && s20 > s50
        ? "buy"
        : p < s20 && s20 < s50
          ? "sell"
          : "neutral",
  ema: (e20, e50, p) =>
    !p || !e20 || !e50
      ? "neutral"
      : p > e20 && e20 > e50
        ? "buy"
        : p < e20 && e20 < e50
          ? "sell"
          : "neutral",
  psar: (p, ps) =>
    !p || !ps ? "neutral" : p > ps ? "buy" : p < ps ? "sell" : "neutral",
  bollingerBands: (p, up, low) =>
    !p || !up || !low
      ? "neutral"
      : p < low
        ? "buy"
        : p > up
          ? "sell"
          : "neutral",
};

/* --- Convert Buy/Sell/Neutral to Score --- */
export const scoreSignal = (s) => (s === "buy" ? 1 : s === "sell" ? -1 : 0);

/* --- Aggregate Signals per Candle --- */
export function calculateIndividualSignals(ind) {
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

/* --- Utility: Max Drawdown --- */
export function calcMaxDrawdown(curve) {
  let peak = curve?.[0] ?? 0;
  let maxDD = 0;
  for (const v of curve || []) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +Math.max(maxDD, 0.01).toFixed(2);
}

/**
 * 🔢 Hitung sinyal gabungan berbobot
 */
export function calculateWeightedSignal(signals, weights, threshold = 0.15) {
  const indicators = Object.keys(weights);
  let combined = 0,
    total = 0;

  for (const ind of indicators) {
    const w = weights[ind] ?? 0;
    combined += w * scoreSignal(signals[ind] ?? "neutral");
    total += w;
  }

  const normalized = total > 0 ? combined / total : 0;
  return {
    normalized,
    signal:
      normalized > threshold
        ? "buy"
        : normalized < -threshold
          ? "sell"
          : "neutral",
  };
}
