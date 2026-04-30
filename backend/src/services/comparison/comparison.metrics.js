/**
 * Fungsi perhitungan metrik untuk hasil backtest.
 * Berisi mean, standar deviasi, Sharpe, return, drawdown, dan format hasil.
 */

/**
 * Hitung rata-rata dari array angka.
 */
export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Hitung standar deviasi dari array angka.
 */
export function stddev(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const variance =
    squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Hitung Sharpe Ratio dari deret return.
 */
export function calcSharpe(returns) {
  if (!returns || returns.length < 2) return 0;

  // Hitung mean dan standar deviasi dari return.
  const avgReturn = mean(returns);
  const volatility = stddev(returns);

  if (volatility === 0) return 0;

  // Sharpe Ratio: (mean return - rf) / stddev return.
  // Risk-free rate = 0 untuk kripto.
  const sharpeRatio = avgReturn / volatility;

  // Annualisasi: kalikan dengan sqrt(8760 jam per tahun).
  const annualizedSharpe = sharpeRatio * Math.sqrt(8760);

  return annualizedSharpe;
}

/**
 * Hitung return per periode dari equity curve.
 */
export function calculateReturns(equityCurve) {
  if (!equityCurve || equityCurve.length < 2) return [];

  const returns = [];

  // Loop dari index 1 sampai akhir.
  for (let i = 1; i < equityCurve.length; i++) {
    const previousEquity = equityCurve[i - 1];
    const currentEquity = equityCurve[i];

    // Return = (current - previous) / previous * 100.
    const periodReturn =
      ((currentEquity - previousEquity) / previousEquity) * 100;
    returns.push(periodReturn);
  }

  return returns;
}

/**
 * Hitung max drawdown dari deret nilai modal.
 */
export function calculateMaxDrawDown(values) {
  if (!values || values.length < 2) return 0;

  let maxDrawdown = 0;
  let runningMax = values[0]; // Nilai puncak sementara.

  // Loop semua nilai mulai dari index 1.
  for (let i = 1; i < values.length; i++) {
    const currentValue = values[i];

    // Update puncak jika nilai sekarang lebih tinggi.
    if (currentValue > runningMax) {
      runningMax = currentValue;
    }

    // Hitung drawdown: (peak - current) / peak.
    const drawdown = ((runningMax - currentValue) / runningMax) * 100;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Format hasil backtest agar konsisten dan rapi.
 */
export function formatResult(backtest) {
  if (!backtest) {
    return {
      roi: 0,
      finalCapital: 10000,
      winRate: 0,
      trades: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
    };
  }

  // Hitung Sharpe jika belum ada.
  let sharpeRatio = backtest.sharpeRatio || 0;

  // Jika ada equity curve tapi belum ada sharpe, hitung di sini.
  if (backtest.equityCurve && !sharpeRatio) {
    const returns = calculateReturns(backtest.equityCurve);
    if (!sharpeRatio) sharpeRatio = calcSharpe(returns);
  }

  // Hitung max drawdown dari equity curve jika belum ada.
  let maxDD = backtest.maxDrawdown;
  if (backtest.equityCurve && !maxDD) {
    maxDD = calculateMaxDrawDown(backtest.equityCurve);
  }

  // Bulatkan angka ke 2 desimal.
  return {
    roi: +Number(backtest.roi ?? 0).toFixed(2),
    finalCapital: +Number(backtest.finalCapital ?? 10000).toFixed(2),
    winRate: +Number(backtest.winRate ?? 0).toFixed(2),
    trades: Number.isFinite(Number(backtest.trades))
      ? Number(backtest.trades)
      : 0,
    maxDrawdown: +Number(maxDD ?? 0).toFixed(2),
    sharpeRatio: +Number(sharpeRatio).toFixed(2),
  };
}
