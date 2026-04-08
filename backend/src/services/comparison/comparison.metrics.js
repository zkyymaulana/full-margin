/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 COMPARISON METRICS MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Modul ini berisi semua fungsi perhitungan statistik dan evaluasi performa
 * dari trading strategies.
 *
 * Tanggung jawab:
 * • Perhitungan statistik dasar (mean, standard deviation)
 * • Perhitungan financial metrics (Sharpe Ratio)
 * • Perhitungan return dan drawdown
 * • Formatting hasil untuk consistency dan precision
 *
 * CATATAN: Semua perhitungan mengikuti academic standards dari research paper:
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading" - Sukma & Namahoot (2025)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 📈 Hitung mean (rata-rata) dari array of numbers
 *
 * Tujuan:
 * - Menghitung rata-rata nilai dari sebuah array
 * - Digunakan sebagai base untuk Sharpe Ratio
 * - Essential untuk statistical analysis
 *
 * Formula: mean = Σ(xi) / n
 *
 *
 *
 * @example
 * mean([1, 2, 3, 4, 5]) // Returns 3
 * mean([10, 20, 30]) // Returns 20
 */
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * 📈 Hitung standard deviation dari array of numbers
 *
 * Tujuan:
 * - Mengukur volatility atau variabilitas dari data
 * - Digunakan dalam Sharpe Ratio
 * - Menunjukkan seberapa banyak data menyimpang dari mean
 *
 * Formula: stddev = √(Σ(xi - mean)² / n)
 *
 *
 *
 * @example
 * stddev([1, 2, 3, 4, 5]) // Returns ~1.414
 * stddev([10, 10, 10]) // Returns 0 (no variance)
 */
function stddev(values) {
  if (!values.length) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const variance = mean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * 📊 Hitung Sharpe Ratio dari return values
 *
 * Tujuan:
 * - Mengukur risk-adjusted return dari strategi trading
 * - Menunjukkan excess return per unit of risk
 * - Semakin tinggi, semakin baik return relative to volatility
 *
 * Formula: Sharpe Ratio = (mean return - risk-free rate) / stddev return
 *
 * Asumsi:
 * - Risk-free rate = 0 (simplified for crypto)
 * - Return period = hourly (sesuai dengan 1H timeframe)
 * - Annualized = 365 * 24 = 8760 jam per tahun
 *
 * Interpretasi:
 * - > 1.0 = Good risk-adjusted return
 * - > 2.0 = Very good
 * - > 3.0 = Excellent
 * - < 0 = Negative return
 *
 *
 *
 * @example
 * sharpe([1, 1.5, 0.8, 2.1, 1.2]) // Returns ~2.34 (annualized)
 */
function calcSharpe(returns) {
  if (!returns || returns.length < 2) return 0;

  // ✅ Hitung mean dan stddev dari returns
  const avgReturn = mean(returns);
  const volatility = stddev(returns);

  if (volatility === 0) return 0; // ✅ Avoid division by zero

  // ✅ Sharpe Ratio formula: (mean return - rf) / stddev return
  // Risk-free rate = 0 untuk simplicity
  const sharpeRatio = avgReturn / volatility;

  // ✅ Annualize: multiply by sqrt(8760 hours per year)
  const annualizedSharpe = sharpeRatio * Math.sqrt(8760);

  return annualizedSharpe;
}

/**
 * 📈 Hitung returns dari equity curve (modal curve)
 *
 * Tujuan:
 * - Convert equity curve (capital at each point) ke period returns (%)
 * - Returns digunakan untuk Sharpe dan Sortino Ratio calculation
 * - Menunjukkan % gain/loss di setiap period
 *
 * Formula: return[i] = ((equity[i] - equity[i-1]) / equity[i-1]) * 100
 *
 *
 *
 * @example
 * calculateReturns([100, 101, 103, 102, 105])
 * // Returns [1, 1.98, -0.97, 2.94]
 */
function calculateReturns(equityCurve) {
  if (!equityCurve || equityCurve.length < 2) return [];

  const returns = [];

  // ✅ Loop dari index 1 sampai end
  for (let i = 1; i < equityCurve.length; i++) {
    const previousEquity = equityCurve[i - 1];
    const currentEquity = equityCurve[i];

    // ✅ Return = (current - previous) / previous * 100
    const periodReturn =
      ((currentEquity - previousEquity) / previousEquity) * 100;
    returns.push(periodReturn);
  }

  return returns;
}

/**
 * 📉 Hitung Maximum Drawdown dari series of values
 *
 * Tujuan:
 * - Mengukur worst-case loss dari equity curve
 * - Maximum loss dari peak ke trough dalam backtest period
 * - Critical untuk risk management
 *
 * Formula: MaxDD = (lowest point - highest point before it) / highest point * 100
 *
 * Proses:
 * 1. Track running maximum dari awal sampai setiap point
 * 2. Hitung drawdown di setiap point: (value - runningMax) / runningMax
 * 3. Track maximum drawdown
 *
 * Contoh:
 * Equity curve: [100, 110, 105, 120, 90, 95]
 * Peak pada 120, terbang ke 90 = drawdown = (90-120)/120 = -25%
 *
 *
 *
 * @example
 * calculateMaxDrawDown([100, 110, 105, 120, 90, 95]) // Returns -25
 * calculateMaxDrawDown([100, 101, 102, 103, 104]) // Returns 0 (only up)
 */
function calculateMaxDrawDown(values) {
  if (!values || values.length < 2) return 0;

  let maxDrawdown = 0; // ✅ Track worst drawdown (most negative)
  let runningMax = values[0]; // ✅ Track highest value seen so far

  // ✅ Loop semua values mulai dari index 1
  for (let i = 1; i < values.length; i++) {
    const currentValue = values[i];

    // ✅ Update running max jika current > running max
    if (currentValue > runningMax) {
      runningMax = currentValue;
    }

    // ✅ Hitung drawdown: (current - peak) / peak
    const drawdown = ((currentValue - runningMax) / runningMax) * 100;

    // ✅ Track yang paling negatif (worst case)
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * 📋 Format hasil backtest menjadi standardized response object
 *
 * Tujuan:
 * - Ensure consistency dalam format response
 * - Round numbers ke 2 decimal places
 * - Handle edge cases dan missing values
 * - Provide metrics sesuai kebutuhan aplikasi
 *
 * Output fields:
 * - roi: Return on Investment (%)
 * - finalCapital: Ending capital ($)
 * - winRate: Percentage of winning trades (%)
 * - maxDrawdown: Worst peak-to-trough loss (%)
 * - sharpeRatio: Risk-adjusted return metric
 *
 *
 *
 * @example
 * formatResult({
 *   roi: 25.567829,
 *   finalCapital: 125.567829,
 *   winRate: 55.555555,
 *   maxDrawdown: -15.123456,
 *   equityCurve: [100, 101, 103, 105, 102, 115, 125.5678]
 * })
 * // Returns: {
 * //   roi: 25.57,
 * //   finalCapital: 125.57,
 * //   winRate: 55.56,
 * //   maxDrawdown: -15.12,
 * //   sharpeRatio: 2.34
 * // }
 */
function formatResult(backtest) {
  if (!backtest) {
    return {
      roi: 0,
      finalCapital: 100,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
    };
  }

  // ✅ Calculate metrics jika belum ada
  let sharpRatio = backtest.sharpeRatio || 0;

  // ✅ Jika ada equity curve tapi belum ada sharpe, hitung
  if (backtest.equityCurve && !sharpRatio) {
    const returns = calculateReturns(backtest.equityCurve);
    if (!sharpRatio) sharpRatio = calcSharpe(returns);
  }

  // ✅ Calculate maxDrawdown dari equity curve jika belum ada
  let maxDD = backtest.maxDrawdown;
  if (backtest.equityCurve && !maxDD) {
    maxDD = calculateMaxDrawDown(backtest.equityCurve);
  }

  // ✅ Round semua numbers ke 2 decimal places untuk consistency
  return {
    roi: +Number(backtest.roi ?? 0).toFixed(2),
    finalCapital: +Number(backtest.finalCapital ?? 100).toFixed(2),
    winRate: +Number(backtest.winRate ?? 0).toFixed(2),
    maxDrawdown: +Number(maxDD ?? 0).toFixed(2),
    sharpeRatio: +Number(sharpRatio).toFixed(2),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  mean,
  stddev,
  calcSharpe,
  calculateReturns,
  calculateMaxDrawDown,
  formatResult,
};
