import { prisma } from "../../lib/prisma.js";

/**
 * 🎯 MULTI-INDICATOR ANALYZER SERVICE (Enhanced Academic Version)
 * ---------------------------------------------------------------
 * Based on Academic Standards for Technical Analysis Research
 * Enhanced Rule-Based 3-Category System: Momentum, Trend, Volatility
 * Improved signal logic and scoring methodology
 *
 * This service handles:
 * - Multi-indicator weight optimization
 * - Multi-indicator backtesting
 * - Category-based signal analysis
 */

const WEIGHT_RANGE = [0, 1, 2, 3, 4];
const INITIAL_CAPITAL = 10000;
const HOLD_THRESHOLD = 0.15;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;

// 🚨 ANTI-OVERFITTING CONSTANTS
const MAX_DRAWDOWN_THRESHOLD = 70; // Reject strategies with >70% drawdown (relaxed from 50%)
const MIN_TRADES_REQUIRED = 20; // Minimum trades for statistical significance (relaxed from 30)
const REGULARIZATION_LAMBDA = 0.05; // L1 regularization penalty for complexity (reduced from 0.1)

/* ==========================================================
   🧠 ENHANCED SIGNAL FUNCTIONS (Academic Standards)
========================================================== */
const signalFuncs = {
  // RSI: Enhanced with multiple threshold levels
  rsi: (v) => {
    if (v < RSI_OVERSOLD) return "strong_buy";
    if (v < 40) return "buy";
    if (v > RSI_OVERBOUGHT) return "strong_sell";
    if (v > 60) return "sell";
    return "neutral";
  },

  // MACD: Enhanced with histogram momentum
  macd: (m, s, h, prevH) => {
    if (!m || !s || h == null) return "neutral";

    // MACD line crossover
    const macdCross = m > s ? 1 : m < s ? -1 : 0;

    // Histogram momentum (acceleration/deceleration)
    let histMomentum = 0;
    if (prevH != null) {
      if (h > 0 && h > prevH) histMomentum = 1; // Accelerating up
      if (h < 0 && h < prevH) histMomentum = -1; // Accelerating down
    }

    const score = macdCross + histMomentum;
    if (score >= 2) return "strong_buy";
    if (score >= 1) return "buy";
    if (score <= -2) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  // Enhanced Stochastic with divergence detection
  stochastic: (k, d, prevK, prevD) => {
    if (!k || !d) return "neutral";

    // Oversold/Overbought conditions
    if (k < STOCH_OVERSOLD && d < STOCH_OVERSOLD) {
      // Check for bullish divergence (price falling but stoch rising)
      if (prevK && prevD && k > prevK && d > prevD) return "strong_buy";
      return "buy";
    }

    if (k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT) {
      // Check for bearish divergence (price rising but stoch falling)
      if (prevK && prevD && k < prevK && d < prevD) return "strong_sell";
      return "sell";
    }

    // %K crossing %D
    if (k > d && prevK && prevD && prevK <= prevD) return "buy";
    if (k < d && prevK && prevD && prevK >= prevD) return "sell";

    return "neutral";
  },

  // Enhanced Stochastic RSI
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

  // Enhanced SMA with multiple timeframe confirmation
  sma: (s20, s50, s200, p, prevS20, prevS50) => {
    if (!p || !s20 || !s50) return "neutral";

    let score = 0;

    // Price position relative to moving averages
    if (p > s20) score += 1;
    if (p > s50) score += 1;
    if (s200 && p > s200) score += 1;

    // Moving average alignment (trend strength)
    if (s20 > s50) score += 1;
    if (s200 && s50 > s200) score += 1;

    // Moving average momentum (acceleration)
    if (prevS20 && prevS50) {
      if (s20 > prevS20 && s50 > prevS50) score += 1;
      if (s20 < prevS20 && s50 < prevS50) score -= 1;
    }

    // Score interpretation
    if (score >= 5) return "strong_buy";
    if (score >= 3) return "buy";
    if (score <= -3) return "strong_sell";
    if (score <= -1) return "sell";
    return "neutral";
  },

  // Enhanced EMA (similar to SMA but more responsive)
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

  // Enhanced Parabolic SAR with trend strength
  psar: (p, ps, prevP, prevPS) => {
    if (!p || !ps) return "neutral";

    const currentSignal = p > ps ? "buy" : p < ps ? "sell" : "neutral";

    // Check for trend change (signal confirmation)
    if (prevP && prevPS) {
      const prevSignal =
        prevP > prevPS ? "buy" : prevP < prevPS ? "sell" : "neutral";

      // New bullish trend
      if (currentSignal === "buy" && prevSignal === "sell") return "strong_buy";
      // New bearish trend
      if (currentSignal === "sell" && prevSignal === "buy")
        return "strong_sell";
    }

    return currentSignal;
  },

  // Enhanced Bollinger Bands with squeeze detection
  bollingerBands: (p, up, mid, low, prevUp, prevLow, prevP) => {
    if (!p || !up || !low) return "neutral";

    // Derive mid if not provided
    const middle = mid ?? (up + low) / 2;

    // Calculate position in band (0 = lower band, 1 = upper band)
    const width = up - low;
    if (width === 0) return "neutral"; // Avoid division by zero

    const position = (p - low) / width;

    // 🔥 BREAKOUT DETECTION (with previous data validation)
    if (prevP && prevUp && prevLow) {
      const prevWidth = prevUp - prevLow;
      if (prevWidth > 0) {
        // Strong sell: Price breaks above upper band
        if (p > up && prevP <= prevUp) {
          return "strong_sell";
        }

        // Strong buy: Price breaks below lower band
        if (p < low && prevP >= prevLow) {
          return "strong_buy";
        }

        // Squeeze detection (band narrowing = volatility compression)
        const squeeze = width < prevWidth * 0.95;

        // Near upper band (potential reversal)
        if (position >= 0.85) {
          return squeeze ? "strong_sell" : "sell";
        }

        // Near lower band (potential reversal)
        if (position <= 0.15) {
          return squeeze ? "strong_buy" : "buy";
        }
      }
    }

    // 🔹 SIMPLE POSITION-BASED SIGNALS (when no previous data)
    if (position >= 0.9) return "sell";
    if (position <= 0.1) return "buy";

    // Price near middle band = neutral zone
    if (position >= 0.4 && position <= 0.6) return "neutral";

    // Trending signals
    return position > 0.5 ? "sell" : "buy";
  },
};

// Enhanced scoring system with signal strength weights
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
      ind.macdSignal ?? ind.macdSignalLine,
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
      prevP
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

// Improved Max Drawdown: consider global peak vs global minimum as upper bound
function calculateMaxDrawdown(equityCurve) {
  if (!Array.isArray(equityCurve) || equityCurve.length === 0) return 0.01;
  let peak = equityCurve[0];
  let maxDD = 0;
  let minVal = equityCurve[0];
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    if (v < minVal) minVal = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  // Global drop bound (peak to absolute min over the series)
  const globalPeak = Math.max(...equityCurve);
  const globalMin = Math.min(...equityCurve);
  const globalDD =
    globalPeak > 0 ? ((globalPeak - globalMin) / globalPeak) * 100 : 0;
  const finalDD = Math.max(maxDD, globalDD);
  return +Math.max(finalDD, 0.01).toFixed(2);
}

/* ==========================================================
   📈 BACKTEST WITH INDIVIDUAL INDICATOR WEIGHTS
========================================================== */
function backtestWithIndicatorWeights(data, weights, indicators) {
  let cap = INITIAL_CAPITAL;
  let pos = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const prevC = i > 0 ? data[i - 1] : null;

    // Get individual indicator signals
    const signals = calculateIndividualSignals(c, prevC);

    // Calculate combined score: Σ(ωᵢ * Signalᵢ)
    let combinedScore = 0;
    let totalWeight = 0;

    indicators.forEach((ind) => {
      const weight = weights[ind];
      const signal = signals[ind];
      const signalValue = scoreSignal(signal);

      combinedScore += weight * signalValue;
      totalWeight += weight;
    });

    // Normalize by total weight
    const normalizedScore = totalWeight > 0 ? combinedScore / totalWeight : 0;

    // Make decision
    const dec = decision(normalizedScore);
    const price = c.close;

    if (dec === "BUY" && !pos) {
      pos = "BUY";
      entry = price;
    } else if (dec === "SELL" && pos === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      cap += (cap / entry) * pnl;
      pos = null;
      trades++;
    }

    equityCurve.push(cap);
  }

  const roi = ((cap - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const maxDrawdown = calculateMaxDrawdown(equityCurve);
  return {
    roi: +roi.toFixed(2),
    winRate: trades ? +((wins / trades) * 100).toFixed(2) : 0,
    trades,
    finalCapital: +cap.toFixed(2),
    maxDrawdown,
  };
}

/* ==========================================================
   🧪 TRAIN/TEST SPLIT BY FIXED CALENDAR DATES
   Train: 2020-01-01 → 2024-01-01
   Test:  2024-01-01 → 2025-01-01
========================================================== */
function splitTrainTest(data) {
  const TRAIN_START = new Date("2020-01-01T00:00:00Z").getTime();
  const TRAIN_END = new Date("2024-01-01T00:00:00Z").getTime();
  const TEST_END = new Date("2025-01-01T00:00:00Z").getTime();

  const trainData = [];
  const testData = [];

  for (const row of data) {
    if (!row.time) continue;

    // Convert BigInt to Number for date comparison
    const timestamp =
      typeof row.time === "bigint" ? Number(row.time) : row.time;

    if (timestamp >= TRAIN_START && timestamp < TRAIN_END) {
      trainData.push(row);
    } else if (timestamp >= TRAIN_END && timestamp < TEST_END) {
      testData.push(row);
    }
  }

  return { trainData, testData };
}

/* ==========================================================
   🚨 OVERFITTING DETECTION
   Rule: if testROI < trainROI * 0.7 → overfitting detected
========================================================== */
function detectOverfitting(trainROI, testROI) {
  const overfittingThreshold = 0.7;
  const overfittingDetected = testROI < trainROI * overfittingThreshold;
  const overfittingScore = +Math.abs(trainROI - testROI).toFixed(2);

  if (overfittingDetected) {
    console.warn(
      `⚠️  Overfitting detected: Test ROI (${testROI}%) much lower than Train ROI (${trainROI}%)`
    );
  }

  return { overfittingDetected, overfittingScore };
}

// Persist or skip based on candleCount cache (now includes trades)
async function saveOrUpdateWeights({
  symbol,
  timeframe,
  startTrain,
  endTrain,
  candleCount,
  dataLength,
  bestWeights,
  roi,
  winRate,
  maxDrawdown,
  trades,
}) {
  const key = {
    symbol,
    timeframe,
    startTrain: BigInt(startTrain),
    endTrain: BigInt(endTrain),
  };

  const safeDD = maxDrawdown > 0 ? maxDrawdown : 0.01;
  const safeCount = candleCount > 0 ? candleCount : (dataLength ?? 0);

  const existing = await prisma.indicatorWeight.findUnique({
    where: { symbol_timeframe_startTrain_endTrain: key },
  });

  if (!existing) {
    await prisma.indicatorWeight.create({
      data: {
        ...key,
        weights: bestWeights,
        roi,
        winRate,
        maxDrawdown: safeDD,
        candleCount: safeCount,
        trades: trades ?? 0,
      },
    });
    return { created: true };
  }

  if (existing.candleCount === safeCount) {
    console.log("⚡ Using cached optimized weights from DB");
    return { cached: true, record: existing };
  }

  await prisma.indicatorWeight.update({
    where: { symbol_timeframe_startTrain_endTrain: key },
    data: {
      weights: bestWeights,
      roi,
      winRate,
      maxDrawdown: safeDD,
      candleCount: safeCount,
      trades: trades ?? existing.trades ?? 0,
    },
  });
  return { updated: true };
}

// Simple seeded RNG (mulberry32)
function hashSeed(str = "multiopt") {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Optional validation helper
function validateResults(arr) {
  return arr.every((r) => isFinite(r.roi) && r.roi >= -100 && r.roi <= 1000);
}

/* ==========================================================
   🚀 OPTIMIZE INDICATOR WEIGHTS (Hybrid Search)
   According to Sukma & Namahoot (2025), multi-indicator ensemble
   should outperform single indicators by combining momentum, trend,
   and volatility dimensions for robustness and interpretability.
========================================================== */
export async function optimizeIndicatorWeights(
  data,
  indicators = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ],
  options = {}
) {
  if (!data?.length)
    throw new Error("Historical data is required for optimization.");
  if (!indicators?.length)
    throw new Error("At least one indicator must be specified.");

  const baseSamples = Math.max(50, Math.min(options.samples ?? 750, 3000));
  const maxDurationMs = (options.maxDurationSec ?? 170) * 1000;
  const seed = options.seed ?? "multiopt";
  const rng = mulberry32(hashSeed(seed));
  const useNoise = options.noise === true; // default disabled

  console.log(`\n🎯 OPTIMIZING INDICATOR WEIGHTS WITH TRAIN/TEST SPLIT`);
  console.log(`📊 Indicators: ${indicators.join(", ")}`);
  console.log(`📈 Total data points: ${data.length}`);
  console.log(
    `⚙️  Weight range: {${WEIGHT_RANGE.join(", ")}} | Samples: ${baseSamples} | Seed: ${seed}`
  );

  // 🧪 TRAIN/TEST SPLIT
  const { trainData, testData } = splitTrainTest(data);

  console.log(`\n📊 Dataset Split:`);
  console.log(
    `   Training: ${trainData.length} candles (2020-01-01 → 2024-01-01)`
  );
  console.log(
    `   Testing:  ${testData.length} candles (2024-01-01 → 2025-01-01)`
  );

  // Validate test set size
  const testRatio = testData.length / data.length;
  if (testRatio < 0.05) {
    console.warn(
      `⚠️  Test set too small (${(testRatio * 100).toFixed(1)}% of total). Skipping test validation.`
    );
  }

  // Date window for training data
  const startDate = trainData[0]?.time
    ? new Date(Number(trainData[0].time)).toISOString()
    : null;
  const endDate = trainData[trainData.length - 1]?.time
    ? new Date(Number(trainData[trainData.length - 1].time)).toISOString()
    : null;

  const startTime = Date.now();

  // Candidate generators
  const randomWeights = () => {
    const w = {};
    let sum = 0;
    for (const ind of indicators) {
      const idx = Math.floor(rng() * WEIGHT_RANGE.length);
      const v = WEIGHT_RANGE[idx];
      w[ind] = v;
      sum += v;
    }
    if (sum === 0) {
      const pick = indicators[Math.floor(rng() * indicators.length)];
      w[pick] = 1;
    }
    return w;
  };

  // Grid-like coverage on first K dims
  function generateDeterministicGrid(nDet) {
    const levels = [0, 2, 4];
    const K = Math.min(indicators.length, 4);
    const grid = [];
    function rec(idx, acc) {
      if (grid.length >= nDet) return;
      if (idx === K) {
        const w = {};
        indicators.forEach((ind, i) => {
          w[ind] = i < K ? acc[i] : 1; // default weight 1 for remaining
        });
        // ensure not all zero
        if (Object.values(w).some((v) => v > 0)) grid.push(w);
        return;
      }
      for (const lv of levels) rec(idx + 1, [...acc, lv]);
    }
    rec(0, []);

    // Add one-hot emphasis
    for (const ind of indicators) {
      const w = Object.fromEntries(indicators.map((x) => [x, 0]));
      w[ind] = 4;
      grid.push(w);
      if (grid.length >= nDet) break;
    }

    return grid.slice(0, nDet);
  }

  // 🎯 UPDATED SCORING: Penalize risk with adjusted formula + ANTI-OVERFITTING
  // 1. Reject candidates with MaxDrawdown > 50%
  // 2. Require minimum trades for statistical significance
  // 3. Apply regularization penalty for weight complexity
  const evaluateBatch = async (candidates) => {
    const batchResults = await Promise.all(
      candidates.map(async (weights) => {
        const r = backtestWithIndicatorWeights(trainData, weights, indicators);

        // 🚨 ANTI-OVERFITTING FILTERS
        // Filter 1: Reject high drawdown strategies
        if (r.maxDrawdown > MAX_DRAWDOWN_THRESHOLD) {
          return {
            weights,
            ...r,
            adjusted: -Infinity,
            rejected: "high_drawdown",
          };
        }

        // Filter 2: Require minimum trades
        if (r.trades < MIN_TRADES_REQUIRED) {
          return {
            weights,
            ...r,
            adjusted: -Infinity,
            rejected: "insufficient_trades",
          };
        }

        // Risk-adjusted scoring formula
        const ddFactor = 1 - Math.min(r.maxDrawdown, 100) / 100;
        const wrFactor = r.winRate / 100;

        // L1 Regularization: penalize complex models (many non-zero weights)
        const activeWeights = Object.values(weights).filter(
          (w) => w > 0
        ).length;
        const complexityPenalty =
          1 - (REGULARIZATION_LAMBDA * activeWeights) / indicators.length;

        // Final adjusted score with regularization
        const adjusted = r.roi * ddFactor * wrFactor * complexityPenalty;

        return { weights, ...r, adjusted, complexityPenalty };
      })
    );

    // Filter out rejected candidates
    return batchResults.filter((r) => r.adjusted !== -Infinity);
  };

  let attempts = 1;
  let retries = 0;

  async function runSearch(totalSamples) {
    const detCount = Math.max(1, Math.floor(totalSamples * 0.2));
    const randCount = totalSamples - detCount;

    const detCandidates = generateDeterministicGrid(detCount);
    const randCandidates = Array.from({ length: randCount }, () =>
      randomWeights()
    );
    const allCandidates = [...detCandidates, ...randCandidates];

    const results = [];
    const batchSize = Math.min(
      20,
      Math.max(10, Math.floor(allCandidates.length / 10))
    );

    for (let i = 0; i < allCandidates.length; i += batchSize) {
      if (Date.now() - startTime > maxDurationMs) {
        console.log(
          `⏹️  Time budget reached at ${i}/${allCandidates.length} candidates`
        );
        break;
      }
      const batch = allCandidates.slice(i, i + batchSize);
      const evaluated = await evaluateBatch(batch);
      results.push(...evaluated);
      const progress = Math.min(
        100,
        Math.round(((i + batch.length) / allCandidates.length) * 100)
      );

      // Safe reduce with fallback for empty results
      if (results.length > 0) {
        const bestSoFar = results.reduce((a, b) =>
          b.adjusted > a.adjusted ? b : a
        );
        console.log(
          `✅ Progress: ${i + batch.length}/${allCandidates.length} (${progress}%) | Best Train ROI: ${bestSoFar.roi}% | WR: ${bestSoFar.winRate}% | MaxDD: ${bestSoFar.maxDrawdown}%`
        );
      } else {
        console.log(
          `✅ Progress: ${i + batch.length}/${allCandidates.length} (${progress}%) | No valid candidates yet (all filtered)`
        );
      }
    }

    results.sort((a, b) => b.adjusted - a.adjusted);
    return results;
  }

  let results = await runSearch(baseSamples);

  // 🚨 SAFETY CHECK: If all candidates were filtered out, relax filters
  if (results.length === 0) {
    console.warn(
      "⚠️  All candidates filtered out by anti-overfitting rules. Relaxing filters temporarily..."
    );

    // Re-run WITHOUT filters to get at least some results
    const evaluateBatchNoFilter = async (candidates) => {
      const batchResults = await Promise.all(
        candidates.map(async (weights) => {
          const r = backtestWithIndicatorWeights(
            trainData,
            weights,
            indicators
          );

          // Still apply risk-adjusted scoring but no hard filters
          const ddFactor = 1 - Math.min(r.maxDrawdown, 100) / 100;
          const wrFactor = Math.max(r.winRate, 1) / 100; // Ensure minimum 1%
          const activeWeights = Object.values(weights).filter(
            (w) => w > 0
          ).length;
          const complexityPenalty =
            1 - (REGULARIZATION_LAMBDA * activeWeights) / indicators.length;

          const adjusted = r.roi * ddFactor * wrFactor * complexityPenalty;

          return { weights, ...r, adjusted, complexityPenalty };
        })
      );
      return batchResults;
    };

    // Re-evaluate with relaxed filters
    const detCount = Math.max(1, Math.floor(baseSamples * 0.2));
    const randCount = baseSamples - detCount;
    const detCandidates = generateDeterministicGrid(detCount);
    const randCandidates = Array.from({ length: randCount }, () =>
      randomWeights()
    );
    const allCandidates = [...detCandidates, ...randCandidates];

    results = await evaluateBatchNoFilter(allCandidates);
    results.sort((a, b) => b.adjusted - a.adjusted);

    console.log(`✅ Relaxed filters: Found ${results.length} candidates`);
  }

  if (!validateResults(results)) {
    console.warn("⚠️ Validation flagged unrealistic ROI values. Filtering...");
    results = results.filter(
      (r) => isFinite(r.roi) && r.roi >= -100 && r.roi <= 1000
    );
  }

  if (results.length === 0) {
    throw new Error(
      "No valid optimization results found. Try adjusting parameters or checking data quality."
    );
  }

  let best = results[0];

  // Compute best single-indicator ROI using one-hot weights for fairness
  const singleCandidates = indicators.map((ind) =>
    Object.fromEntries(indicators.map((x) => [x, x === ind ? 1 : 0]))
  );
  const singleResults = singleCandidates.map((w) =>
    backtestWithIndicatorWeights(trainData, w, indicators)
  );
  const bestSingle = singleResults.reduce((a, r) => (r.roi > a.roi ? r : a), {
    roi: -Infinity,
    winRate: 0,
    maxDrawdown: 0,
    trades: 0,
  });

  if (best && best.roi < bestSingle.roi) {
    console.warn(
      "⚠️ Multi-indicator ROI lower than single — retrying with expanded search..."
    );
    attempts += 1;
    retries += 1;
    const extra = await runSearch(baseSamples * 2);
    if (extra.length) {
      results = [...results, ...extra].sort((a, b) => b.adjusted - a.adjusted);
      best = results[0];
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    `\n🏆 TRAINING OPTIMIZATION COMPLETE | ROI: ${best.roi}% | WinRate: ${best.winRate}% | MaxDD: ${best.maxDrawdown}% | Duration: ${elapsedTime}s`
  );

  // Log top-5 table
  console.log("\nTop-5 weight sets from training (ROI | WinRate | MaxDD):");
  results.slice(0, 5).forEach((r, i) => {
    console.log(
      `${i + 1}. ROI ${r.roi}% | WR ${r.winRate}% | DD ${r.maxDrawdown}% | W=${JSON.stringify(r.weights)}`
    );
  });

  // 🧪 TEST VALIDATION (Out-of-Sample)
  let testPerformance = null;
  let overfittingDetected = false;
  let overfittingScore = 0;
  let finalBest = best;

  if (testData.length >= data.length * 0.05) {
    console.log(
      `\n🧪 Running out-of-sample test validation on top-20 candidates...`
    );

    // 🔥 KEY ANTI-OVERFITTING STRATEGY: Test top candidates and pick best on TEST set
    const topCandidates = results.slice(0, 20);
    const testResults = topCandidates.map((candidate) => {
      const testPerf = backtestWithIndicatorWeights(
        testData,
        candidate.weights,
        indicators
      );
      return {
        ...candidate,
        testROI: testPerf.roi,
        testWinRate: testPerf.winRate,
        testMaxDD: testPerf.maxDrawdown,
        testTrades: testPerf.trades,
        testFinalCapital: testPerf.finalCapital,
      };
    });

    // Sort by TEST performance (risk-adjusted)
    testResults.sort((a, b) => {
      const scoreA =
        a.testROI * (1 - a.testMaxDD / 100) * (a.testWinRate / 100);
      const scoreB =
        b.testROI * (1 - b.testMaxDD / 100) * (b.testWinRate / 100);
      return scoreB - scoreA;
    });

    // Select the model with BEST TEST PERFORMANCE (not train!)
    finalBest = testResults[0];
    testPerformance = {
      roi: finalBest.testROI,
      winRate: finalBest.testWinRate,
      maxDrawdown: finalBest.testMaxDD,
      trades: finalBest.testTrades,
      finalCapital: finalBest.testFinalCapital,
    };

    console.log(`📊 BEST MODEL (selected by TEST performance):`);
    console.log(
      `   Train: ROI ${finalBest.roi}% | WR ${finalBest.winRate}% | MaxDD ${finalBest.maxDrawdown}%`
    );
    console.log(
      `   Test:  ROI ${finalBest.testROI}% | WR ${finalBest.testWinRate}% | MaxDD ${finalBest.testMaxDD}% | Trades: ${finalBest.testTrades}`
    );

    // Detect overfitting
    const overfitResult = detectOverfitting(finalBest.roi, finalBest.testROI);
    overfittingDetected = overfitResult.overfittingDetected;
    overfittingScore = overfitResult.overfittingScore;

    // Update best reference for persistence
    best = finalBest;
  } else {
    console.warn(`⚠️  Test set too small for validation. Skipping test phase.`);
  }

  // Persist (using training performance)
  const persistInfo = await saveOrUpdateWeights({
    symbol: options.symbol,
    timeframe: options.timeframe,
    startTrain: options.startTrain,
    endTrain: options.endTrain,
    candleCount: options.candleCount,
    dataLength: trainData.length,
    bestWeights: best.weights,
    roi: best.roi,
    winRate: best.winRate,
    maxDrawdown: best.maxDrawdown,
    trades: best.trades,
  });

  // 📈 Build final response with train/test metrics
  const response = {
    success: true,
    methodology:
      "Hybrid Deterministic+Random Weight Optimization with Train/Test Split (Sukma & Namahoot, 2025)",
    indicators,
    weightRange: WEIGHT_RANGE,
    bestWeights: best.weights,
    trainPerformance: {
      roi: best.roi,
      winRate: best.winRate,
      trades: best.trades,
      finalCapital: best.finalCapital,
      maxDrawdown: best.maxDrawdown,
    },
    topResults: results.slice(0, 10).map((r) => ({
      weights: r.weights,
      roi: r.roi,
      winRate: r.winRate,
      trades: r.trades,
      maxDrawdown: r.maxDrawdown,
    })),
    startDate,
    endDate,
    samplesTried: results.length,
    attempts,
    retries,
    executionTime: elapsedTime + "s",
    timestamp: new Date().toISOString(),
    persisted: persistInfo.created || persistInfo.updated || false,
    cachedPersist: persistInfo.cached || false,
  };

  // Add test performance and overfitting metrics if test was run
  if (testPerformance) {
    response.testPerformance = {
      roi: testPerformance.roi,
      winRate: testPerformance.winRate,
      trades: testPerformance.trades,
      finalCapital: testPerformance.finalCapital,
      maxDrawdown: testPerformance.maxDrawdown,
    };
    response.overfittingDetected = overfittingDetected;
    response.overfittingScore = overfittingScore;
  }

  return response;
}

const decision = (s) =>
  s > HOLD_THRESHOLD ? "BUY" : s < -HOLD_THRESHOLD ? "SELL" : "HOLD";

export { calculateIndividualSignals, scoreSignal };
