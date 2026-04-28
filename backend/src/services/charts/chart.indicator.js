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
