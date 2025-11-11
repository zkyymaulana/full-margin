/**
 * 📊 Analisis Sinyal Per Indikator
 * Setiap indikator menghasilkan sinyal "buy", "sell", atau "neutral"
 * berdasarkan aturan standar analisis teknikal.
 */

export function calculateSignals(indicators, price) {
  const signals = {};

  // === 1. Simple Moving Average (SMA)
  // BUY: harga dan SMA20 > SMA50 → tren naik
  // SELL: harga dan SMA20 < SMA50 → tren turun
  if (indicators.sma20 && indicators.sma50 && price) {
    if (
      price > indicators.sma20 &&
      price > indicators.sma50 &&
      indicators.sma20 > indicators.sma50
    ) {
      signals.smaSignal = "buy";
    } else if (
      price < indicators.sma20 &&
      price < indicators.sma50 &&
      indicators.sma20 < indicators.sma50
    ) {
      signals.smaSignal = "sell";
    } else signals.smaSignal = "neutral";
  }

  // === 2. Exponential Moving Average (EMA)
  // Sama seperti SMA, tapi lebih sensitif terhadap harga terbaru
  if (indicators.ema20 && indicators.ema50 && price) {
    if (
      price > indicators.ema20 &&
      price > indicators.ema50 &&
      indicators.ema20 > indicators.ema50
    ) {
      signals.emaSignal = "buy";
    } else if (
      price < indicators.ema20 &&
      price < indicators.ema50 &&
      indicators.ema20 < indicators.ema50
    ) {
      signals.emaSignal = "sell";
    } else signals.emaSignal = "neutral";
  }

  // === 3. Relative Strength Index (RSI)
  // BUY: RSI < 30 (oversold)
  // SELL: RSI > 70 (overbought)
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) signals.rsiSignal = "sell";
    else if (indicators.rsi < 30) signals.rsiSignal = "buy";
    else signals.rsiSignal = "neutral";
  }

  // === 4. MACD
  // BUY: MACD > Signal line dan histogram > 0
  // SELL: MACD < Signal line dan histogram < 0
  if (
    indicators.macd !== null &&
    indicators.macdSignalLine !== null &&
    indicators.macdHist !== null
  ) {
    if (
      indicators.macd > indicators.macdSignalLine &&
      indicators.macdHist > 0
    ) {
      signals.macdSignal = "buy";
    } else if (
      indicators.macd < indicators.macdSignalLine &&
      indicators.macdHist < 0
    ) {
      signals.macdSignal = "sell";
    } else signals.macdSignal = "neutral";
  }

  // === 5. Bollinger Bands
  // BUY: harga mendekati pita bawah
  // SELL: harga mendekati pita atas
  if (indicators.bbUpper && indicators.bbLower && price) {
    const width = indicators.bbUpper - indicators.bbLower;
    if (price > indicators.bbUpper - width * 0.1) signals.bbSignal = "sell";
    else if (price < indicators.bbLower + width * 0.1) signals.bbSignal = "buy";
    else signals.bbSignal = "neutral";
  }

  // === 6. Stochastic Oscillator
  // BUY: %K dan %D < 20
  // SELL: %K dan %D > 80
  if (indicators.stochK !== null && indicators.stochD !== null) {
    if (indicators.stochK > 80 && indicators.stochD > 80)
      signals.stochSignal = "sell";
    else if (indicators.stochK < 20 && indicators.stochD < 20)
      signals.stochSignal = "buy";
    else signals.stochSignal = "neutral";
  }

  // === 7. Stochastic RSI
  // Sama prinsipnya: 80+ → SELL, 20- → BUY
  if (indicators.stochRsiK !== null && indicators.stochRsiD !== null) {
    if (indicators.stochRsiK > 80 && indicators.stochRsiD > 80)
      signals.stochRsiSignal = "sell";
    else if (indicators.stochRsiK < 20 && indicators.stochRsiD < 20)
      signals.stochRsiSignal = "buy";
    else signals.stochRsiSignal = "neutral";
  }

  // === 8. Parabolic SAR
  // BUY: harga di atas titik SAR → tren naik
  // SELL: harga di bawah titik SAR → tren turun
  if (indicators.psar !== null && price) {
    if (price > indicators.psar) signals.psarSignal = "buy";
    else if (price < indicators.psar) signals.psarSignal = "sell";
    else signals.psarSignal = "neutral";
  }

  return signals;
}
