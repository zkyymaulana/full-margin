import {
  scoreSignal,
  calculateMaxDrawDown,
  calculateROI,
  calculateWinRate,
  calculateSharpeRatio,
} from "./backtest.utils.js";

const INITIAL_CAPITAL = 10000;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/**
 * 🔧 Membuat kumpulan fungsi sinyal untuk setiap indikator
 * Logika ini konsisten dengan signalAnalyzer.js
 */
export function makeSignalFuncs({ rsiLow = 30, rsiHigh = 70 } = {}) {
  return {
    // RSI: overbought/oversold
    rsi: (v) => {
      if (v == null) return "neutral";
      if (v > rsiHigh) return "sell";
      if (v < rsiLow) return "buy";
      return "neutral";
    },

    // MACD: crossover & histogram
    macd: (m, s, h) => {
      if (m == null || s == null || h == null) return "neutral";
      if (m > s && h > 0) return "buy";
      if (m < s && h < 0) return "sell";
      return "neutral";
    },

    // SMA: harga dan SMA20 relatif terhadap SMA50
    sma: (s20, s50, p) => {
      // Pakai cek null eksplisit agar nilai 0 tetap dianggap angka valid.
      if (p == null || s20 == null || s50 == null) return "neutral";
      if (p > s50 && s20 > s50) return "buy";
      if (p < s50 && s20 < s50) return "sell";
      return "neutral";
    },

    // EMA: sesuai flowchart, sinyal dari relasi EMA20 vs EMA50.
    ema: (e20, e50) => {
      if (e20 == null || e50 == null) return "neutral";
      if (e20 > e50) return "buy";
      if (e20 < e50) return "sell";
      return "neutral";
    },

    // Bollinger Bands: sinyal saat harga menyentuh band.
    bollingerBands: (p, up, low, middle) => {
      if (p == null || up == null || low == null) return "neutral";
      if (p >= up) return "sell";
      if (p <= low) return "buy";
      return "neutral";
    },

    // Stochastic Oscillator: overbought/oversold
    stochastic: (k, d) => {
      if (k == null || d == null) return "neutral";
      if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
      if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
      return "neutral";
    },

    // Stochastic RSI: similar to Stochastic Oscillator
    stochasticRSI: (k, d) => {
      if (k == null || d == null) return "neutral";
      if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) return "sell";
      if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) return "buy";
      return "neutral";
    },

    // PSAR: price position relative to SAR
    psar: (p, ps) => {
      if (p == null || ps == null) return "neutral";
      if (p > ps) return "buy";
      if (p < ps) return "sell";
      return "neutral";
    },
  };
}

/**
 * 🧠 Jalankan backtest inti (logika transaksi)
 */
export function runBacktestCore(
  data,
  indicatorName,
  funcs,
  useStoredSignals = false,
) {
  let cap = INITIAL_CAPITAL,
    pos = null,
    entry = 0,
    wins = 0,
    trades = 0;
  const curve = [];

  let signalCounts = {
    buy: 0,
    sell: 0,
    neutral: 0,
  };

  // Mapping indicator names to stored signal field names
  const signalFieldMap = {
    RSI: "rsiSignal",
    MACD: "macdSignal",
    SMA: "smaSignal",
    EMA: "emaSignal",
    BollingerBands: "bbSignal",
    Stochastic: "stochSignal",
    StochasticRSI: "stochRsiSignal",
    PSAR: "psarSignal",
  };

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const price = c.close;
    // Skip hanya jika data harga benar-benar kosong.
    if (price == null) {
      curve.push(cap);
      continue;
    }

    let signal = "neutral";

    // Use stored signals from database if available and requested
    if (useStoredSignals && signalFieldMap[indicatorName]) {
      signal = c[signalFieldMap[indicatorName]] || "neutral";
    } else {
      // Calculate signals on-the-fly using signal functions
      switch (indicatorName) {
        case "RSI":
          signal = funcs.rsi(c.rsi);
          break;
        case "MACD":
          signal = funcs.macd(c.macd, c.macdSignalLine, c.macdHist);
          break;
        case "SMA":
          signal = funcs.sma(c.sma20, c.sma50, price);
          break;
        case "EMA":
          signal = funcs.ema(c.ema20, c.ema50);
          break;
        case "BollingerBands":
          signal = funcs.bollingerBands(
            price,
            c.bbUpper,
            c.bbLower,
            c.bbMiddle,
          );
          break;
        case "Stochastic":
          signal = funcs.stochastic(c.stochK, c.stochD);
          break;
        case "StochasticRSI":
          signal = funcs.stochasticRSI(c.stochRsiK, c.stochRsiD);
          break;
        case "PSAR":
          signal = funcs.psar(price, c.psar);
          break;
        default:
          signal = "neutral";
      }
    }

    // Track signal counts
    signalCounts[signal] = (signalCounts[signal] || 0) + 1;

    const score = scoreSignal(signal);

    if (score > 0 && !pos) {
      pos = "BUY";
      entry = price;
    } else if (score < 0 && pos) {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      cap += (cap / entry) * pnl;
      pos = null;
      trades++;
    }
    curve.push(cap);
  }

  if (pos) {
    const pnl = data.at(-1).close - entry;
    if (pnl > 0) wins++;
    cap += (cap / entry) * pnl;
    trades++;
  }

  // Log signal distribution
  console.log(`  Signal distribution for ${indicatorName}:`, signalCounts);
  console.log(`  Trades executed: ${trades}, Wins: ${wins}`);

  // 📊 Calculate performance metrics based on thesis requirements
  // 1. ROI = ((Final Capital - Initial Capital) / Initial Capital) * 100
  const roi = calculateROI(cap, INITIAL_CAPITAL);

  // 2. Win Rate = (Winning Trades / Total Trades) * 100
  const winRate = calculateWinRate(wins, trades);

  // 3. Maximum Drawdown = (Peak - Lowest After Peak) / Peak * 100
  const maxDrawdown = calculateMaxDrawDown(curve);

  // 4. Sharpe Ratio = Average Return / Std Dev of Returns (risk-free rate = 0)
  const sharpeRatio = calculateSharpeRatio(curve);

  return {
    roi,
    winRate,
    maxDrawdown,
    trades,
    wins,
    finalCapital: +cap.toFixed(2),
    sharpeRatio,
  };
}
