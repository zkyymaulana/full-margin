/**
 * fungsi pembantu untuk validasi, perhitungan risiko, dan scoring sinyal
 */

// ✅ Validasi & interpolasi RSI
export function validateAndFillRsiData(data) {
  const isFiniteRsi = (value) => Number.isFinite(Number(value));
  const valid = data.filter((d) => d.rsi != null && isFiniteRsi(d.rsi));
  const missing = data.length - valid.length;

  if (valid.length < data.length * 0.5) {
    console.warn(
      "⚠️ >50% data RSI kosong -> gunakan fallback netral deterministik (50)",
    );
    return data.map((d) => ({
      ...d,
      rsi: isFiniteRsi(d.rsi) ? Number(d.rsi) : 50,
      _fallback: !isFiniteRsi(d.rsi),
    }));
  }

  if (missing > 0) {
    console.log(`🔧 Interpolasi ${missing} nilai RSI yang hilang...`);
    const filled = [...data];
    for (let i = 0; i < filled.length; i++) {
      if (!isFiniteRsi(filled[i].rsi)) {
        const prev = filled
          .slice(0, i)
          .reverse()
          .find((x) => isFiniteRsi(x.rsi));
        const next = filled.slice(i + 1).find((x) => isFiniteRsi(x.rsi));
        filled[i].rsi = prev && next ? (prev.rsi + next.rsi) / 2 : 50;
      }
    }
    return filled;
  }

  return data;
}

// ⚖️ Konversi sinyal → skor numerik
export const scoreSignal = (s) => {
  switch (s) {
    case "strong_buy":
      return 2;
    case "buy":
      return 1;
    case "sell":
      return -1;
    case "strong_sell":
      return -2;
    default:
      return 0;
  }
};

// ROI dalam persentase
export function calculateROI(finalCapital, initialCapital) {
  if (!initialCapital || !Number.isFinite(initialCapital)) return 0;
  const roi = ((finalCapital - initialCapital) / initialCapital) * 100;
  return +roi.toFixed(2);
}

// win rate dalam persentase
export function calculateWinRate(wins, trades) {
  if (!trades || trades <= 0) return 0;
  const winRate = (wins / trades) * 100;
  return +winRate.toFixed(2);
}

// maximum drawdown
export function calculateMaxDrawDown(equity) {
  let peak = equity[0];
  let maxDD = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(2);
}

// Sharpe Ratio dari equity curve
/**
 * Sharpe Ratio = Average Return / Standard Deviation of Returns
 * Assumes risk-free rate = 0
 * Uses sample standard deviation
 */
export function calculateSharpeRatio(equity) {
  if (!equity || equity.length < 2) {
    return null;
  }

  // Calculate returns from equity curve
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  if (returns.length === 0) {
    return null;
  }

  // Average return
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Sample standard deviation (n-1)
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);

  // Sharpe Ratio (annualized for hourly data: sqrt(365 * 24))
  const annualizationFactor = Math.sqrt(365 * 24);
  const sharpeRatio = std > 0 ? (mean / std) * annualizationFactor : null;

  return sharpeRatio !== null ? +sharpeRatio.toFixed(2) : null;
}
