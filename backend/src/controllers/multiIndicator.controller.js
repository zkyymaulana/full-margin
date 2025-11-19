import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";
import { backtestWithWeights } from "../services/multiIndicator/multiIndicator-backtest.service.js";

/* --- Optimize --- */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();
    const startEpoch = Date.parse("2020-01-01T00:00:00Z");
    const endEpoch = Date.parse("2025-01-01T00:00:00Z");

    console.log(
      `\n📊 Starting Full Exhaustive Search Optimization for ${symbol} (${timeframe})`
    );
    const startQuery = Date.now();

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(startEpoch), lte: BigInt(endEpoch) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(startEpoch), lte: BigInt(endEpoch) },
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

    // Save to database (tanpa executionTimeSeconds karena tidak ada di schema)
    await prisma.indicatorWeight.upsert({
      where: {
        symbol_timeframe_startTrain_endTrain: {
          symbol,
          timeframe,
          startTrain: BigInt(startEpoch),
          endTrain: BigInt(endEpoch),
        },
      },
      update: {
        roi: result.performance.roi,
        winRate: result.performance.winRate,
        maxDrawdown: result.performance.maxDrawdown,
        trades: result.performance.trades,
        candleCount: data.length,
        weights: result.bestWeights,
      },
      create: {
        symbol,
        timeframe,
        startTrain: BigInt(startEpoch),
        endTrain: BigInt(endEpoch),
        roi: result.performance.roi,
        winRate: result.performance.winRate,
        maxDrawdown: result.performance.maxDrawdown,
        trades: result.performance.trades,
        candleCount: data.length,
        weights: result.bestWeights,
      },
    });

    const totalProcessingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Optimization saved to database`);
    console.log(`   Total processing time: ${totalProcessingTime}`);

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: data.length,
      range,
      dataset,
      methodology: result.methodology,
      bestWeights: result.bestWeights,
      performance: result.performance,
      totalCombinationsTested: result.totalCombinationsTested,
      optimizationTimeSeconds: result.executionTimeSeconds, // dari service
      totalProcessingTime, // termasuk DB query & save
      timestamp: new Date().toISOString(),
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
    let skippedCount = 0;
    let failedCount = 0;

    console.log(
      `\n🚀 Starting mass optimization for ${coins.length} top coins...\n`
    );

    // Proses setiap coin secara sequential (satu per satu)
    for (const [index, coin] of coins.entries()) {
      const symbol = coin.symbol.toUpperCase();
      const progress = `[${index + 1}/${coins.length}]`;

      try {
        // 1️⃣ Ambil data candle dan indikator terlebih dahulu
        const [indicators, candles] = await Promise.all([
          prisma.indicator.findMany({
            where: { symbol, timeframe },
            orderBy: { time: "asc" },
          }),
          prisma.candle.findMany({
            where: { symbol, timeframe },
            orderBy: { time: "asc" },
            select: { time: true, close: true },
          }),
        ]);

        // 2️⃣ Validasi data candle
        if (!candles.length) {
          console.warn(`${progress} ⚠️ Data candle kosong untuk ${symbol}`);
          results.push({
            symbol,
            success: false,
            message: "Data candle kosong",
          });
          failedCount++;
          continue;
        }

        // 3️⃣ Gabungkan indikator + harga berdasarkan timestamp
        const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
        const data = indicators
          .filter((i) => map.has(i.time.toString()))
          .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

        // 4️⃣ Validasi data gabungan (minimal 100 data points)
        if (!data.length || data.length < 100) {
          console.warn(
            `${progress} ⚠️ Data tidak cukup untuk ${symbol} (${data.length}/100 minimum)`
          );
          results.push({
            symbol,
            success: false,
            message: `Data tidak cukup untuk optimasi (${data.length}/100 minimum)`,
          });
          failedCount++;
          continue;
        }

        // 5️⃣ Dapatkan timestamp data yang sebenarnya
        const actualStart = data[0]?.time;
        const actualEnd = data[data.length - 1]?.time;

        // 6️⃣ CEK DATABASE: apakah sudah ada hasil optimasi untuk range data ini?
        const existingWeight = await prisma.indicatorWeight.findFirst({
          where: {
            symbol,
            timeframe,
            startTrain: actualStart,
            endTrain: actualEnd,
          },
        });

        if (existingWeight) {
          console.log(
            `${progress} ⏩ Melewati ${symbol}, hasil optimasi sudah ada di database`
          );
          results.push({
            symbol,
            success: true,
            skipped: true,
            message: "Sudah dioptimasi sebelumnya",
            roi: existingWeight.roi,
            winRate: existingWeight.winRate,
          });
          skippedCount++;
          continue;
        }

        // 7️⃣ Jika belum ada, jalankan optimasi
        console.log(`${progress} 📊 Optimizing ${symbol}...`);

        // Format tanggal untuk logging
        const formatDate = (t) =>
          new Intl.DateTimeFormat("id-ID", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
          }).format(new Date(Number(t)));

        // 8️⃣ Jalankan Full Exhaustive Search Optimization
        const result = await optimizeIndicatorWeights(data, symbol);

        // 9️⃣ Simpan hasil ke database
        await prisma.indicatorWeight.upsert({
          where: {
            symbol_timeframe_startTrain_endTrain: {
              symbol,
              timeframe,
              startTrain: actualStart,
              endTrain: actualEnd,
            },
          },
          update: {
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            trades: result.performance.trades,
            candleCount: data.length,
            weights: result.bestWeights,
          },
          create: {
            symbol,
            timeframe,
            startTrain: actualStart,
            endTrain: actualEnd,
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            trades: result.performance.trades,
            candleCount: data.length,
            weights: result.bestWeights,
          },
        });

        // 🔟 Tambahkan ke hasil dan log sukses
        results.push({
          symbol,
          success: true,
          skipped: false,
          timeframe,
          dataPoints: data.length,
          range: {
            start: formatDate(actualStart),
            end: formatDate(actualEnd),
          },
          performance: result.performance,
          optimizationTimeSeconds: result.executionTimeSeconds,
        });

        successCount++;
        console.log(
          `${progress} ✅ ${symbol} selesai → ROI: ${result.performance.roi.toFixed(2)}% | WinRate: ${result.performance.winRate.toFixed(2)}%`
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

    // 🔟 Kembalikan summary hasil ke client
    const summaryMessage = `Optimasi selesai (${successCount} berhasil / ${skippedCount} dilewati / ${failedCount} gagal)`;

    console.log(`\n✅ ${summaryMessage}`);

    res.json({
      success: true,
      message: summaryMessage,
      count: coins.length,
      successCount,
      skippedCount,
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

    const latest = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
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
          time: { gte: latest.startTrain, lte: latest.endTrain },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: latest.startTrain, lte: latest.endTrain },
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
      methodology: "Optimized-Weight Multi-Indicator Backtest (PSO)",
      weights: latest.weights,
      performance: {
        roi: result.roi,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        trades: result.trades,
        wins: result.wins || Math.round(result.trades * (result.winRate / 100)),
        finalCapital: result.finalCapital,
        sharpeRatio: result.sharpeRatio || null,
        sortinoRatio: result.sortinoRatio || null,
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

    // Filter rentang waktu 2020-2025
    const startTime = new Date("2020-01-01T00:00:00Z").getTime();
    const endTime = new Date("2025-01-01T00:00:00Z").getTime();

    const startQuery = Date.now();

    // Ambil data historis dengan filter waktu
    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: {
            gte: startTime,
            lte: endTime,
          },
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
    const backtestStart = Date.now();
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
        wins: result.wins || Math.round(result.trades * (result.winRate / 100)),
        finalCapital: result.finalCapital,
        sharpeRatio: result.sharpeRatio || null,
        sortinoRatio: result.sortinoRatio || null,
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

    // Ambil bobot hasil optimasi BTC-USD
    const btcWeights = await prisma.indicatorWeight.findFirst({
      where: { symbol: "BTC-USD", timeframe },
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

    for (const coin of coins) {
      const symbol = coin.symbol.toUpperCase();

      const [indicators, candles] = await Promise.all([
        prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "asc" },
        }),
        prisma.candle.findMany({
          where: { symbol, timeframe },
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
