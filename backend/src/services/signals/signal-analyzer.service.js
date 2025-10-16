export function analyzeMultiIndicator(i, weights) {
  let score = 0;
  if (i.rsi < 30) score += weights.rsi;
  if (i.rsi > 70) score -= weights.rsi;
  if (i.macd > i.macdSignal) score += weights.macd;
  if (i.macd < i.macdSignal) score -= weights.macd;
  if (i.ema20 > i.sma20) score += weights.ema20;
  if (i.ema20 < i.sma20) score -= weights.ema20;
  if (i.psar < i.close) score += weights.psar;
  if (i.psar > i.close) score -= weights.psar;
  if (i.stochK > i.stochD) score += weights.stoch;
  if (i.stochK < i.stochD) score -= weights.stoch;
  if (i.close > i.bbUpper) score -= weights.bb;
  if (i.close < i.bbLower) score += weights.bb;

  return score > 0 ? "BUY" : score < 0 ? "SELL" : "HOLD";
}
