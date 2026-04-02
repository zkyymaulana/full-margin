/**
 * 🎯 Layanan Algoritma Multi-Indicator
 * ================================================================
 * Service untuk core algorithm optimization dan backtesting.
 *
 * Tanggung Jawab:
 * - Melakukan exhaustive search optimization (5^8 = 390,625 combinations)
 * - Backtesting dengan weights yang sudah dioptimalkan
 * - Perhitungan sinyal dan scoring
 *
 * PENTING: Ini adalah PURE LOGIC - tidak bergantung pada:
 * - Express HTTP
 * - Prisma database
 * - SSE streaming
 * - Job state management
 * ================================================================
 */

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
 * 🧮 Precompute semua indicator signals untuk entire dataset
 *
 * @param {Array} data - Array of candle objects dengan indicator values
 * @returns {Array} Array dengan precomputed signals untuk setiap candle
 *
 * Preprocessing ini dilakukan SEKALI saja di awal optimization.
 * Hasilnya di-cache untuk iterasi yang lebih cepat saat testing kombinasi.
 *
 * Output:
 * [{
 *   price: 43000.50,
 *   signals: {
 *     SMA: "buy",
 *     EMA: "sell",
 *     RSI: "neutral",
 *     ...
 *   }
 * }, ...]
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
 * 🎲 Generate weight combination dari index
 *
 * @param {number} index - Index dalam range 0-390624 (5^8 - 1)
 * @param {Array} indicators - Daftar indicator names
 * @returns {Object} Object dengan weights {SMA: 2, EMA: 1, ...}
 *
 * Algoritma:
 * Setiap indicator punya 5 level weight: [0, 1, 2, 3, 4]
 * Dengan 8 indicators, total kombinasi = 5^8 = 390,625
 *
 * Mapping:
 * index = 0      → [0,0,0,0,0,0,0,0]
 * index = 1      → [1,0,0,0,0,0,0,0]
 * index = 5      → [0,1,0,0,0,0,0,0]
 * index = 390624 → [4,4,4,4,4,4,4,4]
 *
 * Menggunakan base-5 conversion untuk generate kombinasi
 */
function getWeightCombination(index, indicators) {
  const weightRange = [0, 1, 2, 3, 4];
  const weights = {};
  let remaining = index;

  // Convert index ke base-5 representation
  for (let i = indicators.length - 1; i >= 0; i--) {
    weights[indicators[i]] = weightRange[remaining % 5];
    remaining = Math.floor(remaining / 5);
  }

  return weights;
}

/**
 * ⚡ Fast backtest menggunakan precomputed indicators
 *
 * @param {Array} cache - Precomputed indicators dari computeAllIndicators()
 * @param {Object} weights - Weight object {SMA: 2, EMA: 1, ...}
 * @returns {Object} Backtest result {roi, winRate, trades, maxDrawdown, ...}
 *
 * Strategi Trading (Rule-Based DSS):
 * 1. Hitung weighted score dari semua indicator signals
 * 2. Normalisasi score ke range [-1, +1]
 * 3. Entry: score > 0 (bullish consensus)
 * 4. Exit: score < 0 (bearish consensus)
 * 5. Hitung ROI, win rate, drawdown
 *
 * Threshold selalu = 0 (natural boundary antara buy/sell)
 */
function backtestWithWeightsCached(cache, weights) {
  const INITIAL_CAPITAL = 10_000;
  const EARLY_STOP_THRESHOLD = INITIAL_CAPITAL * 0.4;
  const BUY_THRESHOLD = 0;
  const SELL_THRESHOLD = 0;

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

    // 🎯 Weighted aggregation: Σ(weight_i × signal_i)
    let weightedSum = 0;
    for (const k of keys) {
      weightedSum += weights[k] * scoreSignal(signals[k] ?? "neutral");
    }

    // 📐 Normalisasi: finalScore ∈ [-1, +1]
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // 🟢 Entry: score > BUY_THRESHOLD
    if (score > BUY_THRESHOLD && !position) {
      position = "BUY";
      entry = price;
    }
    // 🔴 Exit: score < SELL_THRESHOLD
    else if (score < SELL_THRESHOLD && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;

      // Early stop jika capital turun drastis
      if (capital < EARLY_STOP_THRESHOLD) {
        equityCurve.push(capital);
        break;
      }
    }

    equityCurve.push(capital);
  }

  // Force close position pada akhir data jika masih open
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
 * 🎯 FULL EXHAUSTIVE OPTIMIZATION (5^8 = 390,625 kombinasi)
 *
 * @param {Array} data - Array of candle objects dengan indicator data
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 * @param {Function} onProgress - Callback untuk progress updates
 * @param {Function} checkCancel - Callback untuk check cancel status
 * @returns {Promise<Object>} Optimization result dengan best weights dan performance
 *
 * Workflow:
 * 1. Precompute semua indicator signals SEKALI
 * 2. Loop through 390,625 kombinasi
 * 3. Untuk setiap kombinasi: test dengan backtest
 * 4. Track kombinasi terbaik (highest ROI)
 * 5. Send progress updates setiap 1000 kombinasi
 * 6. Check for cancel request setiap 50 kombinasi
 *
 * Optimization Metrics:
 * - Primary: ROI (return on investment)
 * - Secondary: Win Rate (signal quality)
 * - Risk Metric: Max Drawdown
 */
export async function optimizeIndicatorWeights(
  data,
  symbol = "BTC-USD",
  onProgress = null,
  checkCancel = null,
  options = {},
) {
  const startTime = performance.now();
  const totalCombinations = Math.pow(5, 8);
  const totalCandles = data.length;

  const trainingWindow = options.trainingWindow || {
    startISO: new Date(Number(data[0].time)).toISOString(),
    endISO: new Date(Number(data[data.length - 1].time)).toISOString(),
  };
  const effectiveRange = options.effectiveRange || {
    start: new Date(Number(data[0].time)).toISOString(),
    end: new Date(Number(data[data.length - 1].time)).toISOString(),
  };

  console.log(`\n🔍 Full Exhaustive Search: ${symbol}`);
  console.log(`📊 Dataset: ${data.length} candles`);
  console.log(
    `📅 Training Window: ${trainingWindow.startISO} → ${trainingWindow.endISO}`,
  );
  console.log(
    `📎 Effective Data: ${effectiveRange.start} → ${effectiveRange.end}`,
  );
  console.log(`🧮 Combinations: ${totalCombinations.toLocaleString()}`);

  // 🧮 Precompute semua indicators SEKALI untuk speed
  const cache = computeAllIndicators(data);
  console.log(
    `✅ Precomputed in ${((performance.now() - startTime) / 1000).toFixed(2)}s\n`,
  );

  let best = null;
  let currentCandleIndex = 0;

  // 🔄 MAIN LOOP: Iterate through semua 5^8 kombinasi
  for (let i = 0; i < totalCombinations; i++) {
    // ✅ Check cancellation VERY frequently (every 50 iterations)
    if (i % 50 === 0) {
      // Yield ke event loop untuk allow cancel request diproses
      await new Promise((resolve) => setImmediate(resolve));

      if (checkCancel && typeof checkCancel === "function") {
        const shouldCancel = checkCancel();
        if (shouldCancel) {
          console.log(
            `\n🛑 Optimization cancelled at ${i + 1}/${totalCombinations} combinations`,
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

    // 🎲 Generate weight combination untuk index i
    const weights = getWeightCombination(i, ALL_INDICATORS);

    // ⚡ Fast backtest dengan weights
    const result = backtestWithWeightsCached(cache, weights);

    // 🏆 Track best result (highest ROI)
    if (!best || result.roi > best.roi) {
      best = { weights, ...result };
    }

    // Simulate progress (candle index untuk progress visualization)
    currentCandleIndex = Math.floor(
      ((i + 1) / totalCombinations) * totalCandles,
    );

    // 📊 Send progress update setiap 1000 kombinasi
    if ((i + 1) % 1000 === 0 || i === totalCombinations - 1) {
      // Double check cancel
      if (checkCancel && checkCancel()) {
        console.log(`\n🛑 Cancelled before progress callback`);
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
        tested: currentCandleIndex,
        total: totalCandles,
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
              : `${eta.toFixed(0)} seconds`,
        datasetRange: {
          start: trainingWindow.startISO,
          end: trainingWindow.endISO,
        },
        effectiveRange: {
          start: effectiveRange.start,
          end: effectiveRange.end,
        },
      };

      // Log setiap 10,000 kombinasi untuk cleaner console
      if ((i + 1) % 10000 === 0 || i === totalCombinations - 1) {
        console.log(
          `   Candle ${currentCandleIndex.toLocaleString()}/${totalCandles.toLocaleString()} (${progress}%) | ` +
            `Best ROI: ${best.roi.toFixed(2)}% | ETA: ${progressData.eta}`,
        );
      }

      // Call progress callback
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
    `🏆 Best: ROI ${best.roi.toFixed(2)}% | WinRate ${best.winRate.toFixed(2)}% | MDD ${best.maxDrawdown.toFixed(2)}%`,
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
      start: trainingWindow.startISO,
      end: trainingWindow.endISO,
    },
    effectiveRange: {
      start: effectiveRange.start,
      end: effectiveRange.end,
    },
    executionTimeSeconds: +totalTime.toFixed(2),
  };
}

/**
 * 📊 Backtest dengan weights yang sudah dioptimalkan
 *
 * @param {Array} data - Array of candle objects
 * @param {Object} weights - Optimized weights {SMA: 2, EMA: 1, ...}
 * @param {Object} options - Options {fastMode, threshold}
 * @returns {Promise<Object>} Backtest result
 *
 * Ini adalah wrapper untuk backtestWithWeightsCached.
 * Melakukan validation weights dan mengembalikan hasil dengan format yang sesuai.
 */
export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false, threshold = 0 } = {},
) {
  if (!data?.length) throw new Error("Data historis kosong");

  // ✅ VALIDATION: Pastikan semua required indicators punya weights
  const requiredIndicators = [
    "SMA",
    "EMA",
    "PSAR",
    "RSI",
    "MACD",
    "Stochastic",
    "StochasticRSI",
    "BollingerBands",
  ];

  const missingIndicators = requiredIndicators.filter(
    (ind) => !weights.hasOwnProperty(ind),
  );

  if (missingIndicators.length > 0) {
    throw new Error(
      `❌ WEIGHTS NOT FOUND: Missing weights for indicators: ${missingIndicators.join(", ")}. ` +
        `Please run optimization first.`,
    );
  }

  // ✅ Validate weights are dalam range [0-4]
  const invalidWeights = Object.entries(weights).filter(
    ([_, w]) => w < 0 || w > 4,
  );

  if (invalidWeights.length > 0) {
    throw new Error(
      `❌ INVALID WEIGHTS: Weights harus dalam range [0-4]. Invalid: ${invalidWeights
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  }

  // 📊 Precompute indicators
  const cache = computeAllIndicators(data);

  console.log(`\n🎯 DSS Backtest with Weights`);
  console.log(`📊 Weights:`, weights);
  console.log(`📏 Threshold: ±${threshold}`);

  // ⚡ Run backtest
  const result = backtestWithWeightsCached(cache, weights);

  console.log(`✅ Backtest Complete`);
  console.log(`   ROI: ${result.roi.toFixed(2)}%`);
  console.log(
    `   Win Rate: ${result.winRate.toFixed(2)}% (${result.wins}/${result.trades})`,
  );
  console.log(`   Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`   Trades: ${result.trades}\n`);

  return {
    success: true,
    methodology: `Rule-Based DSS with Threshold ±${threshold}`,
    roi: +result.roi.toFixed(2),
    winRate: +result.winRate.toFixed(2),
    trades: result.trades,
    wins: result.wins,
    finalCapital: +result.finalCapital.toFixed(2),
    maxDrawdown: +result.maxDrawdown.toFixed(2),
    sharpeRatio: result.sharpeRatio ? +result.sharpeRatio.toFixed(2) : null,
    threshold,
    dataPoints: data.length,
    equityCurve: [], // Optional untuk comparison
  };
}

export default {
  optimizeIndicatorWeights,
  backtestWithWeights,
  computeAllIndicators,
  getWeightCombination,
  backtestWithWeightsCached,
};
