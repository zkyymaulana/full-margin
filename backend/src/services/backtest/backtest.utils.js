/**
 * fungsi pembantu untuk validasi, perhitungan risiko, dan scoring sinyal
 */

// ✅ Validasi & interpolasi RSI
export function validateAndFillRsiData(data) {
  const valid = data.filter((d) => d.rsi != null && d.rsi > 0);
  const missing = data.length - valid.length;

  if (valid.length < data.length * 0.5) {
    console.warn("⚠️ >50% data RSI kosong → gunakan fallback acak (40–60)");
    return data.map((d) => ({
      ...d,
      rsi: d.rsi || 40 + Math.random() * 20,
      _fallback: !d.rsi,
    }));
  }

  if (missing > 0) {
    console.log(`🔧 Interpolasi ${missing} nilai RSI yang hilang...`);
    const filled = [...data];
    for (let i = 0; i < filled.length; i++) {
      if (!filled[i].rsi) {
        const prev = filled
          .slice(0, i)
          .reverse()
          .find((x) => x.rsi);
        const next = filled.slice(i + 1).find((x) => x.rsi);
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

// 📉 Hitung maximum drawdown
export function calcMaxDrawdown(equity) {
  let peak = equity[0];
  let maxDD = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = ((peak - v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(2);
}

// 📊 Hitung Sharpe & Sortino ratio
export function calcRiskMetrics(equity) {
  if (!equity || equity.length < 2)
    return { sharpeRatio: null, sortinoRatio: null };

  const returns = [];
  for (let i = 1; i < equity.length; i++)
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  );

  const neg = returns.filter((r) => r < 0);
  const downside = Math.sqrt(
    neg.reduce((s, r) => s + r ** 2, 0) / (neg.length || 1)
  );

  const annual = Math.sqrt(252 * 24);
  return {
    sharpeRatio: std ? +((mean / std) * annual).toFixed(2) : null,
    sortinoRatio: downside ? +((mean / downside) * annual).toFixed(2) : null,
  };
}
