/**
 * 📊 SINGLE INDICATOR BACKTEST SERVICE
 * ---------------------------------------------------------------
 * Based on Academic Standards: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * Features:
 * - Single indicator backtesting (RSI, MACD, SMA, EMA, etc.)
 * - All indicators comparison
 * - Academic-grade performance metrics
 */

const INITIAL_CAPITAL = 10000;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/* ==========================================================
   🧠 SIGNAL FUNCTIONS (Shared from indicator service)
========================================================== */
const signalFuncs = {
  rsi: (v) => {
    if (v < RSI_OVERSOLD) return "strong_buy";
    if (v < 40) return "buy";
    if (v > RSI_OVERBOUGHT) return "strong_sell";
    if (v > 60) return "sell";
    return "neutral";
  },

  macd: (m, s, h, prevH) => {
    if (!m || !s || h == null) return "neutral";
    const macdCross = m > s ? 1 : m < s ? -1 : 0;
    let histMomentum = 0;
    if (prevH != null) {
      if (h > 0 && h > prevH) histMomentum = 1;
      if (h < 0 && h < prevH) histMomentum = -1;
    }
    const score = macdCross + histMomentum;
    if (score >= 2) return "strong_buy";
    if (score >= 1) return "buy";
    if (score <= -2) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  stochastic: (k, d, prevK, prevD) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
      if (prevK && prevD && k > prevK && d > prevD) return "strong_buy";
      return "buy";
    }
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
      if (prevK && prevD && k < prevK && d < prevD) return "strong_sell";
      return "sell";
    }
    if (k > d && prevK && prevD && prevK <= prevD) return "buy";
    if (k < d && prevK && prevD && prevK >= prevD) return "sell";
    return "neutral";
  },

  stochasticRsi: (k, d, prevK, prevD) => {
    if (!k || !d) return "neutral";
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
      if (prevK && prevD && k > prevK && d > prevD) return "strong_buy";
      return "buy";
    }
    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
      if (prevK && prevD && k < prevK && d < prevD) return "strong_sell";
      return "sell";
    }
    return "neutral";
  },

  sma: (s20, s50, s200, p, prevS20, prevS50) => {
    if (!p || !s20 || !s50) return "neutral";
    let score = 0;
    if (p > s20) score += 1;
    if (p > s50) score += 1;
    if (s200 && p > s200) score += 1;
    if (s20 > s50) score += 1;
    if (s200 && s50 > s200) score += 1;
    if (prevS20 && prevS50) {
      if (s20 > prevS20 && s50 > prevS50) score += 1;
      if (s20 < prevS20 && s50 < prevS50) score -= 1;
    }
    if (score >= 5) return "strong_buy";
    if (score >= 3) return "buy";
    if (score <= -3) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  ema: (e20, e50, e200, p, prevE20, prevE50) => {
    if (!p || !e20 || !e50) return "neutral";
    let score = 0;
    if (p > e20) score += 1;
    if (p > e50) score += 1;
    if (e200 && p > e200) score += 1;
    if (e20 > e50) score += 1;
    if (e200 && e50 > e200) score += 1;
    if (prevE20 && prevE50) {
      if (e20 > prevE20 && e50 > prevE50) score += 1;
      if (e20 < prevE20 && e50 < prevE50) score -= 1;
    }
    if (score >= 5) return "strong_buy";
    if (score >= 3) return "buy";
    if (score <= -3) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  psar: (p, ps, prevP, prevPS) => {
    if (!p || !ps) return "neutral";
    const currentSignal = p > ps ? "buy" : p < ps ? "sell" : "neutral";
    if (prevP && prevPS) {
      const prevSignal =
        prevP > prevPS ? "buy" : prevP < prevPS ? "sell" : "neutral";
      if (currentSignal === "buy" && prevSignal === "sell") return "strong_buy";
      if (currentSignal === "sell" && prevSignal === "buy")
        return "strong_sell";
    }
    return currentSignal;
  },

  bollingerBands: (p, up, mid, low, prevUp, prevLow, prevP) => {
    if (!p || !up || !low) return "neutral";

    // Derive middle band if not provided
    const middle = mid ?? (up + low) / 2;

    // Calculate position in band (0 = lower band, 1 = upper band)
    const width = up - low;
    if (!isFinite(width) || width <= 0) return "neutral";

    const position = (p - low) / width;

    // 🔥 BREAKOUT DETECTION (with previous data validation)
    if (prevP != null && prevUp != null && prevLow != null) {
      const prevWidth = prevUp - prevLow;
      if (isFinite(prevWidth) && prevWidth > 0) {
        // Strong sell: Price breaks above upper band
        if (p > up && prevP <= prevUp) return "strong_sell";
        // Strong buy: Price breaks below lower band
        if (p < low && prevP >= prevLow) return "strong_buy";

        // Squeeze detection (band narrowing = volatility compression)
        const squeeze = width < prevWidth * 0.95;

        // Near band edges
        if (position >= 0.85) return squeeze ? "strong_sell" : "sell";
        if (position <= 0.15) return squeeze ? "strong_buy" : "buy";
      }
    }

    // 🔹 SIMPLE POSITION-BASED SIGNALS (fallback)
    if (position >= 0.9) return "sell";
    if (position <= 0.1) return "buy";
    if (position >= 0.4 && position <= 0.6) return "neutral";
    return position > 0.5 ? "sell" : "buy";
  },
};

const scoreSignal = (signal) => {
  switch (signal) {
    case "strong_buy":
      return 2;
    case "buy":
      return 1;
    case "neutral":
      return 0;
    case "sell":
      return -1;
    case "strong_sell":
      return -2;
    default:
      return 0;
  }
};

/* ==========================================================
   📊 CALCULATE INDIVIDUAL INDICATOR SIGNALS
========================================================== */
function calculateIndividualSignals(ind, prevInd = null) {
  const p = ind.close;
  const prevP = prevInd?.close;

  return {
    SMA: signalFuncs.sma(
      ind.sma20,
      ind.sma50,
      ind.sma200,
      p,
      prevInd?.sma20,
      prevInd?.sma50
    ),
    EMA: signalFuncs.ema(
      ind.ema20,
      ind.ema50,
      ind.ema200,
      p,
      prevInd?.ema20,
      prevInd?.ema50
    ),
    RSI: signalFuncs.rsi(ind.rsi),
    MACD: signalFuncs.macd(
      ind.macd,
      ind.macdSignalLine,
      ind.macdHist,
      prevInd?.macdHist
    ),
    BollingerBands: signalFuncs.bollingerBands(
      p,
      ind.bbUpper,
      ind.bbMiddle,
      ind.bbLower,
      prevInd?.bbUpper,
      prevInd?.bbLower,
      prevP // ✅ FIX: Add missing prevP parameter
    ),
    Stochastic: signalFuncs.stochastic(
      ind.stochK,
      ind.stochD,
      prevInd?.stochK,
      prevInd?.stochD
    ),
    PSAR: signalFuncs.psar(p, ind.psar, prevP, prevInd?.psar),
    StochasticRSI: signalFuncs.stochasticRsi(
      ind.stochRsiK,
      ind.stochRsiD,
      prevInd?.stochRsiK,
      prevInd?.stochRsiD
    ),
  };
}

/* ==========================================================
   📈 BACKTEST SINGLE INDICATOR
========================================================== */
export async function backtestSingleIndicator(data, indicatorName) {
  if (!data?.length) {
    throw new Error("Historical data is required for backtest.");
  }

  const validIndicators = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];
  if (!validIndicators.includes(indicatorName)) {
    throw new Error(
      `Invalid indicator: ${indicatorName}. Valid options: ${validIndicators.join(", ")}`
    );
  }

  console.log(`\n📊 BACKTESTING SINGLE INDICATOR: ${indicatorName}`);
  console.log(`📈 Data points: ${data.length}`);
  console.log(`💰 Initial capital: $${INITIAL_CAPITAL}`);
  console.log(`🚀 Starting backtest...\n`);

  const startTime = Date.now();
  let cap = INITIAL_CAPITAL;
  let pos = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const tradeHistory = [];

  // Extract date range
  const startDate = data[0]?.time
    ? new Date(Number(data[0].time)).toISOString()
    : null;
  const endDate = data[data.length - 1]?.time
    ? new Date(Number(data[data.length - 1].time)).toISOString()
    : null;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const prevC = i > 0 ? data[i - 1] : null;
    const price = c.close;

    const signals = calculateIndividualSignals(c, prevC);
    const signal = signals[indicatorName];
    const signalScore = scoreSignal(signal);

    if (signalScore > 0 && !pos) {
      pos = "BUY";
      entry = price;
      tradeHistory.push({
        index: i,
        time: c.time ? Number(c.time) : i,
        action: "BUY",
        price: price,
        signal: signal,
        capital: cap,
      });
    } else if (signalScore < 0 && pos === "BUY") {
      const pnl = price - entry;
      const percentGain = (pnl / entry) * 100;
      if (pnl > 0) wins++;
      cap += (cap / entry) * pnl;
      trades++;
      tradeHistory.push({
        index: i,
        time: c.time ? Number(c.time) : i,
        action: "SELL",
        price: price,
        signal: signal,
        pnl: +pnl.toFixed(2),
        percentGain: +percentGain.toFixed(2),
        capital: +cap.toFixed(2),
        isWin: pnl > 0,
      });
      pos = null;
    }

    if ((i + 1) % 50 === 0 || i + 1 === data.length) {
      const progress = (((i + 1) / data.length) * 100).toFixed(1);
      console.log(
        `✅ Progress: ${i + 1}/${data.length} (${progress}%) | Trades: ${trades} | Capital: $${cap.toFixed(2)}`
      );
    }
  }

  // Force close open position
  if (pos === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    const percentGain = (pnl / entry) * 100;
    if (pnl > 0) wins++;
    cap += (cap / entry) * pnl;
    trades++;
    tradeHistory.push({
      index: data.length - 1,
      time: data[data.length - 1].time
        ? Number(data[data.length - 1].time)
        : data.length - 1,
      action: "SELL (FORCED)",
      price: lastPrice,
      signal: "neutral",
      pnl: +pnl.toFixed(2),
      percentGain: +percentGain.toFixed(2),
      capital: +cap.toFixed(2),
      isWin: pnl > 0,
    });
    console.log(`⚠️  Force-closed open position at end of backtest`);
  }

  const roi = ((cap - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n🏆 BACKTEST COMPLETE!`);
  console.log(`⏱️  Time elapsed: ${elapsedTime}s`);
  console.log(`📊 Indicator: ${indicatorName}`);
  console.log(`💰 Final Capital: $${cap.toFixed(2)}`);
  console.log(`📈 ROI: ${roi.toFixed(2)}%`);
  console.log(`🎯 Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`📝 Total Trades: ${trades}\n`);

  return {
    success: true,
    indicator: indicatorName,
    methodology: "Single Indicator Backtest (Sukma & Namahoot, 2025)",
    initialCapital: INITIAL_CAPITAL,
    finalCapital: +cap.toFixed(2),
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    trades,
    wins,
    losses: trades - wins,
    startDate,
    endDate,
    tradeHistory: tradeHistory.slice(0, 100),
    totalTradeHistory: tradeHistory.length,
    dataPoints: data.length,
    executionTime: elapsedTime + "s",
    timestamp: new Date().toISOString(),
  };
}

/* ==========================================================
   📊 BACKTEST ALL INDICATORS (Comparison)
========================================================== */
export async function backtestAllIndicators(data) {
  if (!data?.length) {
    throw new Error("Historical data is required for backtest.");
  }

  const indicators = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];

  console.log(`\n🎯 BACKTESTING ALL INDICATORS`);
  console.log(`📊 Indicators: ${indicators.join(", ")}`);
  console.log(`📈 Data points: ${data.length}`);
  console.log(`💰 Initial capital: $${INITIAL_CAPITAL}\n`);

  const startTime = Date.now();
  const results = [];
  const startDate = data[0]?.time
    ? new Date(Number(data[0].time)).toISOString()
    : null;
  const endDate = data[data.length - 1]?.time
    ? new Date(Number(data[data.length - 1].time)).toISOString()
    : null;

  for (const indicator of indicators) {
    console.log(`\n🔍 Testing ${indicator}...`);
    try {
      const result = await backtestSingleIndicator(data, indicator);
      results.push({
        indicator,
        roi: result.roi,
        winRate: result.winRate,
        trades: result.trades,
        wins: result.wins,
        losses: result.losses,
        finalCapital: result.finalCapital,
      });
    } catch (error) {
      console.error(`❌ Failed to backtest ${indicator}:`, error.message);
      results.push({
        indicator,
        error: error.message,
        roi: 0,
        winRate: 0,
        trades: 0,
      });
    }
  }

  results.sort((a, b) => b.roi - a.roi);
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n🏆 ALL INDICATORS BACKTEST COMPLETE!`);
  console.log(`⏱️  Total time: ${elapsedTime}s`);
  console.log(`\n📊 RANKING (by ROI):`);
  results.forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.indicator}: ROI ${r.roi}%, Win Rate ${r.winRate}%, Trades: ${r.trades}`
    );
  });

  return {
    success: true,
    methodology: "Single Indicator Comparison (Sukma & Namahoot, 2025)",
    indicators,
    results,
    bestIndicator: results[0],
    startDate,
    endDate,
    dataPoints: data.length,
    executionTime: elapsedTime + "s",
    timestamp: new Date().toISOString(),
  };
}
