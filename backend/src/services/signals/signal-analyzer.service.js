/**
 * 🧠 signal-analyzer.service.js
 * Menganalisis hasil sinyal dan menggabungkan beberapa indikator.
 */

export function generateIndividualSignals(indicators) {
  const {
    sma20,
    sma50,
    ema20,
    close,
    rsi,
    stochK,
    stochD,
    stochRsiK,
    stochRsiD,
    macdLine,
    macdSignal,
    bbUpper,
    bbLower,
    psar,
  } = indicators;

  const signals = {};

  // SMA Cross
  signals.sma = sma20 > sma50 ? "BUY" : sma20 < sma50 ? "SELL" : "HOLD";

  // EMA
  signals.ema = close > ema20 ? "BUY" : close < ema20 ? "SELL" : "HOLD";

  // RSI
  if (rsi < 30) signals.rsi = "BUY";
  else if (rsi > 70) signals.rsi = "SELL";
  else signals.rsi = "HOLD";

  // Stochastic
  if (stochK > stochD && stochK < 20) signals.stochastic = "BUY";
  else if (stochK < stochD && stochK > 80) signals.stochastic = "SELL";
  else signals.stochastic = "HOLD";

  // Stochastic RSI
  if (stochRsiK > stochRsiD && stochRsiK < 20) signals.stochRsi = "BUY";
  else if (stochRsiK < stochRsiD && stochRsiK > 80) signals.stochRsi = "SELL";
  else signals.stochRsi = "HOLD";

  // MACD
  signals.macd =
    macdLine > macdSignal ? "BUY" : macdLine < macdSignal ? "SELL" : "HOLD";

  // Bollinger Bands
  if (close < bbLower) signals.bollinger = "BUY";
  else if (close > bbUpper) signals.bollinger = "SELL";
  else signals.bollinger = "HOLD";

  // PSAR
  signals.psar = close > psar ? "BUY" : close < psar ? "SELL" : "HOLD";

  return signals;
}

/**
 * 📊 Menggabungkan semua sinyal menjadi satu keputusan dengan confidence
 */
export function getCurrentSignalsSummary(latestData) {
  const individualSignals = generateIndividualSignals(latestData);

  const counts = { BUY: 0, SELL: 0, HOLD: 0 };
  Object.values(individualSignals).forEach((sig) => counts[sig]++);

  let overall = "HOLD";
  if (counts.BUY > counts.SELL) overall = "BUY";
  else if (counts.SELL > counts.BUY) overall = "SELL";

  const confidence =
    Math.max(counts.BUY, counts.SELL) / Object.keys(individualSignals).length;

  return {
    individualSignals,
    counts,
    overall,
    confidence,
  };
}

/**
 * 📈 Analisis kondisi crossover SMA (Golden/Death Cross)
 */
export function analyzeMovingAverageCross(sma20, sma50, closes) {
  const lastSMA20 = sma20.at(-1);
  const lastSMA50 = sma50.at(-1);
  const lastClose = closes.at(-1);

  if (!lastSMA20 || !lastSMA50) {
    return { signal: "WAIT", message: "Data belum cukup untuk analisis" };
  }

  if (lastSMA20 > lastSMA50)
    return {
      signal: "BUY",
      message: "Golden Cross - Tren naik terkonfirmasi",
      lastClose,
    };
  if (lastSMA20 < lastSMA50)
    return {
      signal: "SELL",
      message: "Death Cross - Tren turun terkonfirmasi",
      lastClose,
    };

  return {
    signal: "HOLD",
    message: "SMA sejajar - Tidak ada sinyal jelas",
    lastClose,
  };
}
