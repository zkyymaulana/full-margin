// Format multi-signal dari database (single source of truth)
export function formatMultiSignalFromDB(ind, weights = null) {
  if (!ind) return null;

  const finalScore = ind.finalScore ?? 0;
  let strength = ind.signalStrength ?? 0;

  const STRONG_BUY = 0.6;
  const STRONG_SELL = -0.6;

  let signal = "neutral";

  if (finalScore >= STRONG_BUY) signal = "strong_buy";
  else if (finalScore > 0) signal = "buy";
  else if (finalScore <= STRONG_SELL) signal = "strong_sell";
  else if (finalScore < 0) signal = "sell";
  else strength = 0;

  const signalLabelMap = {
    strong_buy: "STRONG BUY",
    buy: "BUY",
    strong_sell: "STRONG SELL",
    sell: "SELL",
    neutral: "NEUTRAL",
  };

  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    const toScore = (s) => {
      if (!s) return 0;
      if (["buy", "strong_buy"].includes(s.toLowerCase())) return 1;
      if (["sell", "strong_sell"].includes(s.toLowerCase())) return -1;
      return 0;
    };

    const calc = (signals, weightsArr) => {
      const score = signals.reduce(
        (sum, s, i) => sum + toScore(s) * (weightsArr[i] || 0),
        0,
      );
      const totalWeight = weightsArr.reduce((a, b) => a + (b || 0), 0);
      return totalWeight > 0 ? score / totalWeight : 0;
    };

    categoryScores = {
      trend: +calc(
        [ind.smaSignal, ind.emaSignal, ind.psarSignal],
        [weights.SMA, weights.EMA, weights.PSAR],
      ).toFixed(2),

      momentum: +calc(
        [ind.rsiSignal, ind.macdSignal, ind.stochSignal, ind.stochRsiSignal],
        [weights.RSI, weights.MACD, weights.Stochastic, weights.StochasticRSI],
      ).toFixed(2),

      volatility: +calc([ind.bbSignal], [weights.BollingerBands]).toFixed(2),
    };
  }

  return {
    signal,
    strength: +strength.toFixed(3),
    finalScore: +finalScore.toFixed(2),
    signalLabel: signalLabelMap[signal],
    categoryScores,
    isOptimized: Boolean(weights),
    source: "db",
  };
}
