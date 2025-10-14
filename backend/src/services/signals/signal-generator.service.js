/**
 * 📊 signal-generator.service.js
 * Menghasilkan sinyal BUY/SELL/HOLD dari berbagai indikator teknikal.
 * Tidak berinteraksi dengan database — hanya logika perhitungan.
 */

export function generateMASignals(shortMA, longMA) {
  const signals = Array(shortMA.length).fill("HOLD");

  for (let i = 1; i < shortMA.length; i++) {
    const prevDiff = shortMA[i - 1] - longMA[i - 1];
    const currDiff = shortMA[i] - longMA[i];

    if (prevDiff <= 0 && currDiff > 0) signals[i] = "BUY";
    else if (prevDiff >= 0 && currDiff < 0) signals[i] = "SELL";
  }
  return signals;
}

export function generateEMASignals(closes, emaValues) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= emaValues[i - 1] && closes[i] > emaValues[i])
      signals[i] = "BUY";
    else if (closes[i - 1] >= emaValues[i - 1] && closes[i] < emaValues[i])
      signals[i] = "SELL";
  }
  return signals;
}

export function generateRSISignals(rsiValues, lower = 30, upper = 70) {
  const signals = Array(rsiValues.length).fill("HOLD");

  for (let i = 1; i < rsiValues.length; i++) {
    if (rsiValues[i - 1] <= lower && rsiValues[i] > lower) signals[i] = "BUY";
    else if (rsiValues[i - 1] >= upper && rsiValues[i] < upper)
      signals[i] = "SELL";
  }
  return signals;
}

export function generateStochasticSignals(
  stochK,
  stochD,
  oversold = 20,
  overbought = 80
) {
  const signals = Array(stochK.length).fill("HOLD");

  for (let i = 1; i < stochK.length; i++) {
    if (
      stochK[i - 1] <= stochD[i - 1] &&
      stochK[i] > stochD[i] &&
      stochK[i] < oversold
    )
      signals[i] = "BUY";
    else if (
      stochK[i - 1] >= stochD[i - 1] &&
      stochK[i] < stochD[i] &&
      stochK[i] > overbought
    )
      signals[i] = "SELL";
  }
  return signals;
}

export function generateStochasticRSISignals(
  stochRsiK,
  stochRsiD,
  oversold = 20,
  overbought = 80
) {
  const signals = Array(stochRsiK.length).fill("HOLD");

  for (let i = 1; i < stochRsiK.length; i++) {
    if (
      stochRsiK[i - 1] <= stochRsiD[i - 1] &&
      stochRsiK[i] > stochRsiD[i] &&
      stochRsiK[i] < oversold
    )
      signals[i] = "BUY";
    else if (
      stochRsiK[i - 1] >= stochRsiD[i - 1] &&
      stochRsiK[i] < stochRsiD[i] &&
      stochRsiK[i] > overbought
    )
      signals[i] = "SELL";
  }
  return signals;
}

export function generateMACDSignals(macdLine, signalLine) {
  const signals = Array(macdLine.length).fill("HOLD");

  for (let i = 1; i < macdLine.length; i++) {
    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i])
      signals[i] = "BUY";
    else if (
      macdLine[i - 1] >= signalLine[i - 1] &&
      macdLine[i] < signalLine[i]
    )
      signals[i] = "SELL";
  }
  return signals;
}

export function generateBollingerBandsSignals(closes, upperBand, lowerBand) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 2; i < closes.length; i++) {
    if (closes[i] <= lowerBand[i]) signals[i] = "BUY";
    else if (closes[i] >= upperBand[i]) signals[i] = "SELL";
  }
  return signals;
}

export function generateParabolicSARSignals(closes, sarValues) {
  const signals = Array(closes.length).fill("HOLD");

  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= sarValues[i - 1] && closes[i] > sarValues[i])
      signals[i] = "BUY";
    else if (closes[i - 1] >= sarValues[i - 1] && closes[i] < sarValues[i])
      signals[i] = "SELL";
  }
  return signals;
}

/**
 * 🎯 Generate all indicator signals from historical data
 */
export function generateAllSignals(historicalData) {
  if (!historicalData?.length) throw new Error("Historical data is required");

  const closes = historicalData.map((d) => d.close);
  const sma20 = historicalData.map((d) => d.sma20);
  const sma50 = historicalData.map((d) => d.sma50);
  const ema20 = historicalData.map((d) => d.ema20);
  const rsi14 = historicalData.map((d) => d.rsi14);
  const stochK = historicalData.map((d) => d.stochK);
  const stochD = historicalData.map((d) => d.stochD);
  const stochRsiK = historicalData.map((d) => d.stochRsiK);
  const stochRsiD = historicalData.map((d) => d.stochRsiD);
  const macdLine = historicalData.map((d) => d.macdLine);
  const macdSignal = historicalData.map((d) => d.macdSignal);
  const bbUpper = historicalData.map((d) => d.bbUpper);
  const bbLower = historicalData.map((d) => d.bbLower);
  const psar = historicalData.map((d) => d.psar);

  return {
    sma: generateMASignals(sma20, sma50),
    ema: generateEMASignals(closes, ema20),
    rsi: generateRSISignals(rsi14),
    stochastic: generateStochasticSignals(stochK, stochD),
    stochasticRSI: generateStochasticRSISignals(stochRsiK, stochRsiD),
    macd: generateMACDSignals(macdLine, macdSignal),
    bollingerBands: generateBollingerBandsSignals(closes, bbUpper, bbLower),
    parabolicSAR: generateParabolicSARSignals(closes, psar),
  };
}
