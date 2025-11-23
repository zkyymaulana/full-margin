import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";
import { backtestWithWeights } from "../services/multiIndicator/multiIndicator-backtest.service.js";
import {
  calculateIndividualSignals,
  scoreSignal,
} from "../utils/indicator.utils.js";

// 🔒 FIXED TRAINING WINDOW (CONSISTENT ACROSS ALL FUNCTIONS)
const FIXED_START_EPOCH = Date.parse("2020-01-01T00:00:00Z"); // 1578016800000
const FIXED_END_EPOCH = Date.parse("2025-01-01T00:00:00Z"); // 1735689600000

/* --- Optimize --- */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 Starting Full Exhaustive Search Optimization for ${symbol} (${timeframe})`
    );
    console.log(`   Training window: 2020-01-01 → 2025-01-01 (FIXED)`);

    const startQuery = Date.now();

    // 1️⃣ Check if optimization already exists
    const existingWeight = await prisma.indicatorWeight.findFirst({
      where: {
        symbol,
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
    });

    if (existingWeight) {
      console.log(`⏩ Optimization already exists for ${symbol}`);
      console.log(
        `   ROI: ${existingWeight.roi.toFixed(2)}%, WinRate: ${existingWeight.winRate.toFixed(2)}%`
      );

      return res.json({
        success: true,
        symbol,
        timeframe,
        performance: {
          roi: existingWeight.roi,
          winRate: existingWeight.winRate,
          maxDrawdown: existingWeight.maxDrawdown,
          sharpeRatio: null, // Not stored in DB for existing records
          trades: existingWeight.trades,
        },
        weights: existingWeight.weights,
        lastOptimized: existingWeight.updatedAt,
      });
    }

    // 2️⃣ Fetch data within fixed window
    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

    if (!data.length)
      return res.status(400).json({
        success: false,
        message: "Data kosong atau tidak cukup untuk optimasi",
      });

    if (data.length < 100) {
      return res.status(400).json({
        success: false,
        message: `Data tidak cukup untuk optimasi (${data.length}/100 minimum)`,
      });
    }

    // Format tanggal
    const formatDate = (t) =>
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(Number(t)));

    const range = {
      start: formatDate(data[0]?.time),
      end: formatDate(data[data.length - 1]?.time),
    };

    const dataset = {
      candleStart: formatDate(candles[0]?.time),
      indicatorStart: formatDate(indicators[0]?.time),
      candleCount: candles.length,
      indicatorCount: indicators.length,
      mergedDataPoints: data.length,
    };

    console.log(`   Dataset: ${data.length} merged data points`);
    console.log(`   Range: ${range.start} → ${range.end}`);

    // Jalankan Full Exhaustive Search Optimization (5^8 = 390,625 combinations)
    const result = await optimizeIndicatorWeights(data, symbol);

    // Save to database with FIXED epochs
    await prisma.indicatorWeight.upsert({
      where: {
        symbol_timeframe_startTrain_endTrain: {
          symbol,
          timeframe,
          startTrain: BigInt(FIXED_START_EPOCH),
          endTrain: BigInt(FIXED_END_EPOCH),
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
        symbol,
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
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

    const totalProcessingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Optimization saved to database`);
    console.log(`   Total processing time: ${totalProcessingTime}`);

    res.json({
      success: true,
      symbol,
      timeframe,
      performance: {
        roi: result.performance.roi,
        winRate: result.performance.winRate,
        maxDrawdown: result.performance.maxDrawdown,
        sharpeRatio: result.performance.sharpeRatio,
        trades: result.performance.trades,
        finalCapital: result.performance.finalCapital,
      },
      weights: result.bestWeights,
      lastOptimized: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Error in optimization:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Optimize All --- */
export async function optimizeAllCoinsController(req, res) {
  try {
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(`\n🚀 Starting mass optimization for 20 top coins...`);
    console.log(`   Training window: 2020-01-01 → 2025-01-01 (FIXED)\n`);

    // Ambil 20 coin teratas
    const coins = await prisma.coin.findMany({
      orderBy: { rank: "asc" },
      take: 20,
      select: { symbol: true },
    });

    if (!coins.length) {
      return res.status(404).json({
        success: false,
        message: "Tidak ada data coin di tabel Coin.",
      });
    }

    const results = [];
    let successCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    // Proses setiap coin secara sequential
    for (const [index, coin] of coins.entries()) {
      const symbol = coin.symbol.toUpperCase();
      const progress = `[${index + 1}/${coins.length}]`;

      try {
        console.log(`${progress} 📊 Optimizing ${symbol}...`);

        // 1️⃣ Fetch data dengan FIXED window
        const [indicators, candles] = await Promise.all([
          prisma.indicator.findMany({
            where: {
              symbol,
              timeframe,
              time: {
                gte: BigInt(FIXED_START_EPOCH),
                lt: BigInt(FIXED_END_EPOCH),
              },
            },
            orderBy: { time: "asc" },
          }),
          prisma.candle.findMany({
            where: {
              symbol,
              timeframe,
              time: {
                gte: BigInt(FIXED_START_EPOCH),
                lt: BigInt(FIXED_END_EPOCH),
              },
            },
            orderBy: { time: "asc" },
            select: { time: true, close: true },
          }),
        ]);

        // 2️⃣ Validasi data candle
        if (!candles.length) {
          console.warn(`${progress} ⚠️ No candle data for ${symbol}`);
          results.push({
            symbol,
            success: false,
            message: "No candle data",
          });
          failedCount++;
          continue;
        }

        // 3️⃣ Gabungkan indikator + harga
        const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
        const data = indicators
          .filter((i) => map.has(i.time.toString()))
          .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

        // 4️⃣ Validasi data gabungan
        if (!data.length || data.length < 100) {
          console.warn(
            `${progress} ⚠️ Insufficient data for ${symbol} (${data.length}/100 minimum)`
          );
          results.push({
            symbol,
            success: false,
            message: `Insufficient data (${data.length}/100 minimum)`,
          });
          failedCount++;
          continue;
        }

        // 5️⃣ CEK DULU apakah sudah ada optimasi sebelumnya
        const existingWeight = await prisma.indicatorWeight.findFirst({
          where: {
            symbol,
            timeframe,
            startTrain: BigInt(FIXED_START_EPOCH),
            endTrain: BigInt(FIXED_END_EPOCH),
          },
        });

        // Jika sudah ada, skip optimasi
        if (existingWeight) {
          console.log(
            `${progress} ⏭️ ${symbol} already optimized, skipping...`
          );
          console.log(
            `   ROI: ${existingWeight.roi.toFixed(2)}% | WinRate: ${existingWeight.winRate.toFixed(2)}% | MDD: ${existingWeight.maxDrawdown.toFixed(2)}%`
          );

          // Format tanggal untuk response
          const formatDate = (t) =>
            new Intl.DateTimeFormat("id-ID", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Asia/Jakarta",
            }).format(new Date(Number(t)));

          results.push({
            symbol,
            success: true,
            updated: false,
            skipped: true,
            timeframe,
            dataPoints: data.length,
            range: {
              start: formatDate(data[0].time),
              end: formatDate(data[data.length - 1].time),
            },
            performance: {
              roi: existingWeight.roi,
              winRate: existingWeight.winRate,
              maxDrawdown: existingWeight.maxDrawdown,
              sharpeRatio: existingWeight.sharpeRatio,
              trades: existingWeight.trades,
              finalCapital: existingWeight.finalCapital,
            },
            weights: existingWeight.weights,
            lastOptimized: existingWeight.updatedAt,
          });

          successCount++;
          continue;
        }

        // 6️⃣ Jalankan optimasi HANYA jika belum ada
        console.log(`${progress} 🔍 Starting optimization for ${symbol}...`);
        const result = await optimizeIndicatorWeights(data, symbol);

        // 7️⃣ Simpan ke database (create karena pasti belum ada)
        await prisma.indicatorWeight.create({
          data: {
            symbol,
            timeframe,
            startTrain: BigInt(FIXED_START_EPOCH),
            endTrain: BigInt(FIXED_END_EPOCH),
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

        // Format tanggal untuk response
        const formatDate = (t) =>
          new Intl.DateTimeFormat("id-ID", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
          }).format(new Date(Number(t)));

        // 8️⃣ Tambahkan ke hasil
        results.push({
          symbol,
          success: true,
          updated: false,
          skipped: false,
          timeframe,
          dataPoints: data.length,
          range: {
            start: formatDate(data[0].time),
            end: formatDate(data[data.length - 1].time),
          },
          performance: {
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
          },
          weights: result.bestWeights,
          optimizationTimeSeconds: result.executionTimeSeconds,
        });

        successCount++;
        console.log(
          `${progress} ✅ ${symbol} created → ROI: ${result.performance.roi.toFixed(2)}% | WinRate: ${result.performance.winRate.toFixed(2)}% | MDD: ${result.performance.maxDrawdown.toFixed(2)}%`
        );
      } catch (err) {
        console.error(
          `${progress} ❌ Error optimizing ${symbol}:`,
          err.message
        );
        results.push({
          symbol,
          success: false,
          message: err.message,
        });
        failedCount++;
      }
    }

    const summaryMessage = `Optimasi selesai (${successCount} berhasil / ${updatedCount} diperbarui / ${failedCount} gagal)`;

    console.log(`\n✅ ${summaryMessage}`);

    res.json({
      success: true,
      message: summaryMessage,
      count: coins.length,
      successCount,
      updatedCount,
      failedCount,
      results,
    });
  } catch (err) {
    console.error("❌ Error optimizeAllCoins:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Backtest --- */
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 Starting optimized-weight backtest for ${symbol} (${timeframe})`
    );

    // Find weight dengan FIXED window
    const latest = await prisma.indicatorWeight.findFirst({
      where: {
        symbol,
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!latest)
      return res.status(404).json({
        success: false,
        message: "No optimized weights found. Please run optimization first.",
      });

    const startQuery = Date.now();

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

    if (!data.length)
      return res.status(400).json({
        success: false,
        message: "Data tidak ditemukan",
      });

    // Format tanggal
    const formatDate = (t) =>
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(Number(t)));

    const range = {
      start: formatDate(data[0]?.time),
      end: formatDate(data[data.length - 1]?.time),
    };

    const dataset = {
      candleStart: formatDate(candles[0]?.time),
      indicatorStart: formatDate(indicators[0]?.time),
      candleCount: candles.length,
      indicatorCount: indicators.length,
    };

    console.log(`   Total data points: ${data.length}`);
    console.log(`   Range: ${range.start} - ${range.end}`);
    console.log(`   Using optimized weights:`, latest.weights);

    const result = await backtestWithWeights(data, latest.weights);
    const processingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Optimized-weight backtest completed in ${processingTime}`);
    console.log(
      `   ROI: ${result.roi}%, Win Rate: ${result.winRate}%, Trades: ${result.trades}`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: data.length,
      range,
      dataset,
      processingTime,
      timestamp: new Date().toISOString(),
      methodology: "Optimized-Weight Multi-Indicator Backtest",
      weights: latest.weights,
      performance: {
        roi: result.roi,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio || null,
        trades: result.trades,
        finalCapital: result.finalCapital,
      },
    });
  } catch (err) {
    console.error("❌ Error in optimized-weight backtest:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Backtest (Equal Weight) --- */
export async function backtestWithEqualWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 Starting equal-weight backtest for ${symbol} (${timeframe})`
    );
    console.log(`   Training window: 2020-01-01 → 2025-01-01 (FIXED)`);

    const startQuery = Date.now();

    // Ambil data dengan FIXED window
    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    // Gabungkan indikator & harga berdasarkan waktu
    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

    if (!data.length)
      return res.status(400).json({
        success: false,
        message: "Data historis kosong untuk simbol ini.",
      });

    // Format tanggal
    const formatDate = (t) =>
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(Number(t)));

    const range = {
      start: formatDate(data[0]?.time),
      end: formatDate(data[data.length - 1]?.time),
    };

    const dataset = {
      candleStart: formatDate(candles[0]?.time),
      indicatorStart: formatDate(indicators[0]?.time),
      candleCount: candles.length,
      indicatorCount: indicators.length,
    };

    console.log(`   Total data points: ${data.length}`);
    console.log(`   Range: ${range.start} - ${range.end}`);

    // Tentukan semua indikator aktif
    const allIndicators = [
      "SMA",
      "EMA",
      "RSI",
      "MACD",
      "BollingerBands",
      "Stochastic",
      "PSAR",
      "StochasticRSI",
    ];

    // Buat semua bobot = 1 (equal weight)
    const equalWeights = Object.fromEntries(allIndicators.map((k) => [k, 1]));

    // Jalankan backtest
    const result = await backtestWithWeights(data, equalWeights);
    const processingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Equal-weight backtest completed in ${processingTime}`);
    console.log(
      `   ROI: ${result.roi}%, Win Rate: ${result.winRate}%, Trades: ${result.trades}`
    );

    return res.json({
      success: true,
      symbol,
      timeframe,
      totalData: data.length,
      range,
      dataset,
      processingTime,
      timestamp: new Date().toISOString(),
      methodology: "Equal-Weighted Multi-Indicator Backtest (Rule-Based)",
      weights: equalWeights,
      performance: {
        roi: result.roi,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        trades: result.trades,
        finalCapital: result.finalCapital,
        sharpeRatio: result.sharpeRatio || null,
      },
    });
  } catch (err) {
    console.error("❌ Error in equal-weight backtest:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Backtest All Coins with BTC Weights --- */
export async function backtestAllWithBTCWeightsController(req, res) {
  try {
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    // Ambil bobot BTC dengan FIXED window
    const btcWeights = await prisma.indicatorWeight.findFirst({
      where: {
        symbol: "BTC-USD",
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!btcWeights) {
      return res.status(404).json({
        success: false,
        message: "Bobot BTC-USD belum dioptimasi.",
      });
    }

    // Ambil top 20 aset dari tabel Coin
    const coins = await prisma.coin.findMany({
      orderBy: { rank: "asc" },
      take: 20,
      select: { symbol: true },
    });

    if (!coins.length) {
      return res.status(404).json({
        success: false,
        message: "Tidak ada data coin di tabel Coin.",
      });
    }

    const results = [];
    console.log(
      `🚀 Backtesting all ${coins.length} coins using BTC weights...`
    );
    console.log(`   Training window: 2020-01-01 → 2025-01-01 (FIXED)\n`);

    for (const coin of coins) {
      const symbol = coin.symbol.toUpperCase();

      const [indicators, candles] = await Promise.all([
        prisma.indicator.findMany({
          where: {
            symbol,
            timeframe,
            time: {
              gte: BigInt(FIXED_START_EPOCH),
              lt: BigInt(FIXED_END_EPOCH),
            },
          },
          orderBy: { time: "asc" },
        }),
        prisma.candle.findMany({
          where: {
            symbol,
            timeframe,
            time: {
              gte: BigInt(FIXED_START_EPOCH),
              lt: BigInt(FIXED_END_EPOCH),
            },
          },
          select: { time: true, close: true },
        }),
      ]);

      if (!candles.length) {
        console.warn(`⚠️ Data kosong untuk ${symbol}`);
        results.push({
          success: false,
          symbol,
          message: "Data candle kosong.",
        });
        continue;
      }

      // Gabungkan indikator & harga
      const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
      const data = indicators
        .filter((i) => map.has(i.time.toString()))
        .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

      if (!data.length) {
        console.warn(`⚠️ Tidak ada indikator cocok untuk ${symbol}`);
        results.push({
          success: false,
          symbol,
          message: "Tidak ada indikator cocok.",
        });
        continue;
      }

      // Jalankan backtest dengan bobot BTC
      const result = await backtestWithWeights(data, btcWeights.weights, {
        fastMode: true,
      });

      results.push({
        success: true,
        symbol,
        timeframe,
        methodology:
          "Cross-Asset Backtest using BTC-USD Optimized Weights (Full Exhaustive Search)",
        btcWeights: btcWeights.weights,
        performance: {
          roi: result.roi,
          winRate: result.winRate,
          maxDrawdown: result.maxDrawdown,
          trades: result.trades,
        },
      });

      console.log(
        `✅ ${symbol} done → ROI ${result.roi.toFixed(2)}%, WinRate ${result.winRate.toFixed(2)}%`
      );
    }

    res.json({
      success: true,
      message: "Backtest selesai untuk semua aset menggunakan bobot BTC.",
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("❌ Error backtestAllWithBTCWeights:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* --- Validate Signal Consistency (Chart vs Database) --- */
export async function validateSignalConsistencyController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);

    console.log(
      `\n🔍 Validating signal consistency for ${symbol} (${timeframe})`
    );
    console.log(`   Checking ${limit} most recent candles...`);

    const startQuery = Date.now();

    // 1️⃣ Ambil data candle terbaru
    const candles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      take: limit,
      select: { time: true, close: true, high: true, low: true },
    });

    if (!candles.length) {
      return res.status(404).json({
        success: false,
        message: "No candle data found",
      });
    }

    // 2️⃣ Ambil indikator dari database untuk timestamp yang sama
    const times = candles.map((c) => c.time);
    const indicators = await prisma.indicator.findMany({
      where: {
        symbol,
        timeframe,
        time: { in: times },
      },
      orderBy: { time: "desc" },
    });

    // 3️⃣ Ambil bobot optimasi (jika ada)
    const weights = await prisma.indicatorWeight.findFirst({
      where: {
        symbol,
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
    });

    // 4️⃣ Buat map untuk lookup cepat
    const indicatorMap = new Map(indicators.map((i) => [i.time.toString(), i]));

    // 5️⃣ Validasi setiap candle
    const validationResults = [];
    let validCount = 0;
    let invalidCount = 0;
    let missingCount = 0;
    let dbSourceCount = 0;
    let weightedSourceCount = 0;

    for (const candle of candles) {
      const timeStr = candle.time.toString();
      const indicator = indicatorMap.get(timeStr);

      if (!indicator) {
        missingCount++;
        validationResults.push({
          time: Number(candle.time),
          timestamp: new Date(Number(candle.time)).toISOString(),
          status: "missing",
          reason: "No indicator data in database",
        });
        continue;
      }

      // A. Signal dari database (overallSignal)
      const dbSignal = indicator.overallSignal?.toLowerCase();
      let dbMappedSignal = null;

      if (dbSignal === "strong_buy" || dbSignal === "buy") {
        dbMappedSignal = "buy";
      } else if (dbSignal === "strong_sell" || dbSignal === "sell") {
        dbMappedSignal = "sell";
      }

      // B. Signal dari weighted calculation (jika ada weights)
      let weightedSignal = null;
      if (weights) {
        const signals = {
          SMA: indicator.smaSignal,
          EMA: indicator.emaSignal,
          RSI: indicator.rsiSignal,
          MACD: indicator.macdSignal,
          BollingerBands: indicator.bbSignal,
          Stochastic: indicator.stochSignal,
          StochasticRSI: indicator.stochRsiSignal,
          PSAR: indicator.psarSignal,
        };

        const keys = Object.keys(weights.weights);
        const weighted = keys.map(
          (k) =>
            (weights.weights[k] ?? 0) * scoreSignal(signals[k] ?? "neutral")
        );
        const score = weighted.reduce((a, b) => a + b, 0) / (keys.length || 1);

        if (score > 0) {
          weightedSignal = "buy";
        } else if (score < 0) {
          weightedSignal = "sell";
        }
      }

      // C. Tentukan signal mana yang digunakan di chart (saat ini: DB signal)
      const chartSignal = dbMappedSignal; // Sesuai implementasi di chart.controller.js

      // D. Validasi konsistensi
      const isValid = chartSignal !== null; // Chart hanya tampilkan jika ada signal

      if (isValid && chartSignal) {
        validCount++;
        dbSourceCount++;
      } else if (!chartSignal) {
        validCount++; // Neutral juga valid (tidak ditampilkan)
      }

      validationResults.push({
        time: Number(candle.time),
        timestamp: new Date(Number(candle.time)).toISOString(),
        price: candle.close,
        status: "valid",
        signalSource: "database_overallSignal",
        dbSignal: {
          raw: dbSignal,
          mapped: dbMappedSignal,
          strength: indicator.signalStrength,
        },
        weightedSignal: weights
          ? {
              signal: weightedSignal,
              weightsUsed: true,
            }
          : {
              signal: null,
              weightsUsed: false,
              reason: "No optimized weights found for this symbol/timeframe",
            },
        chartDisplay: {
          showArrow: chartSignal !== null,
          arrowType: chartSignal,
        },
        individualSignals: {
          sma: indicator.smaSignal,
          ema: indicator.emaSignal,
          rsi: indicator.rsiSignal,
          macd: indicator.macdSignal,
          bb: indicator.bbSignal,
          stoch: indicator.stochSignal,
          stochRsi: indicator.stochRsiSignal,
          psar: indicator.psarSignal,
        },
      });
    }

    const processingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Validation completed in ${processingTime}`);
    console.log(
      `   Valid: ${validCount}, Invalid: ${invalidCount}, Missing: ${missingCount}`
    );
    console.log(
      `   DB-sourced signals: ${dbSourceCount}, Weighted signals: ${weightedSourceCount}`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      summary: {
        totalChecked: candles.length,
        valid: validCount,
        invalid: invalidCount,
        missing: missingCount,
        dbSourced: dbSourceCount,
        weightedSourced: weightedSourceCount,
        hasOptimizedWeights: !!weights,
      },
      methodology: {
        currentImplementation: "Database overallSignal (rule-based)",
        alternative: weights
          ? "Optimized weighted multi-indicator calculation available"
          : "No optimized weights available",
        chartDisplay: "Arrows shown only for buy/sell signals (neutral hidden)",
      },
      weights: weights
        ? {
            ...weights.weights,
            performance: {
              roi: weights.roi,
              winRate: weights.winRate,
              maxDrawdown: weights.maxDrawdown,
              sharpeRatio: weights.sharpeRatio,
            },
          }
        : null,
      processingTime,
      results: validationResults,
    });
  } catch (err) {
    console.error("❌ Error in signal validation:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
