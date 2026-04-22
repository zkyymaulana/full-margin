/**
 * 🎯 Layanan Orkestrasi Optimasi
 * ================================================================
 * Service untuk mengelola workflow optimization end-to-end.
 *
 * Tanggung Jawab:
 * - Fetch dan prepare data dari database
 * - Merge candle data dengan indicator data
 * - Koordinasi dengan algorithm service
 * - Save hasil ke database
 * - Generate optimization estimates
 * - Handle multi-coin optimization
 * ================================================================
 */

import { prisma } from "../../lib/prisma.js";
import {
  optimizeIndicatorWeights,
  backtestWithWeights,
} from "./multi-indicator.service.js";

// const FIXED_START_EPOCH = Date.parse("2025-01-01T00:00:00Z");
// const FIXED_END_EPOCH = Date.parse("2025-12-01T00:00:00Z");

// Fixed training window untuk semua optimization
const FIXED_START_EPOCH = Date.parse("2020-01-01T00:00:00Z");
const FIXED_END_EPOCH = Date.parse("2025-01-01T00:00:00Z");

const BENCHMARK_DATA_POINTS = 45893;
const BENCHMARK_MINUTES = 78;

function toEpochMs(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTrainingWindow(listingDate) {
  const listingEpoch = toEpochMs(listingDate);
  const startEpoch = listingEpoch
    ? Math.max(FIXED_START_EPOCH, listingEpoch)
    : FIXED_START_EPOCH;

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

function estimateDuration(dataCount) {
  const estimatedMinutes = Math.ceil(
    (dataCount / BENCHMARK_DATA_POINTS) * BENCHMARK_MINUTES,
  );
  const estimatedSeconds = estimatedMinutes * 60;

  const minSeconds = Math.floor(estimatedSeconds * 0.85);
  const maxSeconds = Math.ceil(estimatedSeconds * 1.15);

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
    benchmarkInfo: {
      benchmarkDataPoints: BENCHMARK_DATA_POINTS,
      benchmarkMinutes: BENCHMARK_MINUTES,
      scalingFactor: (dataCount / BENCHMARK_DATA_POINTS).toFixed(2),
    },
  };
}

/**
 * 📊 Dapatkan estimasi waktu optimization
 *
 *
 * Menggunakan formula linear scaling berdasarkan benchmark:
 * - Benchmark: 45,893 data points = 78 menit
 * - Untuk data points lain: (dataPoints / 45893) × 78 menit
 * - Range: ±15% karena variance algoritma
 */
export async function getOptimizationEstimate(symbol, timeframe) {
  try {
    console.log(
      `📊 Calculating optimization estimate for ${symbol} (${timeframe})`,
    );

    // Lookup coin dan timeframe dari database
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

    const trainingWindow = resolveTrainingWindow(coin.listingDate);

    // Gunakan basis data point yang sama dengan proses optimization runtime.
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

    const dataCount = Math.min(indicatorCount, candleCount);

    if (dataCount === 0) {
      throw new Error(
        `No data available for ${symbol} in specified time range`,
      );
    }

    const duration = estimateDuration(dataCount);
    const totalCombinations = 390625; // 5^8

    return {
      dataPoints: dataCount,
      totalCombinations,
      trainingWindow,
      ...duration,
      displayNote: `Testing ${totalCombinations.toLocaleString()} combinations on ${dataCount.toLocaleString()} candles`,
    };
  } catch (err) {
    console.error("❌ Error calculating estimate:", err.message);
    throw err;
  }
}

/**
 * 🔧 Prepare data untuk optimization
 *
 * Mengambil data dari database, merge candle dengan indicator,
 * dan return dalam format yang siap untuk algorithm.
 *
 * @private
 */
async function prepareOptimizationData(coinId, timeframeId, trainingWindow) {
  console.log(`🔧 Preparing data for optimization...`);

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

  // Merge data berdasarkan timestamp
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const data = indicators
    .filter((i) => map.has(i.time.toString()))
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

  if (!data.length) {
    throw new Error("Data kosong atau tidak cukup untuk optimasi");
  }

  if (data.length < 100) {
    throw new Error(
      `Data tidak cukup untuk optimasi (${data.length}/100 minimum)`,
    );
  }

  const effectiveRange = {
    start: new Date(Number(data[0].time)).toISOString(),
    end: new Date(Number(data[data.length - 1].time)).toISOString(),
  };

  console.log(`✅ Data prepared: ${data.length} merged data points`);
  console.log(
    `ℹ️ Effective data coverage: ${effectiveRange.start} → ${effectiveRange.end}`,
  );

  return {
    data,
    trainingWindow,
    effectiveRange,
  };
}

/**
 * 🚀 Jalankan optimization untuk single cryptocurrency
 *
 *
 * Workflow:
 * 1. Check apakah optimization sudah ada
 * 2. Jika force=true, jalankan optimization baru
 * 3. Simpan hasil ke database
 * 4. Return result dengan latest data
 */
export async function runOptimization(
  symbol,
  timeframe,
  { forceReoptimize = false, onProgress = null, checkCancel = null } = {},
) {
  const startTime = Date.now();

  console.log(`\n📊 Starting optimization for ${symbol} (${timeframe})\n`);
  if (forceReoptimize) {
    console.log(`🔄 FORCE REOPTIMIZATION MODE enabled`);
  }

  try {
    // Get coin dan timeframe dari database
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

    // Check apakah optimization sudah ada
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

    // Jika sudah ada dan tidak force reoptimize, pakai existing
    if (existingWeight && !forceReoptimize) {
      console.log(`⏩ Optimization already exists for ${symbol}`);
      console.log(
        `   ROI: ${existingWeight.roi.toFixed(2)}%, WinRate: ${existingWeight.winRate.toFixed(2)}%`,
      );

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
      // Run optimization baru
      if (forceReoptimize && existingWeight) {
        console.log(`🔄 Forcing reoptimization despite existing weights...`);
      }

      // Prepare data
      const prepared = await prepareOptimizationData(
        coin.id,
        timeframeRecord.id,
        trainingWindow,
      );
      const data = prepared.data;
      const estimateInfo = estimateDuration(data.length);

      console.log(`🚀 Starting exhaustive search algorithm...`);

      // Run optimization algorithm
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

      // Handle cancellation
      if (result.cancelled) {
        console.log(`🛑 Optimization was cancelled for ${symbol}`);
        return {
          success: false,
          cancelled: true,
          message: "Optimization cancelled by user",
        };
      }

      // Save ke database
      console.log(`💾 Saving to database...`);
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

      performanceData = result.performance;
      performanceData.initialCapital = 10000;
      weightsData = result.bestWeights;
      lastOptimizedDate = new Date().toISOString();

      console.log(`✅ Optimization saved to database`);
    }

    // Fetch latest candle dan indicator untuk return
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
    console.log(`\n✅ Optimization complete in ${totalTime}\n`);

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
    };
  } catch (err) {
    console.error("❌ Error in optimization:", err.message);
    throw err;
  }
}

/**
 * 📊 Jalankan backtest dengan weights yang sudah dioptimalkan
 *
 */
export async function runBacktestWithOptimizedWeights(symbol, timeframe) {
  try {
    console.log(`\n📊 Starting backtest for ${symbol} (${timeframe})`);

    // Lookup coin dan timeframe
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

    const trainingWindow = resolveTrainingWindow(coin.listingDate);

    // Find optimized weights
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

    // Prepare data
    const prepared = await prepareOptimizationData(
      coin.id,
      timeframeRecord.id,
      trainingWindow,
    );
    const data = prepared.data;

    console.log(`📊 Running backtest dengan optimized weights...`);

    // Run backtest
    const result = await backtestWithWeights(data, weights.weights);

    console.log(`✅ Backtest complete\n`);

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
    console.error("❌ Error in backtest:", err.message);
    throw err;
  }
}

/**
 * 🔄 Optimize semua top 20 coins
 *
 */
export async function optimizeAllCoins(timeframe) {
  try {
    console.log(`\n🚀 Starting mass optimization for 20 top coins...\n`);

    // Get top 20 coins
    const coins = await prisma.coin.findMany({
      orderBy: { rank: "asc" },
      take: 20,
      select: { id: true, symbol: true, listingDate: true },
    });

    if (!coins.length) {
      throw new Error("No coins found in database");
    }

    // Get timeframe
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

    // Optimize setiap coin
    for (const [index, coin] of coins.entries()) {
      const symbol = coin.symbol.toUpperCase();
      const progress = `[${index + 1}/${coins.length}]`;

      try {
        console.log(`${progress} 📊 Optimizing ${symbol}...`);

        // Check existing weights
        const trainingWindow = resolveTrainingWindow(coin.listingDate);
        const existingWeight = await prisma.indicatorWeight.findFirst({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            startTest: BigInt(trainingWindow.startEpoch),
            endTest: BigInt(trainingWindow.endEpoch),
          },
          orderBy: { updatedAt: "desc" },
        });

        if (existingWeight) {
          console.log(
            `${progress} ⏭️ ${symbol} already optimized, skipping...`,
          );
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

        // Prepare data
        const prepared = await prepareOptimizationData(
          coin.id,
          timeframeRecord.id,
          trainingWindow,
        );
        const data = prepared.data;

        // Run optimization
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

        // Save to database
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

        results.push({
          symbol,
          success: true,
          skipped: false,
          performance: result.performance,
          weights: result.bestWeights,
        });

        successCount++;
        console.log(
          `${progress} ✅ ${symbol} → ROI: ${result.performance.roi.toFixed(2)}%`,
        );
      } catch (err) {
        console.error(
          `${progress} ❌ Error optimizing ${symbol}:`,
          err.message,
        );
        results.push({
          symbol,
          success: false,
          message: err.message,
        });
        failedCount++;
      }
    }

    const summaryMessage = `Optimasi selesai (${successCount} berhasil / ${skippedCount} di-skip / ${failedCount} gagal)`;
    console.log(`\n✅ ${summaryMessage}\n`);

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
    console.error("❌ Error optimizing all coins:", err.message);
    throw err;
  }
}

export default {
  getOptimizationEstimate,
  runOptimization,
  runBacktestWithOptimizedWeights,
  optimizeAllCoins,
};
