import { getChartDataNewest } from "../services/charts/chartdata.service.js";
import {
  getRecentIndicators,
  calculateAndSaveIndicators,
} from "../services/indicators/indicator.service.js";
import { getCoinLiveDetail } from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(5000, parseInt(req.query.limit) || 1000);
    const offset = (page - 1) * pageSize;
    const timeframe = req.query.timeframe || "1h";

    console.log(
      `🔍 Chart Request - Symbol: ${symbol}, Page: ${page}, Offset: ${offset}`
    );

    // Get chart data and live data
    const [chartData, live] = await Promise.all([
      getChartDataNewest(symbol, pageSize, offset),
      getCoinLiveDetail(symbol),
    ]);

    if (!chartData.candles.length) {
      return res.json({
        success: true,
        symbol,
        timeframe,
        total: 0,
        page,
        totalPages: 0,
        pageSize,
        hasNext: false,
        hasPrev: false,
        liveData: live.success ? live.data : null,
        data: [],
      });
    }

    // Get all indicators for symbol
    const allIndicators = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
    });

    console.log(
      `🔍 Found ${allIndicators.length} total indicators for ${symbol}`
    );

    // Check if we need to calculate missing indicators
    const latestCandle = chartData.candles[0]; // First item is newest due to DESC order
    const latestCandleTime = Number(latestCandle.time);

    // Find latest indicator
    const latestIndicator = allIndicators.length > 0 ? allIndicators[0] : null;
    const latestIndicatorTime = latestIndicator
      ? Number(latestIndicator.time)
      : 0;

    // Check if latest candle has indicator (with 30min tolerance)
    const hasLatestIndicator =
      latestIndicator &&
      Math.abs(latestCandleTime - latestIndicatorTime) <= 1800000; // 30 minutes

    console.log(
      `📊 Latest candle: ${new Date(latestCandleTime).toISOString()}`
    );
    console.log(
      `📊 Latest indicator: ${latestIndicator ? new Date(latestIndicatorTime).toISOString() : "NONE"}`
    );
    console.log(`📊 Has latest indicator: ${hasLatestIndicator}`);

    // Merge candles with indicators using exact time matching first, then fuzzy matching
    const merged = chartData.candles.map((candle) => {
      const candleTime = Number(candle.time);

      // First try exact match
      let indicator = allIndicators.find(
        (ind) => Number(ind.time) === candleTime
      );

      // If no exact match, try fuzzy match with ±30 minutes tolerance
      if (!indicator) {
        indicator = allIndicators.find((ind) => {
          const indicatorTime = Number(ind.time);
          const timeDiff = Math.abs(candleTime - indicatorTime);
          return timeDiff <= 1800000; // 30 minutes in milliseconds
        });
      }

      return {
        time: candleTime.toString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        indicators: indicator
          ? {
              sma: {
                20: indicator.sma20,
                50: indicator.sma50,
              },
              ema: {
                20: indicator.ema20,
                50: indicator.ema50,
              },
              rsi: {
                14: indicator.rsi,
              },
              macd: {
                fast: 12,
                slow: 26,
                signal: 9,
                macd: indicator.macd,
                signalLine: indicator.macdSignal,
                histogram: indicator.macdHist,
              },
              bollingerBands: {
                period: 20,
                multiplier: 2,
                upper: indicator.bbUpper,
                lower: indicator.bbLower,
              },
              stochastic: {
                kPeriod: 14,
                dPeriod: 3,
                "%K": indicator.stochK,
                "%D": indicator.stochD,
              },
              stochasticRsi: {
                rsiPeriod: 14,
                stochPeriod: 14,
                kPeriod: 3,
                dPeriod: 3,
                "%K": indicator.stochRsiK,
                "%D": indicator.stochRsiD,
              },
              parabolicSar: {
                step: 0.02,
                maxStep: 0.2,
                value: indicator.psar,
              },
            }
          : null,
      };
    });

    // Check coverage and missing indicators
    const withIndicators = merged.filter((m) => m.indicators !== null).length;
    const coverageRatio = withIndicators / merged.length;
    const missingCount = merged.length - withIndicators;

    console.log(
      `📊 Indicator coverage: ${withIndicators}/${merged.length} (${(coverageRatio * 100).toFixed(1)}%)`
    );
    console.log(`📊 Missing indicators: ${missingCount}`);

    // Trigger calculation if:
    // 1. Coverage is less than 80%, OR
    // 2. Latest candle doesn't have indicator, OR
    // 3. More than 5 candles are missing indicators
    const shouldCalculate =
      coverageRatio < 0.8 || !hasLatestIndicator || missingCount > 5;

    if (shouldCalculate) {
      console.log(
        `📊 Triggering indicator calculation - Coverage: ${(coverageRatio * 100).toFixed(1)}%, Latest: ${hasLatestIndicator}, Missing: ${missingCount}`
      );

      try {
        // Calculate indicators for the symbol
        await calculateAndSaveIndicators(symbol, timeframe);

        // Re-fetch indicators after calculation
        const newIndicators = await prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
        });

        console.log(
          `🔄 Re-fetched ${newIndicators.length} indicators after calculation`
        );

        // Re-merge with new indicators
        for (let i = 0; i < merged.length; i++) {
          if (merged[i].indicators === null) {
            const candleTime = Number(merged[i].time);

            // Try exact match first
            let indicator = newIndicators.find(
              (ind) => Number(ind.time) === candleTime
            );

            // If no exact match, try fuzzy match
            if (!indicator) {
              indicator = newIndicators.find((ind) => {
                const indicatorTime = Number(ind.time);
                const timeDiff = Math.abs(candleTime - indicatorTime);
                return timeDiff <= 1800000; // 30 minutes tolerance
              });
            }

            if (indicator) {
              merged[i].indicators = {
                sma: {
                  20: indicator.sma20,
                  50: indicator.sma50,
                },
                ema: {
                  20: indicator.ema20,
                  50: indicator.ema50,
                },
                rsi: {
                  14: indicator.rsi,
                },
                macd: {
                  fast: 12,
                  slow: 26,
                  signal: 9,
                  macd: indicator.macd,
                  signalLine: indicator.macdSignal,
                  histogram: indicator.macdHist,
                },
                bollingerBands: {
                  period: 20,
                  multiplier: 2,
                  upper: indicator.bbUpper,
                  lower: indicator.bbLower,
                },
                stochastic: {
                  kPeriod: 14,
                  dPeriod: 3,
                  "%K": indicator.stochK,
                  "%D": indicator.stochD,
                },
                stochasticRsi: {
                  rsiPeriod: 14,
                  stochPeriod: 14,
                  kPeriod: 3,
                  dPeriod: 3,
                  "%K": indicator.stochRsiK,
                  "%D": indicator.stochRsiD,
                },
                parabolicSar: {
                  step: 0.02,
                  maxStep: 0.2,
                  value: indicator.psar,
                },
              };
            }
          }
        }

        const finalWithIndicators = merged.filter(
          (m) => m.indicators !== null
        ).length;
        console.log(
          `✅ After recalculation: ${finalWithIndicators}/${merged.length} with indicators`
        );
      } catch (calcError) {
        console.error(`❌ Auto-calculation failed:`, calcError.message);
        // Continue with partial data instead of failing completely
      }
    } else {
      console.log(
        `✅ No calculation needed - Coverage: ${(coverageRatio * 100).toFixed(1)}%, Latest: ${hasLatestIndicator}`
      );
    }

    const totalPages = Math.ceil(chartData.total / pageSize);
    const finalWithIndicators = merged.filter(
      (m) => m.indicators !== null
    ).length;

    console.log(
      `📊 Final result: ${merged.length} candles, ${finalWithIndicators} with indicators`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      pageSize,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      liveData: live.success ? live.data : null,
      data: merged,
      metadata: {
        indicatorCoverage: `${finalWithIndicators}/${merged.length}`,
        coveragePercentage:
          ((finalWithIndicators / merged.length) * 100).toFixed(1) + "%",
        latestCandleTime: new Date(latestCandleTime).toISOString(),
        latestIndicatorTime: latestIndicator
          ? new Date(latestIndicatorTime).toISOString()
          : null,
        calculationTriggered: shouldCalculate,
      },
    });
  } catch (err) {
    console.error(`❌ Chart error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ✅ PERBAIKAN: Simpan indicator dengan timestamp dalam milidetik (konsisten dengan candle)
async function calculateIndicatorsForSpecificCandles(
  symbol,
  timeframe,
  targetCandles
) {
  console.log(
    `📊 Calculating indicators for ${targetCandles.length} specific candles`
  );

  // Ambil SEMUA candle data untuk context (tanpa limit)
  const allCandles = await prisma.candle.findMany({
    where: { symbol, timeframe },
    orderBy: { time: "asc" },
  });

  if (allCandles.length < 26) {
    console.log(`⚠️ Insufficient historical data (${allCandles.length} < 26)`);
    return;
  }

  console.log(`📊 Using ${allCandles.length} total candles for context`);

  const indicators = [];

  // Import fungsi perhitungan
  const {
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateStochastic,
    calculateStochasticRSI,
    calculateParabolicSAR,
  } = await import("../services/indicators/indicator.service.js");

  // Hitung indicator untuk setiap target candle
  for (const targetCandle of targetCandles) {
    // ✅ PERBAIKAN: Pastikan format waktu konsisten dalam milidetik
    const targetTime = Number(targetCandle.time);

    // Cari index candle target dalam dataset lengkap
    const targetIndex = allCandles.findIndex(
      (c) => Number(c.time) === targetTime
    );

    if (targetIndex === -1) {
      console.log(`⚠️ Target candle ${targetTime} not found in dataset`);
      continue;
    }

    // Skip jika tidak ada cukup data historis untuk SMA50
    if (targetIndex < 49) {
      console.log(
        `⏭️ Skip candle ${targetIndex + 1} - insufficient historical data for SMA50`
      );
      continue;
    }

    // Gunakan semua data dari awal sampai target candle
    const historicalData = allCandles.slice(0, targetIndex + 1);
    const closes = historicalData.map((c) => c.close);
    const highs = historicalData.map((c) => c.high);
    const lows = historicalData.map((c) => c.low);

    // ✅ UPDATED: Calculate only SMA 20/50 (removed SMA5)
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);

    // ✅ UPDATED: Calculate EMA 20/50 (removed EMA5)
    // Untuk EMA, cari nilai sebelumnya jika ada
    let prevEma20 = null,
      prevEma50 = null;
    if (targetIndex > 0) {
      const prevTime = Number(allCandles[targetIndex - 1].time);
      const prevIndicator = await prisma.indicator.findFirst({
        where: {
          symbol,
          timeframe,
          time: BigInt(prevTime),
        },
      });
      if (prevIndicator) {
        prevEma20 = prevIndicator.ema20;
        prevEma50 = prevIndicator.ema50;
      }
    }

    const ema20 = calculateEMA(closes, 20, prevEma20);
    const ema50 = calculateEMA(closes, 50, prevEma50);

    // ✅ Calculate other indicators (unchanged)
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes, 12, 26, 9);
    const bb = calculateBollingerBands(closes, 20, 2);
    const stoch = calculateStochastic(highs, lows, closes, 14, 3);
    const stochRsi = calculateStochasticRSI(closes, 14, 14, 3, 3);
    const psar = calculateParabolicSAR(highs, lows, 0.02, 0.2);

    // ✅ UPDATED: Store only SMA 20/50 and EMA 20/50
    indicators.push({
      symbol,
      timeframe,
      time: BigInt(targetTime),
      sma20, // ✅ SMA 20
      sma50, // ✅ SMA 50
      ema20, // ✅ EMA 20
      ema50, // ✅ EMA 50
      rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHist: macd.histogram,
      bbUpper: bb.upper,
      bbLower: bb.lower,
      stochK: stoch.k,
      stochD: stoch.d,
      stochRsiK: stochRsi.k,
      stochRsiD: stochRsi.d,
      psar,
    });

    if (indicators.length % 50 === 0) {
      console.log(
        `📊 Processed ${indicators.length}/${targetCandles.length} indicators...`
      );
    }
  }

  // Simpan ke database
  if (indicators.length > 0) {
    await prisma.indicator.createMany({
      data: indicators,
      skipDuplicates: true,
    });

    console.log(`✅ Saved ${indicators.length} indicators to database`);
  }
}
