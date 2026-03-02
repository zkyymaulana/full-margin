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
 * 🎯 CALCULATE WEIGHTED MULTI-INDICATOR SIGNAL (ACADEMIC VERSION)
 * ================================================================
 * Based on: Proposal Skripsi - Analisis Multi-Indikator Teknikal
 *
 * METODOLOGI SESUAI PROPOSAL:
 *
 * 1. FinalScore Calculation (Normalized Weighted Average):
 *    finalScore = Σ(weight_i × signal_i) / Σ(weight_i)
 *
 *    Dimana:
 *    - signal_i ∈ {-1, 0, +1} (dari scoreSignal function)
 *    - weight_i = bobot hasil optimasi (0-4)
 *    - finalScore ∈ [-1, +1] (always normalized)
 *
 * 2. Signal Classification (Multi-Level Threshold):
 *    - finalScore >  0.6  → STRONG_BUY (high confidence bullish)
 *    - finalScore >  0.0  → BUY (bullish sentiment)
 *    - finalScore == 0.0  → NEUTRAL (no clear direction)
 *    - finalScore <  0.0  → SELL (bearish sentiment)
 *    - finalScore < -0.6  → STRONG_SELL (high confidence bearish)
 *
 * 3. Strength (Confidence Level):
 *    strength = |finalScore|
 *    - Nilai 0.0 - 1.0
 *    - Semakin tinggi = semakin yakin
 *    - Untuk neutral: strength HARUS = 0
 *
 * 4. Perbedaan Penggunaan (CRITICAL):
 *
 *    a) UNTUK ANALISIS & DISPLAY (UI/Telegram):
 *       - Gunakan BUY/SELL/STRONG_BUY/STRONG_SELL semua level
 *       - Tampilkan finalScore dan strength
 *       - Membantu user memahami tingkat keyakinan sinyal
 *
 *    b) UNTUK BACKTESTING & TRADING EXECUTION:
 *       - ENTRY: Hanya pada STRONG_BUY (finalScore >= 0.6)
 *       - EXIT: Hanya pada STRONG_SELL (finalScore <= -0.6)
 *       - BUY/SELL biasa diabaikan (hold position)
 *       - Alasan: Noise reduction & risk management
 *
 * 5. Alasan Akademik Threshold Bertingkat:
 *    - Membedakan sinyal lemah (noise) vs sinyal kuat (actionable)
 *    - Mengurangi false signals dari volatilitas pasar
 *    - Meningkatkan win rate dengan high-confidence only execution
 *    - Konsisten dengan ML confidence threshold best practices
 *
 * @param {Object} signals - Individual signals {SMA: 'buy', RSI: 'sell', ...}
 * @param {Object} weights - Optimized weights {SMA: 3, RSI: 4, ...}
 * @returns {Object} { finalScore, strength, signal, signalLabel }
 * ================================================================
 */
export function calculateWeightedSignal(signals, weights) {
  const indicators = Object.keys(weights);
  let weightedSum = 0;
  let totalWeight = 0;

  // ✅ Breakdown per indikator untuk transparansi
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

  // 🎯 FINAL SCORE NORMALIZATION (WAJIB)
  // Normalisasi ke rentang [-1, +1]
  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // 🎯 SIGNAL CLASSIFICATION (MULTI-LEVEL THRESHOLD)
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

  // 🎯 STRENGTH CALCULATION
  // Strength = absolute value of finalScore
  // Untuk neutral: strength HARUS = 0 (konsistensi)
  let strength = signal === "neutral" ? 0 : Math.abs(finalScore);

  // ✅ VALIDATION: Ensure consistency
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
