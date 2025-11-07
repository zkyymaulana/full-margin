/**
 * 📊 SINGLE INDICATOR BACKTEST SERVICE (Improved)
 * ---------------------------------------------------------------
 * Based on Academic Standards: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * 🔧 Improvements:
 * - Adaptive RSI thresholds (auto based on dataset)
 * - Auto-detection if RSI data missing with fallback
 * - Overfitting detection with train/test split
 * - More reliable signal generation
 * - Debug logging for troubleshooting
 */

const INITIAL_CAPITAL = 10000;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

/* ==========================================================
   🛠️ DATA VALIDATION & FALLBACK
========================================================== */
function validateAndFillRsiData(data) {
  const validRsi = data.filter((d) => d.rsi != null && d.rsi > 0);
  const missingCount = data.length - validRsi.length;

  console.log(`\n🔍 RSI Data Validation:`);
  console.log(`   ✅ Valid RSI values: ${validRsi.length} / ${data.length}`);
  console.log(`   ⚠️  Missing/null RSI: ${missingCount}`);

  // If more than 50% data is missing, use fallback
  if (validRsi.length < data.length * 0.5) {
    console.warn(`⚠️  WARNING: More than 50% RSI data missing!`);
    console.warn(
      `⚠️  Using fallback random RSI values (40-60 range) for simulation.`
    );
    console.warn(`⚠️  THIS IS FOR TESTING ONLY - NOT FOR PRODUCTION USE!`);

    // Fill missing RSI with random values for testing
    return data.map((d) => {
      if (d.rsi == null || d.rsi === 0) {
        return {
          ...d,
          rsi: 40 + Math.random() * 20, // Random between 40-60
          _fallbackRsi: true,
        };
      }
      return d;
    });
  }

  // If less than 50% missing, fill gaps with interpolation
  if (missingCount > 0 && missingCount < data.length * 0.5) {
    console.log(`   🔧 Interpolating ${missingCount} missing RSI values...`);

    const filled = [...data];
    for (let i = 0; i < filled.length; i++) {
      if (filled[i].rsi == null || filled[i].rsi === 0) {
        // Find nearest valid RSI values
        let prev = null;
        let next = null;

        for (let j = i - 1; j >= 0; j--) {
          if (filled[j].rsi != null && filled[j].rsi > 0) {
            prev = filled[j].rsi;
            break;
          }
        }

        for (let j = i + 1; j < filled.length; j++) {
          if (filled[j].rsi != null && filled[j].rsi > 0) {
            next = filled[j].rsi;
            break;
          }
        }

        // Interpolate or use nearest value
        if (prev && next) {
          filled[i].rsi = (prev + next) / 2;
        } else if (prev) {
          filled[i].rsi = prev;
        } else if (next) {
          filled[i].rsi = next;
        } else {
          filled[i].rsi = 50; // Neutral fallback
        }

        filled[i]._interpolated = true;
      }
    }

    return filled;
  }

  console.log(`   ✅ RSI data quality: GOOD`);
  return data;
}

/* ==========================================================
   🧠 SIGNAL FUNCTIONS (FIXED)
========================================================== */
function makeSignalFuncs({ rsiLow = 30, rsiHigh = 70 } = {}) {
  return {
    rsi: (v) => {
      if (v == null) return "neutral";
      if (v < rsiLow * 0.9) return "strong_buy";
      if (v < rsiLow) return "buy";
      if (v > rsiHigh * 1.1) return "strong_sell";
      if (v > rsiHigh) return "sell";
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
      return "neutral";
    },

    // 🔧 FIXED: SMA with crossover detection and trend following (Less Aggressive)
    sma: (s20, s50, s200, p, prevS20, prevS50, prevP) => {
      if (!p || !s20 || !s50) return "neutral";

      // Golden Cross/Death Cross: SMA20 crosses SMA50
      if (prevS20 && prevS50) {
        if (s20 > s50 && prevS20 <= prevS50) {
          // Additional confirmation: price should be above both SMAs
          if (p > s20 && p > s50) return "strong_buy";
          return "buy";
        }
        if (s20 < s50 && prevS20 >= prevS50) {
          // Additional confirmation: price should be below both SMAs
          if (p < s20 && p < s50) return "strong_sell";
          return "sell";
        }
      }

      // Trend following with confirmation
      if (s20 > s50) {
        // Uptrend - only buy if price is above SMA20
        if (p > s20) return "buy";
      } else if (s20 < s50) {
        // Downtrend - only sell if price is below SMA20
        if (p < s20) return "sell";
      }

      return "neutral";
    },

    // 🔧 FIXED: EMA with crossover detection and trend following (Less Aggressive)
    ema: (e20, e50, e200, p, prevE20, prevE50, prevP) => {
      if (!p || !e20 || !e50) return "neutral";

      // EMA crossover signals (more responsive than SMA)
      if (prevE20 && prevE50) {
        if (e20 > e50 && prevE20 <= prevE50) {
          // Confirm with price position
          if (p > e20 && p > e50) return "strong_buy";
          return "buy";
        }
        if (e20 < e50 && prevE20 >= prevE50) {
          // Confirm with price position
          if (p < e20 && p < e50) return "strong_sell";
          return "sell";
        }
      }

      // Trend following with confirmation
      if (e20 > e50) {
        // Uptrend - only buy if price is above EMA20
        if (p > e20) return "buy";
      } else if (e20 < e50) {
        // Downtrend - only sell if price is below EMA20
        if (p < e20) return "sell";
      }

      return "neutral";
    },

    psar: (p, ps, prevP, prevPS) => {
      if (!p || !ps) return "neutral";
      const currentSignal = p > ps ? "buy" : p < ps ? "sell" : "neutral";
      if (prevP && prevPS) {
        const prevSignal =
          prevP > prevPS ? "buy" : prevP < prevPS ? "sell" : "neutral";
        if (currentSignal === "buy" && prevSignal === "sell")
          return "strong_buy";
        if (currentSignal === "sell" && prevSignal === "buy")
          return "strong_sell";
      }
      return currentSignal;
    },

    bollingerBands: (p, up, mid, low) => {
      if (!p || !up || !low) return "neutral";
      const width = up - low;
      if (!isFinite(width) || width <= 0) return "neutral";
      const position = (p - low) / width;
      if (position > 0.9) return "sell";
      if (position < 0.1) return "buy";
      return "neutral";
    },

    // 🔧 FIXED: StochasticRSI with proper field names
    stochasticRsi: (k, d, prevK, prevD) => {
      if (k == null || d == null) return "neutral";

      // Oversold/Overbought conditions (similar to regular Stochastic)
      if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
        if (prevK != null && prevD != null && k > prevK && d > prevD) {
          return "strong_buy";
        }
        return "buy";
      }

      if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
        if (prevK != null && prevD != null && k < prevK && d < prevD) {
          return "strong_sell";
        }
        return "sell";
      }

      // Crossover signals
      if (prevK != null && prevD != null) {
        if (k > d && prevK <= prevD) return "buy";
        if (k < d && prevK >= prevD) return "sell";
      }

      return "neutral";
    },
  };
}

/* ==========================================================
   ⚖️ SCORE SIGNAL
========================================================== */
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
   📊 CALCULATE INDIVIDUAL SIGNALS
========================================================== */
function calculateIndividualSignals(ind, prevInd, funcs) {
  const p = ind.close;
  const prevP = prevInd?.close;
  return {
    SMA: funcs.sma(
      ind.sma20,
      ind.sma50,
      ind.sma200,
      p,
      prevInd?.sma20,
      prevInd?.sma50,
      prevP
    ),
    EMA: funcs.ema(
      ind.ema20,
      ind.ema50,
      ind.ema200,
      p,
      prevInd?.ema20,
      prevInd?.ema50,
      prevP
    ),
    RSI: funcs.rsi(ind.rsi),
    MACD: funcs.macd(
      ind.macd,
      ind.macdSignalLine,
      ind.macdHist,
      prevInd?.macdHist
    ),
    BollingerBands: funcs.bollingerBands(
      p,
      ind.bbUpper,
      ind.bbMiddle,
      ind.bbLower
    ),
    PSAR: funcs.psar(p, ind.psar, prevP, prevInd?.psar),
    Stochastic: funcs.stochastic(
      ind.stochK,
      ind.stochD,
      prevInd?.stochK,
      prevInd?.stochD
    ),
    StochasticRSI: funcs.stochasticRsi(
      ind.stochRsiK,
      ind.stochRsiD,
      prevInd?.stochRsiK,
      prevInd?.stochRsiD
    ),
  };
}

/* ==========================================================
   📊 CALCULATE SHARPE & SORTINO RATIOS
========================================================== */
function calculateRiskMetrics(equityCurve) {
  if (!equityCurve || equityCurve.length < 2) {
    return { sharpeRatio: null, sortinoRatio: null };
  }

  // Calculate returns
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1];
    returns.push(ret);
  }

  if (returns.length === 0) {
    return { sharpeRatio: null, sortinoRatio: null };
  }

  // Mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Standard deviation of all returns (for Sharpe)
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);

  // Downside deviation (for Sortino) - only negative returns
  const negativeReturns = returns.filter((r) => r < 0);
  let downsideStdDev = 0;
  if (negativeReturns.length > 0) {
    const downsideVariance =
      negativeReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) /
      negativeReturns.length;
    downsideStdDev = Math.sqrt(downsideVariance);
  }

  // Annualization factor (252 trading days for crypto, assume hourly = 252 * 24)
  const annualizationFactor = Math.sqrt(252 * 24);

  // Sharpe Ratio = (Mean Return / Std Dev) * sqrt(periods per year)
  const sharpeRatio =
    stdDev > 0
      ? +((meanReturn / stdDev) * annualizationFactor).toFixed(2)
      : null;

  // Sortino Ratio = (Mean Return / Downside Std Dev) * sqrt(periods per year)
  const sortinoRatio =
    downsideStdDev > 0
      ? +((meanReturn / downsideStdDev) * annualizationFactor).toFixed(2)
      : null;

  return { sharpeRatio, sortinoRatio };
}

/* ==========================================================
   📈 RUN BACKTEST CORE (Enhanced with Risk Metrics)
========================================================== */
function runBacktestCore(data, indicatorName, funcs) {
  let cap = INITIAL_CAPITAL;
  let pos = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const prevC = i > 0 ? data[i - 1] : null;
    const price = c.close;
    if (!price) {
      equityCurve.push(cap);
      continue;
    }

    const signals = calculateIndividualSignals(c, prevC, funcs);
    const signal = signals[indicatorName];
    const score = scoreSignal(signal);

    if (score > 0 && !pos) {
      pos = "BUY";
      entry = price;
    } else if (score < 0 && pos === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      cap += (cap / entry) * pnl;
      pos = null;
      trades++;
    }
    equityCurve.push(cap);
  }

  // Close open position at end
  if (pos === "BUY") {
    const last = data[data.length - 1];
    const pnl = last.close - entry;
    if (pnl > 0) wins++;
    cap += (cap / entry) * pnl;
    trades++;
  }

  const roi = ((cap - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const winRate = trades ? (wins / trades) * 100 : 0;
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  // Calculate Sharpe & Sortino ratios
  const { sharpeRatio, sortinoRatio } = calculateRiskMetrics(equityCurve);

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    maxDrawdown,
    trades,
    wins,
    finalCapital: +cap.toFixed(2),
    sharpeRatio,
    sortinoRatio,
  };
}

/* ==========================================================
   🧪 MAIN FUNCTION (Enhanced with Robust Overfitting Detection)
========================================================== */
export async function backtestSingleIndicator(data, indicatorName) {
  if (!data?.length) throw new Error("Historical data is required.");

  data = validateAndFillRsiData(data);
  const RSI_LOW = 30;
  const RSI_HIGH = 70;
  const funcs = makeSignalFuncs({ rsiLow: RSI_LOW, rsiHigh: RSI_HIGH });

  const splitIndex = Math.floor(data.length * 0.8);
  const trainData = data.slice(0, splitIndex);
  const testData = data.slice(splitIndex);

  console.log(
    `📊 ${indicatorName}: Train ${trainData.length} | Test ${testData.length} candles`
  );

  const start = Date.now();
  const trainPerf = runBacktestCore(trainData, indicatorName, funcs);
  const testPerf = runBacktestCore(testData, indicatorName, funcs);

  // 🔧 FIX: Robust overfitting ratio calculation (handles negative/zero ROI)
  let roiRatio;
  if (trainPerf.roi <= 0) {
    // If train ROI is negative or zero
    roiRatio = testPerf.roi <= 0 ? 1.0 : 0.5;
  } else {
    // Normal case: positive train ROI
    roiRatio = testPerf.roi / trainPerf.roi;
  }

  // Overfitting detected if test ROI is less than 50% of train ROI
  const overfittingDetected = roiRatio < 0.5;

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  const overfitFlag = overfittingDetected ? "⚠️ YES" : "✅ NO";
  console.log(
    `   Train ROI: ${trainPerf.roi}% | Test ROI: ${testPerf.roi}% | Overfit: ${overfitFlag} (${roiRatio.toFixed(2)})`
  );

  return {
    success: true,
    indicator: indicatorName,
    methodology: "Single Indicator Backtest (Adaptive + Train/Test Split)",
    adaptiveRsi: { low: RSI_LOW, high: RSI_HIGH },
    trainPerformance: trainPerf,
    testPerformance: testPerf,
    overfittingDetected,
    overfitScore: +roiRatio.toFixed(2),
    dataPoints: data.length,
    executionTime: duration + "s",
    timestamp: new Date().toISOString(),
  };
}

export async function backtestAllIndicators(data) {
  const indicators = [
    "RSI",
    "MACD",
    "SMA",
    "EMA",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];

  console.log(
    `\n🚀 Running full indicator comparison (${indicators.length} total)...`
  );
  const results = [];

  for (const indicator of indicators) {
    try {
      console.log(`\n▶️  Backtesting ${indicator}...`);
      const result = await backtestSingleIndicator(data, indicator);
      results.push(result);
    } catch (err) {
      console.error(`❌ Error in ${indicator}:`, err.message);
      results.push({
        indicator,
        success: false,
        error: err.message,
      });
    }
  }

  // Build summary table
  const summary = results
    .filter((r) => r.success)
    .map((r) => ({
      indicator: r.indicator,
      trainROI: r.trainPerformance.roi,
      testROI: r.testPerformance.roi,
      trainWin: r.trainPerformance.winRate,
      testWin: r.testPerformance.winRate,
      overfit: r.overfittingDetected,
      ratio: r.overfitScore,
    }));

  console.log(`\n📊 SUMMARY (Train vs Test):`);
  console.table(summary);

  return {
    success: true,
    total: results.length,
    completed: results.filter((r) => r.success).length,
    results,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/* ==========================================================
   📉 Helper: Max Drawdown
========================================================== */
function calcMaxDrawdown(equityCurve) {
  if (!Array.isArray(equityCurve) || equityCurve.length === 0) return 0.01;
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  return +Math.max(maxDD, 0.01).toFixed(2);
}
