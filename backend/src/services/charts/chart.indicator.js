/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📈 CHART INDICATOR - FORMATTING & SIGNAL CALCULATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TUJUAN MODUL:
 * ─────────────
 * Modul ini menangani konversi dan formatting data indikator dari database
 * menjadi struktur yang siap ditampilkan di frontend.
 * Tanggung jawab utama:
 * • Format individual indicator values dari database
 * • Hitung dan format multi-signal dari weighted combination
 * • Kategorisasi signal (BUY/SELL/NEUTRAL) dengan strength
 * • Hitung category scores (trend, momentum, volatility)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 📊 Format individual indicator values menjadi struktur yang terstandar
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengkonversi raw indicator values dari database menjadi struktur
 * terstandar yang mudah dipahami di frontend dengan pengelompokan
 * berdasarkan kategori (trend, momentum, volatility).
 *
 * Parameter:
 *   sma20, sma50, smaSignal, ema20, ema50, emaSignal, rsi, rsiSignal,
 *   macd, macdSignalLine, macdHist, macdSignal, bbUpper, bbMiddle, bbLower,
 *   bbSignal, stochK, stochD, stochSignal, stochRsiK, stochRsiD,
 *   stochRsiSignal, psar, psarSignal
 *
 * Return:
 *   {
 *     sma: { 20, 50, signal },
 *     ema: { 20, 50, signal },
 *     rsi: { 14, signal },
 *     macd: { macd, signalLine, histogram, signal },
 *     bollingerBands: { upper, middle, lower, signal },
 *     stochastic: { "%K", "%D", signal },
 *     stochasticRsi: { "%K", "%D", signal },
 *     parabolicSar: { value, signal }
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
export function formatIndicators(ind) {
  return {
    // ✅ SMA (Simple Moving Average) - Trend indicator
    sma: {
      20: ind.sma20,
      50: ind.sma50,
      signal: ind.smaSignal || "neutral",
    },

    // ✅ EMA (Exponential Moving Average) - Trend indicator
    ema: {
      20: ind.ema20,
      50: ind.ema50,
      signal: ind.emaSignal || "neutral",
    },

    // ✅ RSI (Relative Strength Index) - Momentum indicator
    rsi: {
      14: ind.rsi,
      signal: ind.rsiSignal || "neutral",
    },

    // ✅ MACD (Moving Average Convergence Divergence) - Momentum indicator
    macd: {
      macd: ind.macd,
      signalLine: ind.macdSignalLine,
      histogram: ind.macdHist,
      signal: ind.macdSignal || "neutral",
    },

    // ✅ Bollinger Bands - Volatility indicator
    bollingerBands: {
      upper: ind.bbUpper,
      middle: ind.bbMiddle,
      lower: ind.bbLower,
      signal: ind.bbSignal || "neutral",
    },

    // ✅ Stochastic - Momentum indicator
    stochastic: {
      "%K": ind.stochK,
      "%D": ind.stochD,
      signal: ind.stochSignal || "neutral",
    },

    // ✅ Stochastic RSI - Momentum indicator (RSI of RSI)
    stochasticRsi: {
      "%K": ind.stochRsiK,
      "%D": ind.stochRsiD,
      signal: ind.stochRsiSignal || "neutral",
    },

    // ✅ Parabolic SAR - Trend indicator
    parabolicSar: {
      value: ind.psar,
      signal: ind.psarSignal || "neutral",
    },
  };
}

/**
 * 🎯 Format multi-signal dari weighted combination indicator
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Menggabungkan signal dari 8 indikator dengan bobot yang dioptimalkan
 * untuk menghasilkan signal gabungan yang lebih robust.
 *
 * Logika:
 * 1. Ambil finalScore dan signalStrength dari database
 * 2. Tentukan signal category (BUY/SELL/NEUTRAL) dari finalScore
 * 3. Tentukan signal label (STRONG BUY/BUY/SELL/STRONG SELL) dari strength
 * 4. Hitung category scores jika weights tersedia
 *    - Trend: SMA + EMA + PSAR
 *    - Momentum: RSI + MACD + Stochastic + StochasticRSI
 *    - Volatility: BollingerBands
 *
 * Parameter:
 *                                atau null jika belum dioptimalkan
 *
 * Return:
 *   {
 *     signal: "buy" | "sell" | "neutral",
 *     strength: 0-1 (signal confidence),
 *     finalScore: -1 to 1 (weighted average score),
 *     signalLabel: "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL",
 *     categoryScores: { trend, momentum, volatility },
 *     source: "db"
 *   }
 *   atau null jika ind adalah null
 *
 * ────────────────────────────────────────────────────────────
 */
export function formatMultiSignalFromDB(ind, weights = null) {
  // ✅ Jika tidak ada indicator, return null
  if (!ind) return null;

  // ✅ Ambil finalScore dan signalStrength dari database
  const dbFinalScore = ind.finalScore ?? 0;
  const dbStrength = ind.signalStrength ?? 0;

  // ✅ Tentukan signal category berdasarkan finalScore
  // Klasifikasi ini disamakan dengan overallAnalyzer/indicator.utils.
  let signal = "neutral";
  let finalScore = dbFinalScore;
  let strength = dbStrength;
  const STRONG_BUY_THRESHOLD = 0.6;
  const STRONG_SELL_THRESHOLD = -0.6;

  // finalScore >= 0.6 = strong_buy, >0 = buy, <= -0.6 = strong_sell, <0 = sell
  if (finalScore >= STRONG_BUY_THRESHOLD) {
    signal = "strong_buy";
  } else if (finalScore > 0) {
    signal = "buy";
  } else if (finalScore <= STRONG_SELL_THRESHOLD) {
    signal = "strong_sell";
  } else if (finalScore < 0) {
    signal = "sell";
  } else {
    signal = "neutral";
    strength = 0; // Neutral signals tidak punya strength
  }

  // ✅ Tentukan signal label berdasarkan strength
  let signalLabel = "NEUTRAL";
  if (signal === "strong_buy") {
    signalLabel = "STRONG BUY";
  } else if (signal === "buy") {
    signalLabel = "BUY";
  } else if (signal === "strong_sell") {
    signalLabel = "STRONG SELL";
  } else if (signal === "sell") {
    signalLabel = "SELL";
  }

  // ✅ Hitung category scores jika weights tersedia
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    // Helper function: convert signal string menjadi numeric score
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      // BUY atau STRONG_BUY = +1, SELL atau STRONG_SELL = -1
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // ✅ TREND CATEGORY SCORE
    // Combine: SMA, EMA, Parabolic SAR
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);
    const trendWeight =
      (weights.SMA || 0) + (weights.EMA || 0) + (weights.PSAR || 0);

    // ✅ MOMENTUM CATEGORY SCORE
    // Combine: RSI, MACD, Stochastic, Stochastic RSI
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);
    const momentumWeight =
      (weights.RSI || 0) +
      (weights.MACD || 0) +
      (weights.Stochastic || 0) +
      (weights.StochasticRSI || 0);

    // ✅ VOLATILITY CATEGORY SCORE
    // Combine: Bollinger Bands
    const volatilityScore =
      signalToScore(ind.bbSignal) * (weights.BollingerBands || 0);
    const volatilityWeight = weights.BollingerBands || 0;

    // ✅ Normalisasi skor kategori agar skala tetap konsisten (-1..1)
    categoryScores = {
      trend: parseFloat(
        (trendWeight > 0 ? trendScore / trendWeight : 0).toFixed(2),
      ),
      momentum: parseFloat(
        (momentumWeight > 0 ? momentumScore / momentumWeight : 0).toFixed(2),
      ),
      volatility: parseFloat(
        (volatilityWeight > 0 ? volatilityScore / volatilityWeight : 0).toFixed(
          2,
        ),
      ),
    };
  }

  // ✅ Return formatted multi-signal
  return {
    signal, // "buy" | "sell" | "neutral"
    strength: parseFloat(strength.toFixed(3)), // 0-1 confidence level
    finalScore: parseFloat(finalScore.toFixed(2)), // -1 to 1 weighted score
    signalLabel, // "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL"
    categoryScores, // { trend, momentum, volatility }
    source: "db", // Source indicator ini dari database
  };
}
