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
  bollingerBands: (p, up, low, middle) =>
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
    MACD: signalFuncs.macd(ind.macd, ind.macdSignalLine), // ✅ Standardized MACD naming for consistency
    BollingerBands: signalFuncs.bollingerBands(
      p,
      ind.bbUpper,
      ind.bbLower,
      ind.bbMiddle
    ),
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
 * 🔢 Hitung sinyal gabungan berbobot (REFACTORED)
 * 📚 Threshold mengikuti jurnal: threshold = 0
 *
 * Logic:
 * - normalizedScore > 0 → BUY
 * - normalizedScore < 0 → SELL
 * - normalizedScore === 0 → NEUTRAL
 *
 * ✅ KONSISTENSI STRENGTH:
 * - Jika signal = "neutral" → strength HARUS = 0
 * - Jika signal = "buy"/"sell" → strength = Math.abs(normalizedScore)
 */
export function calculateWeightedSignal(signals, weights) {
  const indicators = Object.keys(weights);
  let combined = 0;
  let totalWeight = 0;

  console.log(
    `🔍 [weightedSignal] Calculating for ${indicators.length} indicators...`
  );

  // ✅ Log detail per indikator (breakdown)
  const breakdown = [];
  for (const ind of indicators) {
    const w = weights[ind] ?? 0;
    const sig = signals[ind] ?? "neutral";
    const score = scoreSignal(sig);
    const contribution = w * score;

    combined += contribution;
    totalWeight += w;

    breakdown.push({
      indicator: ind,
      signal: sig,
      weight: w.toFixed(2),
      score,
      contribution: contribution.toFixed(3),
    });
  }

  console.table(breakdown);

  const normalized = totalWeight > 0 ? combined / totalWeight : 0;

  console.log(
    `📊 [weightedSignal] Combined: ${combined.toFixed(3)} / TotalWeight: ${totalWeight.toFixed(3)} = Normalized: ${normalized.toFixed(3)}`
  );

  // ✅ Threshold = 0 sesuai jurnal (tanpa hold zone)
  let signal = "neutral";
  let strength = 0;

  if (normalized > 0) {
    signal = "buy";
    strength = Math.abs(normalized); // ✅ Strength = absolute value
  } else if (normalized < 0) {
    signal = "sell";
    strength = Math.abs(normalized); // ✅ Strength = absolute value
  } else {
    // normalized === 0
    signal = "neutral";
    strength = 0; // ✅ CRITICAL: neutral HARUS strength = 0
  }

  console.log(`✅ [weightedSignal] Final:`, {
    signal,
    strength: strength.toFixed(3),
    normalized: normalized.toFixed(3),
  });

  // ✅ FINAL VALIDATION: Double-check konsistensi
  if (signal === "neutral" && strength !== 0) {
    console.error(
      `❌ [weightedSignal] CRITICAL: neutral escaped with strength ${strength}! Forcing to 0.`
    );
    strength = 0;
  }

  return {
    normalized,
    signal,
    strength, // ✅ Return strength untuk konsistensi
  };
}
