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
  calculateROI,
  calculateSharpeRatio,
  calculateWinRate,
} from "../backtest/backtest.utils.js";
import {
  calculateIndividualSignals,
  scoreSignal,
  calculateMaxDrawDown,
} from "../../utils/indicator.utils.js";

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
const OPTIMIZATION_YIELD_EVERY = Math.max(
  1,
  Number(process.env.OPTIMIZATION_YIELD_EVERY || "10"),
);
const EXECUTION_THRESHOLD = 0;

function formatEta(seconds) {
  const safe = Math.max(0, Math.ceil(seconds || 0));
  if (safe >= 3600) return `${(safe / 3600).toFixed(1)}h`;
  if (safe >= 60) return `${(safe / 60).toFixed(1)}m`;
  return `${safe}s`;
}

/**
 * 🧮 Precompute semua indicator signals untuk entire dataset
 *
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
 *
 * Strategi Trading (Rule-Based DSS):
 * 1. Hitung weighted score dari semua indicator signals
 * 2. Normalisasi score ke range [-1, +1]
 * 3. Entry: score > 0 (bullish consensus)
 * 4. Exit: score < 0 (bearish consensus)
 * 5. Hitung ROI, win rate, drawdown
 */
function backtestWithWeightsCached(
  cache,
  weights,
  {
    buyThreshold = EXECUTION_THRESHOLD,
    sellThreshold = EXECUTION_THRESHOLD,
  } = {},
) {
  const INITIAL_CAPITAL = 10_000;
  const EARLY_STOP_THRESHOLD = INITIAL_CAPITAL * 0.4;

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

    if (price == null) {
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
    if (score > buyThreshold && !position) {
      position = "BUY";
      entry = price;
    }
    // 🔴 Exit: score < SELL_THRESHOLD
    else if (score < sellThreshold && position === "BUY") {
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

  const roi = calculateROI(capital, INITIAL_CAPITAL);
  const winRate = calculateWinRate(wins, trades);
  const maxDrawdown = calculateMaxDrawDown(equityCurve);
  const sharpeRatio = calculateSharpeRatio(equityCurve);

  return {
    roi,
    winRate,
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
  const initialEstimateSeconds = Number(options.initialEstimateSeconds || 0);

  // Precompute semua indikator satu kali untuk mempercepat proses backtest
  const cache = computeAllIndicators(data);

  let best = null;
  let currentCandleIndex = 0;

  // Loop utama untuk menguji semua kombinasi bobot (5^8)
  for (let i = 0; i < totalCombinations; i++) {
    // Memberi kesempatan event loop berjalan agar tidak blocking
    if (i % OPTIMIZATION_YIELD_EVERY === 0) {
      // Yield ke event loop untuk allow cancel request diproses
      await new Promise((resolve) => setImmediate(resolve));

      // Cek apakah proses dibatalkan oleh user
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

    // Generate kombinasi bobot berdasarkan indeks
    const weights = getWeightCombination(i, ALL_INDICATORS);

    // Jalankan backtest menggunakan data yang sudah di-cache
    const result = backtestWithWeightsCached(cache, weights);

    // Simpan hasil terbaik berdasarkan ROI tertinggi
    if (!best || result.roi > best.roi) {
      best = { weights, ...result };
    }

    // Simulasi progres berdasarkan jumlah kombinasi yang telah diuji
    currentCandleIndex = Math.floor(
      ((i + 1) / totalCombinations) * totalCandles,
    );

    // Update progress setiap 1000 iterasi atau pada iterasi terakhir
    if ((i + 1) % 1000 === 0 || i === totalCombinations - 1) {
      // Cek ulang pembatalan
      if (checkCancel && checkCancel()) {
        return {
          success: false,
          cancelled: true,
          message: "Optimization cancelled by user",
          testedCombinations: i + 1,
        };
      }

      const progress = ((currentCandleIndex / totalCandles) * 100).toFixed(1);
      const elapsed = (performance.now() - startTime) / 1000;
      const runtimeEtaSeconds =
        (elapsed / (i + 1)) * totalCombinations - elapsed;
      const baselineEtaSeconds = Math.max(0, initialEstimateSeconds - elapsed);
      const useBaseline =
        initialEstimateSeconds > 0 &&
        i + 1 < Math.floor(totalCombinations * 0.05);
      const selectedEtaSeconds = useBaseline
        ? baselineEtaSeconds
        : Math.max(0, runtimeEtaSeconds);

      const progressData = {
        tested: currentCandleIndex,
        total: totalCandles,
        dataPoints: data.length,
        percentage: parseFloat(progress),
        bestROI: parseFloat(best.roi.toFixed(2)),
        etaSeconds: Math.ceil(selectedEtaSeconds),
        eta: formatEta(selectedEtaSeconds),
        etaFormatted:
          selectedEtaSeconds > 3600
            ? `${(selectedEtaSeconds / 3600).toFixed(1)} hours`
            : selectedEtaSeconds > 60
              ? `${(selectedEtaSeconds / 60).toFixed(1)} minutes`
              : `${Math.ceil(selectedEtaSeconds)} seconds`,
        datasetRange: {
          start: trainingWindow.startISO,
          end: trainingWindow.endISO,
        },
        effectiveRange: {
          start: effectiveRange.start,
          end: effectiveRange.end,
        },
      };

      // Kirim progres melalui callback jika tersedia
      if (onProgress && typeof onProgress === "function") {
        try {
          onProgress(progressData);
        } catch (callbackError) {
          // Abaikan error pada callback agar tidak menghentikan proses utama
        }
      }
    }
  }

  const totalTime = (performance.now() - startTime) / 1000;

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
 *
 * Ini adalah wrapper untuk backtestWithWeightsCached.
 * Melakukan validation weights dan mengembalikan hasil dengan format yang sesuai.
 */
export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false, threshold = EXECUTION_THRESHOLD } = {},
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

  // Threshold dieksekusi simetris: BUY saat score > +t, SELL saat score < -t.
  const parsedThreshold = Number(threshold);
  const executionThreshold = Number.isFinite(parsedThreshold)
    ? Math.max(0, Math.abs(parsedThreshold))
    : EXECUTION_THRESHOLD;

  console.log(`\n🎯 DSS Backtest with Weights`);
  console.log(`📊 Weights:`, weights);
  console.log(`📏 Threshold (execution): ±${executionThreshold}`);

  // ⚡ Run backtest
  const result = backtestWithWeightsCached(cache, weights, {
    buyThreshold: executionThreshold,
    sellThreshold: -executionThreshold,
  });

  console.log(`✅ Backtest Complete`);
  console.log(`   ROI: ${result.roi.toFixed(2)}%`);
  console.log(
    `   Win Rate: ${result.winRate.toFixed(2)}% (${result.wins}/${result.trades})`,
  );
  console.log(`   Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`   Trades: ${result.trades}\n`);

  return {
    success: true,
    methodology: `Rule-Based DSS with Threshold ±${executionThreshold}`,
    roi: +result.roi.toFixed(2),
    winRate: +result.winRate.toFixed(2),
    trades: result.trades,
    wins: result.wins,
    finalCapital: +result.finalCapital.toFixed(2),
    maxDrawdown: +result.maxDrawdown.toFixed(2),
    sharpeRatio: result.sharpeRatio ? +result.sharpeRatio.toFixed(2) : null,
    threshold: executionThreshold,
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
