import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";
import { calcRiskMetrics } from "../backtest/backtest.utils.js";

/**
 * 🧮 Precompute all indicator signals for the entire dataset
 * This avoids recalculating indicators for each weight combination
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
 * 🎲 Generate weight combination from index (deterministic)
 * Converts index (0 to 390624) to base-5 representation
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
 * Includes early stopping when capital drops below 40% of initial
 *
 * Metrik evaluasi sesuai skripsi:
 * - ROI (Return on Investment)
 * - Win Rate
 * - Maximum Drawdown (MDD)
 * - Sharpe Ratio
 */
function backtestWithWeightsCached(cache, weights) {
  const INITIAL_CAPITAL = 10_000;
  const EARLY_STOP_THRESHOLD = INITIAL_CAPITAL * 0.4; // 40% of initial capital

  let capital = INITIAL_CAPITAL;
  let position = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  const keys = Object.keys(weights).filter((k) => weights[k] > 0); // Skip zero weights
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

  for (let i = 0; i < cache.length; i++) {
    const { price, signals } = cache[i];

    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    // Calculate weighted score
    const weighted = keys.map(
      (k) => (weights[k] ?? 0) * scoreSignal(signals[k] ?? "neutral")
    );
    const score = weighted.reduce((a, b) => a + b, 0) / keys.length;

    // Trading logic (no threshold, as per Sukma 2025 journal)
    if (score > 0 && !position) {
      position = "BUY";
      entry = price;
    } else if (score < 0 && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;

      // Early stop if capital drops too low
      if (capital < EARLY_STOP_THRESHOLD) {
        equityCurve.push(capital);
        break;
      }
    }

    equityCurve.push(capital);
  }

  // Close any open position at the end
  if (position === "BUY") {
    const lastPrice = cache[cache.length - 1].price;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  // 📊 Calculate performance metrics based on thesis requirements
  // 1. ROI = ((Final Capital - Initial Capital) / Initial Capital) * 100
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  // 2. Win Rate = (Winning Trades / Total Trades) * 100
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // 3. Maximum Drawdown = (Peak - Lowest After Peak) / Peak * 100
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  // 4. Sharpe Ratio = Average Return / Std Dev of Returns (risk-free rate = 0)
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
 * 🎯 Full Exhaustive Search Optimization (5^8 = 390,625 combinations)
 * Uses in-memory caching for maximum performance
 *
 * Optimasi berdasarkan metodologi skripsi:
 * "Sistem Pendukung Keputusan Perdagangan Cryptocurrency
 *  Berbasis Analisis Multi-Indikator Teknikal"
 *
 * Metrik evaluasi:
 * - ROI (Return on Investment) - Metrik utama optimasi
 * - Win Rate
 * - Maximum Drawdown (MDD) - Filter risiko
 * - Sharpe Ratio - Tie-breaker untuk ROI yang sama
 */
export async function optimizeIndicatorWeights(data, symbol = "BTC-USD") {
  const startTime = performance.now();

  const allIndicators = [
    "SMA",
    "EMA",
    "PSAR",
    "RSI",
    "MACD",
    "Stochastic",
    "StochasticRSI",
    "BollingerBands",
  ];

  const totalCombinations = Math.pow(5, 8); // 390,625

  console.log(
    `\n🔍 Starting Full Exhaustive Search Optimization for ${symbol}`
  );
  console.log(`📊 Dataset size: ${data.length} candles`);
  console.log(
    `🧮 Total combinations to test: ${totalCombinations.toLocaleString()}`
  );
  console.log(`⚡ Precomputing all indicators...`);

  // Step 1: Precompute all indicators once (in-memory cache)
  const cache = computeAllIndicators(data);
  console.log(
    `✅ Indicators precomputed in ${((performance.now() - startTime) / 1000).toFixed(2)}s\n`
  );

  // Step 2: Test all combinations with ROI as primary optimization metric
  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < totalCombinations; i++) {
    const weights = getWeightCombination(i, allIndicators);
    const result = backtestWithWeightsCached(cache, weights);

    // 🎯 Optimization scoring based on thesis methodology:
    // - Primary: ROI (maximize profit)
    // - Secondary: Sharpe Ratio (risk-adjusted return)
    // - Penalty: Max Drawdown (minimize risk)
    const score =
      result.roi - result.maxDrawdown * 0.5 + (result.sharpeRatio || 0) * 2;

    // Track best result
    if (score > bestScore) {
      bestScore = score;
      best = { weights, ...result };
    }

    // Progress logging every 5000 iterations
    if ((i + 1) % 5000 === 0 || i === totalCombinations - 1) {
      const progress = (((i + 1) / totalCombinations) * 100).toFixed(1);
      const elapsed = (performance.now() - startTime) / 1000;
      const estimated = (elapsed / (i + 1)) * totalCombinations;
      const remaining = estimated - elapsed;

      console.log(
        `   Progress: ${(i + 1).toLocaleString()}/${totalCombinations.toLocaleString()} ` +
          `(${progress}%) | Best ROI: ${best.roi.toFixed(2)}% | ` +
          `ETA: ${remaining > 60 ? (remaining / 60).toFixed(1) + "m" : remaining.toFixed(0) + "s"}`
      );
    }
  }

  const totalTime = (performance.now() - startTime) / 1000;
  console.log(`\n✅ Optimization completed in ${totalTime.toFixed(2)}s`);
  console.log(`🏆 Best ROI found: ${best.roi.toFixed(2)}%`);
  console.log(`📊 Win Rate: ${best.winRate.toFixed(2)}%`);
  console.log(`📉 Max Drawdown: ${best.maxDrawdown.toFixed(2)}%`);
  console.log(`📈 Sharpe Ratio: ${best.sharpeRatio?.toFixed(2) || "N/A"}`);

  return {
    success: true,
    methodology: "Full Exhaustive In-Memory Optimization (5^8 combos)",
    bestWeights: best.weights,
    performance: {
      roi: best.roi,
      winRate: best.winRate,
      maxDrawdown: best.maxDrawdown,
      trades: best.trades,
      wins: best.wins,
      finalCapital: best.finalCapital,
      sharpeRatio: best.sharpeRatio || null,
    },
    totalCombinationsTested: totalCombinations,
    dataPoints: data.length,
    executionTimeSeconds: +totalTime.toFixed(2),
  };
}
