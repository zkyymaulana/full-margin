import { prisma } from "../../lib/prisma.js";
import { invalidateWeightsCache } from "../indicators/indicator.service.js";
import {
  optimizeIndicatorWeights,
  backtestWithWeights,
} from "./multi-indicator.service.js";

// const FIXED_START_EPOCH = Date.parse("2025-01-01T00:00:00Z");
// const FIXED_START_EPOCH = Date.parse("2024-12-01T00:00:00Z");
const FIXED_START_EPOCH = Date.parse("2020-01-01T00:00:00Z");
// const FIXED_END_EPOCH = Date.parse("2026-01-01T00:00:00Z");
const FIXED_END_EPOCH = Date.parse("2025-01-01T00:00:00Z");

// Fixed training window untuk semua optimization
// const FIXED_START_EPOCH = Date.parse("2020-01-01T00:00:00Z");
// const FIXED_END_EPOCH = Date.parse("2025-01-01T00:00:00Z");

const BENCHMARK_DATA_POINTS = 45893;
const BENCHMARK_MINUTES = 78;

// ubah input tanggal menjadi epoch dalam milidetik
function toEpochMs(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

// tentukan rentang waktu training berdasarkan listing date
function resolveTrainingWindow(listingDate) {
  const listingEpoch = toEpochMs(listingDate);

  // gunakan tanggal paling besar antara listingDate dan batas minimum
  const startEpoch = listingEpoch
    ? Math.max(FIXED_START_EPOCH, listingEpoch)
    : FIXED_START_EPOCH;

  // validasi agar tidak melewati batas akhir
  if (startEpoch > FIXED_END_EPOCH) {
    throw new Error("Listing date is outside configured training window");
  }

  return {
    startEpoch,
    endEpoch: FIXED_END_EPOCH,
    startISO: new Date(startEpoch).toISOString(),
    endISO: new Date(FIXED_END_EPOCH).toISOString(),
  };
}

// estimasi durasi optimasi berdasarkan jumlah data dibanding benchmark
function estimateDuration(dataCount) {
  // hitung estimasi menit secara proporsional
  const estimatedMinutes = Math.ceil(
    (dataCount / BENCHMARK_DATA_POINTS) * BENCHMARK_MINUTES,
  );

  // konversi ke detik
  const estimatedSeconds = estimatedMinutes * 60;

  // buat range estimasi (±15%)
  const minSeconds = Math.floor(estimatedSeconds * 0.85);
  const maxSeconds = Math.ceil(estimatedSeconds * 1.15);

  // format detik ke teks menit/detik
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds} detik`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes} menit ${secs} detik` : `${minutes} menit`;
  };

  return {
    estimatedSeconds,
    estimatedMinutes,
    estimatedRange: {
      min: minSeconds,
      max: maxSeconds,
      minFormatted: formatTime(minSeconds),
      maxFormatted: formatTime(maxSeconds),
    },
    formatted: formatTime(estimatedSeconds),

    // info perbandingan terhadap benchmark
    benchmarkInfo: {
      benchmarkDataPoints: BENCHMARK_DATA_POINTS,
      benchmarkMinutes: BENCHMARK_MINUTES,
      scalingFactor: (dataCount / BENCHMARK_DATA_POINTS).toFixed(2),
    },
  };
}

// bentuk ringkasan sinyal indikator terbaru dalam format terstruktur
function buildLatestIndicatorSnapshot(indicator) {
  if (!indicator) return null;

  return {
    sma: { signal: indicator.smaSignal || "neutral" },
    ema: { signal: indicator.emaSignal || "neutral" },
    rsi: { signal: indicator.rsiSignal || "neutral" },
    macd: { signal: indicator.macdSignal || "neutral" },
    bollingerBands: { signal: indicator.bbSignal || "neutral" },
    stochastic: { signal: indicator.stochSignal || "neutral" },
    stochasticRsi: { signal: indicator.stochRsiSignal || "neutral" },
    parabolicSar: { signal: indicator.psarSignal || "neutral" },
  };
}
// ambil estimasi waktu optimasi berdasarkan jumlah data historis
export async function getOptimizationEstimate(symbol, timeframe) {
  try {
    console.log(
      `Calculating optimization estimate for ${symbol} (${timeframe})`,
    );

    // ambil data coin dan timeframe dari database
    const [coin, timeframeRecord] = await Promise.all([
      prisma.coin.findUnique({
        where: { symbol },
        select: { id: true, name: true, listingDate: true },
      }),
      prisma.timeframe.findUnique({
        where: { timeframe },
        select: { id: true },
      }),
    ]);

    if (!coin) {
      throw new Error(`Coin ${symbol} not found in database`);
    }

    if (!timeframeRecord) {
      throw new Error(`Timeframe ${timeframe} not found in database`);
    }

    // tentukan range data yang digunakan
    const trainingWindow = resolveTrainingWindow(coin.listingDate);

    // hitung jumlah data indikator dan candle dalam range
    const [indicatorCount, candleCount] = await Promise.all([
      prisma.indicator.count({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
          time: {
            gte: BigInt(trainingWindow.startEpoch),
            lte: BigInt(trainingWindow.endEpoch),
          },
        },
      }),
      prisma.candle.count({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
          time: {
            gte: BigInt(trainingWindow.startEpoch),
            lte: BigInt(trainingWindow.endEpoch),
          },
        },
      }),
    ]);

    // gunakan jumlah data terkecil agar sinkron
    const dataCount = Math.min(indicatorCount, candleCount);

    if (dataCount === 0) {
      throw new Error(
        `No data available for ${symbol} in specified time range`,
      );
    }

    // hitung estimasi durasi
    const duration = estimateDuration(dataCount);

    const totalCombinations = 390625; // total kombinasi (5^8)

    return {
      dataPoints: dataCount,
      totalCombinations,
      trainingWindow,
      ...duration,
      displayNote: `Testing ${totalCombinations.toLocaleString()} combinations on ${dataCount.toLocaleString()} candles`,
    };
  } catch (err) {
    console.error("Error calculating estimate:", err.message);
    throw err;
  }
}

// ambil data indikator dan candle lalu gabungkan berdasarkan timestamp
async function prepareOptimizationData(coinId, timeframeId, trainingWindow) {
  console.log(`Preparing data for optimization...`);

  // ambil data indikator dan candle dalam range waktu
  const [indicators, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: {
        coinId,
        timeframeId,
        time: {
          gte: BigInt(trainingWindow.startEpoch),
          lte: BigInt(trainingWindow.endEpoch),
        },
      },
      orderBy: { time: "asc" },
    }),
    prisma.candle.findMany({
      where: {
        coinId,
        timeframeId,
        time: {
          gte: BigInt(trainingWindow.startEpoch),
          lte: BigInt(trainingWindow.endEpoch),
        },
      },
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  // gabungkan indikator dengan harga close berdasarkan waktu
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicators
    .filter((i) => map.has(i.time.toString()))
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

  // validasi data hasil merge
  if (!data.length) {
    throw new Error("Data kosong atau tidak cukup untuk optimasi");
  }

  if (data.length < 100) {
    throw new Error(
      `Data tidak cukup untuk optimasi (${data.length}/100 minimum)`,
    );
  }

  // tentukan range efektif dari data hasil merge
  const effectiveRange = {
    start: new Date(Number(data[0].time)).toISOString(),
    end: new Date(Number(data[data.length - 1].time)).toISOString(),
  };

  console.log(`Data prepared: ${data.length} merged data points`);
  console.log(
    `Effective data coverage: ${effectiveRange.start} → ${effectiveRange.end}`,
  );

  return {
    data,
    trainingWindow,
    effectiveRange,
  };
}

// jalankan optimasi untuk satu coin (ambil data, optimasi, simpan hasil)
export async function runOptimization(
  symbol,
  timeframe,
  { forceReoptimize = false, onProgress = null, checkCancel = null } = {},
) {
  const startTime = Date.now();

  console.log(`\nStarting optimization for ${symbol} (${timeframe})\n`);
  if (forceReoptimize) {
    console.log(`FORCE REOPTIMIZATION MODE enabled`);
  }

  try {
    // ambil coin dan timeframe dari database
    const [coin, timeframeRecord] = await Promise.all([
      prisma.coin.findUnique({
        where: { symbol },
        select: { id: true, listingDate: true },
      }),
      prisma.timeframe.findUnique({
        where: { timeframe },
        select: { id: true },
      }),
    ]);

    if (!coin) {
      throw new Error(`Coin ${symbol} not found in database`);
    }

    if (!timeframeRecord) {
      throw new Error(`Timeframe ${timeframe} not found in database`);
    }

    const trainingWindow = resolveTrainingWindow(coin.listingDate);

    // cek apakah sudah ada hasil optimasi sebelumnya
    const existingWeight = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
        startTest: BigInt(trainingWindow.startEpoch),
        endTest: BigInt(trainingWindow.endEpoch),
      },
      orderBy: { updatedAt: "desc" },
    });

    let performanceData, weightsData, lastOptimizedDate;

    // jika sudah ada dan tidak dipaksa ulang, gunakan hasil lama
    if (existingWeight && !forceReoptimize) {
      console.log(`Optimization already exists for ${symbol}`);

      performanceData = {
        roi: existingWeight.roi,
        winRate: existingWeight.winRate,
        maxDrawdown: existingWeight.maxDrawdown,
        sharpeRatio: existingWeight.sharpeRatio,
        trades: existingWeight.trades,
        initialCapital: 10000,
        finalCapital: existingWeight.finalCapital,
      };
      weightsData = existingWeight.weights;
      lastOptimizedDate = existingWeight.updatedAt;
    } else {
      // jalankan optimasi baru
      if (forceReoptimize && existingWeight) {
        console.log(`Forcing reoptimization despite existing weights...`);
      }

      // siapkan data untuk optimasi
      const prepared = await prepareOptimizationData(
        coin.id,
        timeframeRecord.id,
        trainingWindow,
      );
      const data = prepared.data;

      const estimateInfo = estimateDuration(data.length);

      console.log(`Starting exhaustive search algorithm...`);

      // jalankan algoritma optimasi
      const result = await optimizeIndicatorWeights(
        data,
        symbol,
        onProgress,
        checkCancel,
        {
          trainingWindow: prepared.trainingWindow,
          effectiveRange: prepared.effectiveRange,
          initialEstimateSeconds: estimateInfo.estimatedSeconds,
        },
      );

      // jika dibatalkan
      if (result.cancelled) {
        console.log(`Optimization was cancelled for ${symbol}`);
        return {
          success: false,
          cancelled: true,
          message: "Optimization cancelled by user",
        };
      }

      // simpan hasil ke database
      console.log(`Saving to database...`);
      await prisma.indicatorWeight.upsert({
        where: {
          coinId_timeframeId_startTest_endTest: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            startTest: BigInt(trainingWindow.startEpoch),
            endTest: BigInt(trainingWindow.endEpoch),
          },
        },
        update: {
          weights: result.bestWeights,
          roi: result.performance.roi,
          winRate: result.performance.winRate,
          maxDrawdown: result.performance.maxDrawdown,
          sharpeRatio: result.performance.sharpeRatio,
          trades: result.performance.trades,
          finalCapital: result.performance.finalCapital,
          candleCount: data.length,
        },
        create: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
          startTest: BigInt(trainingWindow.startEpoch),
          endTest: BigInt(trainingWindow.endEpoch),
          weights: result.bestWeights,
          roi: result.performance.roi,
          winRate: result.performance.winRate,
          maxDrawdown: result.performance.maxDrawdown,
          sharpeRatio: result.performance.sharpeRatio,
          trades: result.performance.trades,
          finalCapital: result.performance.finalCapital,
          candleCount: data.length,
        },
      });

      // refresh cache bobot
      invalidateWeightsCache(symbol, timeframe);

      performanceData = result.performance;
      performanceData.initialCapital = 10000;
      weightsData = result.bestWeights;
      lastOptimizedDate = new Date().toISOString();

      console.log(`Optimization saved to database`);
    }

    // ambil data candle dan indikator terbaru
    const [latestCandle, latestIndicator] = await Promise.all([
      prisma.candle.findFirst({
        where: { coinId: coin.id, timeframeId: timeframeRecord.id },
        orderBy: { time: "desc" },
        select: {
          time: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      }),
      prisma.indicator.findFirst({
        where: { coinId: coin.id, timeframeId: timeframeRecord.id },
        orderBy: { time: "desc" },
      }),
    ]);

    if (!latestCandle || !latestIndicator) {
      throw new Error("No latest candle or indicator data found");
    }

    const totalTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
    console.log(`\nOptimization complete in ${totalTime}\n`);

    return {
      success: true,
      symbol,
      timeframe,
      lastOptimized: lastOptimizedDate,
      performance: performanceData,
      weights: weightsData,
      latest: {
        time: Number(latestCandle.time),
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
        volume: latestCandle.volume,
      },
      latestIndicator: buildLatestIndicatorSnapshot(latestIndicator),
    };
  } catch (err) {
    console.error("Error in optimization:", err.message);
    throw err;
  }
}

// jalankan backtest menggunakan bobot hasil optimasi
export async function runBacktestWithOptimizedWeights(symbol, timeframe) {
  try {
    console.log(`\nStarting backtest for ${symbol} (${timeframe})`);

    // ambil coin dan timeframe dari database
    const [coin, timeframeRecord] = await Promise.all([
      prisma.coin.findUnique({
        where: { symbol },
        select: { id: true, listingDate: true },
      }),
      prisma.timeframe.findUnique({
        where: { timeframe },
        select: { id: true },
      }),
    ]);

    if (!coin) {
      throw new Error(`Coin ${symbol} not found`);
    }

    if (!timeframeRecord) {
      throw new Error(`Timeframe ${timeframe} not found`);
    }

    // tentukan range data yang digunakan
    const trainingWindow = resolveTrainingWindow(coin.listingDate);

    // ambil bobot hasil optimasi terbaru
    const weights = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
        startTest: BigInt(trainingWindow.startEpoch),
        endTest: BigInt(trainingWindow.endEpoch),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!weights) {
      throw new Error(
        "No optimized weights found. Please run optimization first.",
      );
    }

    // siapkan data untuk backtest
    const prepared = await prepareOptimizationData(
      coin.id,
      timeframeRecord.id,
      trainingWindow,
    );
    const data = prepared.data;

    console.log(`Running backtest dengan optimized weights...`);

    // jalankan backtest
    const result = await backtestWithWeights(data, weights.weights);

    console.log(`Backtest complete\n`);

    return {
      success: true,
      symbol,
      timeframe,
      totalData: data.length,
      weights: weights.weights,
      performance: {
        roi: result.roi,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio,
        trades: result.trades,
        finalCapital: result.finalCapital,
      },
    };
  } catch (err) {
    console.error("Error in backtest:", err.message);
    throw err;
  }
}

// jalankan optimasi untuk 20 coin teratas secara berurutan
export async function optimizeAllCoins(timeframe) {
  try {
    console.log(`\nStarting mass optimization for 20 top coins...\n`);

    // ambil 20 coin teratas berdasarkan rank
    const coins = await prisma.coin.findMany({
      orderBy: { rank: "asc" },
      take: 20,
      select: { id: true, symbol: true, listingDate: true },
    });

    if (!coins.length) {
      throw new Error("No coins found in database");
    }

    // ambil timeframe dari database
    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      throw new Error(`Timeframe ${timeframe} not found`);
    }

    const results = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // loop setiap coin untuk dioptimasi
    for (const [index, coin] of coins.entries()) {
      const symbol = coin.symbol.toUpperCase();
      const progress = `[${index + 1}/${coins.length}]`;

      try {
        console.log(`${progress} Optimizing ${symbol}...`);

        // tentukan range data
        const trainingWindow = resolveTrainingWindow(coin.listingDate);

        // cek apakah sudah pernah dioptimasi
        const existingWeight = await prisma.indicatorWeight.findFirst({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            startTest: BigInt(trainingWindow.startEpoch),
            endTest: BigInt(trainingWindow.endEpoch),
          },
          orderBy: { updatedAt: "desc" },
        });

        // jika sudah ada, skip
        if (existingWeight) {
          console.log(`${progress} ${symbol} already optimized, skipping...`);

          results.push({
            symbol,
            success: true,
            skipped: true,
            performance: {
              roi: existingWeight.roi,
              winRate: existingWeight.winRate,
              maxDrawdown: existingWeight.maxDrawdown,
            },
          });

          skippedCount++;
          continue;
        }

        // siapkan data untuk optimasi
        const prepared = await prepareOptimizationData(
          coin.id,
          timeframeRecord.id,
          trainingWindow,
        );
        const data = prepared.data;

        // jalankan optimasi
        const estimateInfo = estimateDuration(data.length);
        const result = await optimizeIndicatorWeights(
          data,
          symbol,
          null,
          null,
          {
            trainingWindow,
            effectiveRange: prepared.effectiveRange,
            initialEstimateSeconds: estimateInfo.estimatedSeconds,
          },
        );

        // simpan hasil ke database
        await prisma.indicatorWeight.create({
          data: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            startTest: BigInt(trainingWindow.startEpoch),
            endTest: BigInt(trainingWindow.endEpoch),
            weights: result.bestWeights,
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
            candleCount: data.length,
          },
        });

        // refresh cache bobot setelah update
        invalidateWeightsCache(symbol, timeframe);

        results.push({
          symbol,
          success: true,
          skipped: false,
          performance: result.performance,
          weights: result.bestWeights,
        });

        successCount++;

        console.log(
          `${progress} ${symbol} → ROI: ${result.performance.roi.toFixed(2)}%`,
        );
      } catch (err) {
        console.error(`${progress} Error optimizing ${symbol}:`, err.message);

        results.push({
          symbol,
          success: false,
          message: err.message,
        });

        failedCount++;
      }
    }

    // ringkasan hasil optimasi
    const summaryMessage = `Optimasi selesai (${successCount} berhasil / ${skippedCount} di-skip / ${failedCount} gagal)`;
    console.log(`\n${summaryMessage}\n`);

    return {
      success: true,
      message: summaryMessage,
      count: coins.length,
      successCount,
      skippedCount,
      failedCount,
      results,
    };
  } catch (err) {
    console.error("Error optimizing all coins:", err.message);
    throw err;
  }
}
