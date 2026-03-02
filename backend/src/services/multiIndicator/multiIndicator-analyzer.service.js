import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";
import { calcRiskMetrics } from "../backtest/backtest.utils.js";

const ALL_INDICATORS = [
  "SMA",
  "EMA",
  "PSAR",
  "RSI",
  "MACD",
  "Stochastic",
  "StochasticRSI",
  "BollingerBands",
];

/**
 * 🧮 Precompute all indicator signals for the entire dataset
 */
function computeAllIndicators(data) {
  return data.map((candle, i) => {
    const prev = i > 0 ? data[i - 1] : null;
    return {
      price: candle.close,
      signals: calculateIndividualSignals(candle, prev),
    };
  });
}

/**
 * 🎲 Generate weight combination from index
 */
function getWeightCombination(index, indicators) {
  const weightRange = [0, 1, 2, 3, 4];
  const weights = {};
  let remaining = index;

  for (let i = indicators.length - 1; i >= 0; i--) {
    weights[indicators[i]] = weightRange[remaining % 5];
    remaining = Math.floor(remaining / 5);
  }

  return weights;
}

/**
 * ⚡ Fast backtest using precomputed indicators
 */
function backtestWithWeightsCached(cache, weights) {
  const INITIAL_CAPITAL = 10_000;
  const EARLY_STOP_THRESHOLD = INITIAL_CAPITAL * 0.4;
  const STRONG_BUY = 0;
  const STRONG_SELL = 0;

  let capital = INITIAL_CAPITAL;
  let position = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  if (keys.length === 0) {
    return {
      roi: -100,
      winRate: 0,
      trades: 0,
      wins: 0,
      finalCapital: 0,
      maxDrawdown: 100,
      sharpeRatio: null,
    };
  }

  const totalWeight = keys.reduce((sum, k) => sum + weights[k], 0);

  for (let i = 0; i < cache.length; i++) {
    const { price, signals } = cache[i];

    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    let weightedSum = 0;
    for (const k of keys) {
      weightedSum += weights[k] * scoreSignal(signals[k] ?? "neutral");
    }
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    if (score >= STRONG_BUY && !position) {
      position = "BUY";
      entry = price;
    } else if (score <= STRONG_SELL && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;

      if (capital < EARLY_STOP_THRESHOLD) {
        equityCurve.push(capital);
        break;
      }
    }

    equityCurve.push(capital);
  }

  if (position === "BUY") {
    const lastPrice = cache[cache.length - 1].price;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const maxDrawdown = calcMaxDrawdown(equityCurve);
  const { sharpeRatio } = calcRiskMetrics(equityCurve);

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    maxDrawdown,
    sharpeRatio,
  };
}

/**
 * 🔄 Generate local search combinations (±1 from baseline)
 */
function generateLocalSearch(baselineWeights) {
  const indicators = Object.keys(baselineWeights);
  const combinations = [];

  function generate(index, current) {
    if (index === indicators.length) {
      const isDifferent = indicators.some(
        (ind) => current[ind] !== baselineWeights[ind]
      );
      if (isDifferent) combinations.push({ ...current });
      return;
    }

    const indicator = indicators[index];
    const baseValue = baselineWeights[indicator];
    const range = [
      ...new Set([
        Math.max(0, baseValue - 1),
        baseValue,
        Math.min(4, baseValue + 1),
      ]),
    ];

    for (const value of range) {
      current[indicator] = value;
      generate(index + 1, current);
    }
  }

  generate(0, {});
  return combinations;
}

/**
 * 🎯 FULL EXHAUSTIVE OPTIMIZATION (5^8 = 390,625 combinations)
 * @param {Function} onProgress - Callback function untuk progress updates
 * @param {Function} checkCancel - Callback function untuk check cancel status
 */
export async function optimizeIndicatorWeights(
  data,
  symbol = "BTC-USD",
  onProgress = null,
  checkCancel = null // ✅ NEW: Cancel checker
) {
  const startTime = performance.now();
  const totalCombinations = Math.pow(5, 8);
  const totalCandles = data.length; // ✅ Total candles in dataset

  // ✅ Extract dataset date range
  const datasetStartDate = new Date(Number(data[0].time)).toISOString();
  const datasetEndDate = new Date(
    Number(data[data.length - 1].time)
  ).toISOString();

  console.log(`\n🔍 Full Exhaustive Search: ${symbol}`);
  console.log(`📊 Dataset: ${data.length} candles`);
  console.log(`📅 Range: ${datasetStartDate} → ${datasetEndDate}`);
  console.log(`🧮 Combinations: ${totalCombinations.toLocaleString()}`);

  const cache = computeAllIndicators(data);
  console.log(
    `✅ Precomputed in ${((performance.now() - startTime) / 1000).toFixed(2)}s\n`
  );

  let best = null;
  let currentCandleIndex = 0; // ✅ Track which candle we're processing

  for (let i = 0; i < totalCombinations; i++) {
    // ✅ Check cancellation VERY frequently (every 50 iterations)
    if (i % 50 === 0) {
      // ✅ CRITICAL: Yield to event loop to allow cancel request to be processed
      await new Promise((resolve) => setImmediate(resolve));

      if (checkCancel && typeof checkCancel === "function") {
        const shouldCancel = checkCancel();
        if (shouldCancel) {
          console.log(
            `\n🛑 Optimization cancelled at ${i + 1}/${totalCombinations} combinations (candle ${currentCandleIndex}/${totalCandles})`
          );
          return {
            success: false,
            cancelled: true,
            message: "Optimization cancelled by user",
            testedCombinations: i + 1,
          };
        }
      }
    }

    const weights = getWeightCombination(i, ALL_INDICATORS);
    const result = backtestWithWeightsCached(cache, weights);

    if (!best || result.roi > best.roi) {
      best = { weights, ...result };
    }

    // ✅ Update current candle index (simulate processing each candle for each combination)
    // This gives user feedback on dataset progress
    currentCandleIndex = Math.floor(
      ((i + 1) / totalCombinations) * totalCandles
    );

    // ✅ Send progress update every 1000 combinations (more frequent)
    if ((i + 1) % 1000 === 0 || i === totalCombinations - 1) {
      // ✅ DOUBLE CHECK: Cancel check right before progress callback
      if (checkCancel && checkCancel()) {
        console.log(`\n🛑 Cancelled before sending progress at ${i + 1}`);
        return {
          success: false,
          cancelled: true,
          message: "Optimization cancelled by user",
          testedCombinations: i + 1,
        };
      }

      const progress = ((currentCandleIndex / totalCandles) * 100).toFixed(1);
      const elapsed = (performance.now() - startTime) / 1000;
      const eta = (elapsed / (i + 1)) * totalCombinations - elapsed;

      const progressData = {
        tested: currentCandleIndex, // ✅ Changed: Current candle being processed
        total: totalCandles, // ✅ Changed: Total candles in dataset
        dataPoints: data.length,
        percentage: parseFloat(progress),
        bestROI: parseFloat(best.roi.toFixed(2)),
        etaSeconds: Math.ceil(eta),
        eta: eta > 60 ? `${(eta / 60).toFixed(1)}m` : `${eta.toFixed(0)}s`,
        etaFormatted:
          eta > 3600
            ? `${(eta / 3600).toFixed(1)} hours`
            : eta > 60
              ? `${(eta / 60).toFixed(1)} minutes`
              : `${eta.toFixed(0)} seconds`, // ✅ Better formatting
        datasetRange: {
          start: datasetStartDate,
          end: datasetEndDate,
        },
      };

      // Only log every 10,000 for cleaner console
      if ((i + 1) % 10000 === 0 || i === totalCombinations - 1) {
        console.log(
          `   Candle ${currentCandleIndex.toLocaleString()}/${totalCandles.toLocaleString()} (${progress}%) | ` +
            `Best ROI: ${best.roi.toFixed(2)}% | ETA: ${progressData.eta}`
        );
      }

      // ✅ Call progress callback
      if (onProgress && typeof onProgress === "function") {
        try {
          onProgress(progressData);
        } catch (callbackError) {
          console.error(`⚠️ Progress callback error:`, callbackError.message);
        }
      }
    }
  }

  const totalTime = (performance.now() - startTime) / 1000;
  console.log(`\n✅ Completed in ${totalTime.toFixed(2)}s`);
  console.log(
    `🏆 Best: ROI ${best.roi.toFixed(2)}% | WinRate ${best.winRate.toFixed(2)}% | MDD ${best.maxDrawdown.toFixed(2)}%`
  );

  return {
    success: true,
    methodology: "Full Exhaustive (5^8)",
    bestWeights: best.weights,
    performance: {
      roi: best.roi,
      winRate: best.winRate,
      maxDrawdown: best.maxDrawdown,
      sharpeRatio: best.sharpeRatio || null,
      trades: best.trades,
      wins: best.wins,
      finalCapital: best.finalCapital,
    },
    totalCombinationsTested: totalCombinations,
    dataPoints: data.length,
    datasetRange: {
      start: datasetStartDate,
      end: datasetEndDate,
    },
    executionTimeSeconds: +totalTime.toFixed(2),
  };
}
