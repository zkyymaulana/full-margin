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

// hitung semua sinyal indikator untuk seluruh data (sekali di awal)
function computeAllIndicators(data) {
  return data.map((candle, i) => {
    const prev = i > 0 ? data[i - 1] : null;
    return {
      price: candle.close,
      signals: calculateIndividualSignals(candle, prev),
    };
  });
}

// generate kombinasi bobot indikator dari index
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

// backtest cepat menggunakan data indikator yang sudah diprecompute
// entry saat score > threshold, exit saat score < threshold
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

    // hitung score berbobot dari semua sinyal
    let weightedSum = 0;
    for (const k of keys) {
      weightedSum += weights[k] * scoreSignal(signals[k] ?? "neutral");
    }

    // normalisasi score ke range [-1, 1]
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // buka posisi
    if (score > buyThreshold && !position) {
      position = "BUY";
      entry = price;
    }
    // tutup posisi
    else if (score < sellThreshold && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;

      // hentikan lebih awal jika capital turun drastis
      if (capital < EARLY_STOP_THRESHOLD) {
        equityCurve.push(capital);
        break;
      }
    }

    equityCurve.push(capital);
  }

  // tutup posisi di akhir jika masih terbuka
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

// optimasi bobot indikator dengan brute force (5^8 kombinasi)
export async function optimizeIndicatorWeights(
  data,
  onProgress = null,
  checkCancel = null,
  options = {},
) {
  // catat waktu mulai untuk menghitung durasi eksekusi
  const startTime = performance.now();

  // total kombinasi bobot: 5 pilihan bobot × 8 indikator
  const totalCombinations = Math.pow(5, 8);

  // jumlah data candle yang akan diproses
  const totalCandles = data.length;

  // set rentang waktu training window (atau gunakan rentang data keseluruhan)
  const trainingWindow = options.trainingWindow || {
    startISO: new Date(Number(data[0].time)).toISOString(),
    endISO: new Date(Number(data[data.length - 1].time)).toISOString(),
  };

  // set rentang waktu efektif (periode analisis)
  const effectiveRange = options.effectiveRange || {
    start: new Date(Number(data[0].time)).toISOString(),
    end: new Date(Number(data[data.length - 1].time)).toISOString(),
  };

  // estimasi waktu awal (opsional, dari hasil run sebelumnya)
  const initialEstimateSeconds = Number(options.initialEstimateSeconds || 0);

  // precompute semua sinyal indikator untuk mempercepat backtest (hindari kalkulasi berulang)
  const cache = computeAllIndicators(data);

  // menyimpan hasil terbaik ditemukan sejauh ini
  let best = null;

  // index candle saat ini (untuk progress bar)
  let currentCandleIndex = 0;

  // tracking persen terakhir yang di-log untuk menghindari spam log
  let lastLoggedPercent = -1;

  // loop iterasi semua kombinasi bobot (0 hingga 5^8 - 1)
  for (let i = 0; i < totalCombinations; i++) {
    // beri jeda setiap OPTIMIZATION_YIELD_EVERY iterasi agar event loop tetap responsif
    if (i % OPTIMIZATION_YIELD_EVERY === 0) {
      // yield kontrol ke event loop
      await new Promise((resolve) => setImmediate(resolve));

      // cek apakah user membatalkan proses optimasi
      if (checkCancel && typeof checkCancel === "function") {
        if (checkCancel()) {
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

    // generate kombinasi bobot indikator berdasarkan index i
    const weights = getWeightCombination(i, ALL_INDICATORS);

    // jalankan backtest dengan bobot ini menggunakan cache indikator
    const result = backtestWithWeightsCached(cache, weights);

    // update hasil terbaik jika ROI saat ini lebih tinggi
    if (!best || result.roi > best.roi) {
      best = { weights, ...result };
    }

    // hitung index candle virtual untuk progress bar (estimasi linear)
    currentCandleIndex = Math.floor(
      ((i + 1) / totalCombinations) * totalCandles,
    );

    // update progress setiap 1000 iterasi atau di iterasi terakhir
    if ((i + 1) % 1000 === 0 || i === totalCombinations - 1) {
      // cek cancel sekali lagi sebelum update progress
      if (checkCancel && checkCancel()) {
        return {
          success: false,
          cancelled: true,
          message: "Optimization cancelled by user",
          testedCombinations: i + 1,
        };
      }

      // hitung presentase progres
      const progress = ((currentCandleIndex / totalCandles) * 100).toFixed(1);

      // waktu yang sudah berjalan dalam detik
      const elapsed = (performance.now() - startTime) / 1000;

      // perkiraan ETA berdasarkan kecepatan runtime saat ini
      const runtimeEtaSeconds =
        (elapsed / (i + 1)) * totalCombinations - elapsed;

      // perkiraan ETA berdasarkan baseline estimate (jika tersedia)
      const baselineEtaSeconds = Math.max(0, initialEstimateSeconds - elapsed);

      // gunakan baseline ETA jika tersedia dan masih di awal (< 5%)
      const useBaseline =
        initialEstimateSeconds > 0 &&
        i + 1 < Math.floor(totalCombinations * 0.05);

      // pilih ETA yang lebih akurat: baseline atau runtime
      const selectedEtaSeconds = useBaseline
        ? baselineEtaSeconds
        : Math.max(0, runtimeEtaSeconds);

      // struktur data progres untuk dikirim ke callback
      const progressData = {
        tested: currentCandleIndex, // candle index yang sudah diproses
        total: totalCandles, // total candle
        dataPoints: data.length, // jumlah data point
        percentage: parseFloat(progress), // persentase (0-100)
        bestROI: parseFloat(best.roi.toFixed(2)), // ROI terbaik ditemukan
        etaSeconds: Math.ceil(selectedEtaSeconds), // ETA dalam detik
        eta: formatEta(selectedEtaSeconds), // ETA terformat (h/m/s)
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

      // cek apakah persentase berubah signifikan (minimal 1%)
      const progressBucket = Math.floor(progressData.percentage);
      if (progressBucket !== lastLoggedPercent) {
        lastLoggedPercent = progressBucket;
        // log progress ke console
        console.log(
          `Optimization progress: ${progressData.percentage.toFixed(1)}% (ETA ${progressData.eta})`,
        );
      }

      // kirim data progres ke callback function (untuk UI update)
      if (onProgress && typeof onProgress === "function") {
        try {
          onProgress(progressData);
        } catch (callbackError) {
          // abaikan error dari callback, lanjutkan optimasi
        }
      }
    }
  }

  // hitung total waktu eksekusi dalam detik
  const totalTime = (performance.now() - startTime) / 1000;

  // kembalikan hasil optimasi lengkap
  return {
    success: true,
    methodology: "Full Exhaustive (5^8)", // metode: brute force semua kombinasi
    bestWeights: best.weights, // bobot terbaik
    performance: {
      roi: best.roi, // ROI dari bobot terbaik
      winRate: best.winRate, // win rate (%)
      maxDrawdown: best.maxDrawdown, // max drawdown (%)
      sharpeRatio: best.sharpeRatio || null, // sharpe ratio
      trades: best.trades, // total trades
      wins: best.wins, // total trades yang profit
      finalCapital: best.finalCapital, // modal akhir
    },
    totalCombinationsTested: totalCombinations, // 5^8 = 390,625 kombinasi
    dataPoints: data.length, // jumlah data point
    datasetRange: {
      start: trainingWindow.startISO,
      end: trainingWindow.endISO,
    },
    effectiveRange: {
      start: effectiveRange.start,
      end: effectiveRange.end,
    },
    executionTimeSeconds: +totalTime.toFixed(2), // total waktu eksekusi
  };
}

// backtest dengan bobot indikator (hasil optimasi)
export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false, threshold = EXECUTION_THRESHOLD } = {},
) {
  if (!data?.length) throw new Error("Data historis kosong");

  // cek semua indikator wajib punya bobot
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
      `WEIGHTS NOT FOUND: Missing weights for indicators: ${missingIndicators.join(", ")}. ` +
        `Please run optimization first.`,
    );
  }

  // cek bobot harus di range 0–4
  const invalidWeights = Object.entries(weights).filter(
    ([_, w]) => w < 0 || w > 4,
  );

  if (invalidWeights.length > 0) {
    throw new Error(
      `INVALID WEIGHTS: Weights harus dalam range [0-4]. Invalid: ${invalidWeights
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  }

  // precompute indikator
  const cache = computeAllIndicators(data);

  // normalisasi threshold (simetris buy/sell)
  const parsedThreshold = Number(threshold);
  const executionThreshold = Number.isFinite(parsedThreshold)
    ? Math.max(0, Math.abs(parsedThreshold))
    : EXECUTION_THRESHOLD;

  console.log(`\nDSS Backtest with Weights`);
  console.log(`Weights:`, weights);
  console.log(`Threshold (execution): ±${executionThreshold}`);

  // jalankan backtest
  const result = backtestWithWeightsCached(cache, weights, {
    buyThreshold: executionThreshold,
    sellThreshold: -executionThreshold,
  });

  console.log(`Backtest Complete`);
  console.log(`ROI: ${result.roi.toFixed(2)}%`);
  console.log(
    `Win Rate: ${result.winRate.toFixed(2)}% (${result.wins}/${result.trades})`,
  );
  console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`Trades: ${result.trades}\n`);

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
    equityCurve: [],
  };
}
