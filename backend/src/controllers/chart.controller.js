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
    const pageSize = Math.min(5000, parseInt(req.query.limit) || 1000); // ✅ Increase default limit
    const offset = (page - 1) * pageSize;
    const timeframe = req.query.timeframe || "1h";

    console.log(
      `🔍 Chart Request - Symbol: ${symbol}, Page: ${page}, Offset: ${offset}`
    );

    // ✅ PERBAIKAN: Ubah order ke DESC untuk data terbaru dulu
    const [chartData, live] = await Promise.all([
      getChartDataNewest(symbol, pageSize, offset), // Gunakan fungsi baru untuk newest first
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

    // ✅ PERBAIKAN: Ambil semua indicator yang tersedia untuk symbol
    const allIndicators = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
    });

    console.log(
      `🔍 Found ${allIndicators.length} total indicators for ${symbol}`
    );

    // ✅ PERBAIKAN: Gunakan toleransi waktu 1 jam (3600000 milidetik) untuk matching
    const merged = chartData.candles.map((candle) => {
      const candleTime = Number(candle.time);

      // Cari indicator dengan toleransi ±1 jam dalam milidetik
      const indicator = allIndicators.find((ind) => {
        const indicatorTime = Number(ind.time);
        const timeDiff = Math.abs(candleTime - indicatorTime);
        return timeDiff < 3600000; // ✅ Toleransi 1 jam dalam milidetik
      });

      return {
        time: candleTime.toString(), // ✅ Convert ke string untuk response
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        // ✅ REFACTORED: Academic structure (Romo et al. 2025 & Sukma & Namahoot 2025)
        indicators: indicator
          ? {
              // ✅ SMA Group (Romo et al. 2025) - Independent from EMA
              sma: {
                20: indicator.sma20,
                50: indicator.sma50,
              },

              // ✅ EMA Group (Momentum confirmation) - Independent from SMA
              ema: {
                20: indicator.ema20,
                50: indicator.ema50,
              },

              // ✅ RSI Group (Zatwarnicki et al. 2023)
              rsi: {
                14: indicator.rsi,
              },

              // ✅ MACD Group (Sukma & Namahoot 2025)
              macd: {
                fast: 12,
                slow: 26,
                signal: 9,
                macd: indicator.macd,
                signalLine: indicator.macdSignal,
                histogram: indicator.macdHist,
              },

              // ✅ Bollinger Bands Group
              bollingerBands: {
                period: 20,
                multiplier: 2,
                upper: indicator.bbUpper,
                lower: indicator.bbLower,
              },

              // ✅ Stochastic Group
              stochastic: {
                kPeriod: 14,
                dPeriod: 3,
                "%K": indicator.stochK,
                "%D": indicator.stochD,
              },

              // ✅ Stochastic RSI Group
              stochasticRsi: {
                rsiPeriod: 14,
                stochPeriod: 14,
                kPeriod: 3,
                dPeriod: 3,
                "%K": indicator.stochRsiK,
                "%D": indicator.stochRsiD,
              },

              // ✅ Parabolic SAR Group
              parabolicSar: {
                step: 0.02,
                maxStep: 0.2,
                value: indicator.psar,
              },
            }
          : null,
      };
    });

    // ✅ Jika masih banyak yang null, hitung indicator untuk range yang diminta
    const withIndicators = merged.filter((m) => m.indicators !== null).length;
    const coverageRatio = withIndicators / merged.length;

    if (coverageRatio < 0.5) {
      console.log(
        `📊 Coverage rendah (${(coverageRatio * 100).toFixed(1)}%), menghitung indicator...`
      );

      try {
        await calculateIndicatorsForSpecificCandles(
          symbol,
          timeframe,
          chartData.candles
        );

        // Re-fetch indicators dan re-merge
        const newIndicators = await prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
        });

        // Re-merge dengan data baru
        for (let i = 0; i < merged.length; i++) {
          if (merged[i].indicators === null) {
            const candleTime = Number(merged[i].time);
            const indicator = newIndicators.find((ind) => {
              const indicatorTime = Number(ind.time);
              const timeDiff = Math.abs(candleTime - indicatorTime);
              return timeDiff < 3600000; // ✅ Toleransi 1 jam dalam milidetik
            });

            if (indicator) {
              merged[i].indicators = {
                // ✅ SMA Group (Romo et al. 2025) - Independent from EMA
                sma: {
                  20: indicator.sma20,
                  50: indicator.sma50,
                },

                // ✅ EMA Group (Momentum confirmation) - Independent from SMA
                ema: {
                  20: indicator.ema20,
                  50: indicator.ema50,
                },

                // ✅ RSI Group (Zatwarnicki et al. 2023)
                rsi: {
                  14: indicator.rsi,
                },

                // ✅ MACD Group (Sukma & Namahoot 2025)
                macd: {
                  fast: 12,
                  slow: 26,
                  signal: 9,
                  macd: indicator.macd,
                  signalLine: indicator.macdSignal,
                  histogram: indicator.macdHist,
                },

                // ✅ Bollinger Bands Group
                bollingerBands: {
                  period: 20,
                  multiplier: 2,
                  upper: indicator.bbUpper,
                  lower: indicator.bbLower,
                },

                // ✅ Stochastic Group
                stochastic: {
                  kPeriod: 14,
                  dPeriod: 3,
                  "%K": indicator.stochK,
                  "%D": indicator.stochD,
                },

                // ✅ Stochastic RSI Group
                stochasticRsi: {
                  rsiPeriod: 14,
                  stochPeriod: 14,
                  kPeriod: 3,
                  dPeriod: 3,
                  "%K": indicator.stochRsiK,
                  "%D": indicator.stochRsiD,
                },

                // ✅ Parabolic SAR Group
                parabolicSar: {
                  step: 0.02,
                  maxStep: 0.2,
                  value: indicator.psar,
                },
              };
            }
          }
        }

        console.log(
          `✅ After recalculation: ${merged.filter((m) => m.indicators !== null).length}/${merged.length} dengan indicator`
        );
      } catch (calcError) {
        console.error(`❌ Calculation error:`, calcError.message);
      }
    }

    const totalPages = Math.ceil(chartData.total / pageSize);

    // ✅ Log hasil akhir
    const finalWithIndicators = merged.filter(
      (m) => m.indicators !== null
    ).length;
    const validData = merged.filter(
      (m) => m.indicators && Object.values(m.indicators).some((v) => v !== null)
    ).length;

    console.log(
      `📊 Final result: ${merged.length} candles, ${finalWithIndicators} with indicators, ${validData} with valid data`
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
      data: merged, // ✅ Data sudah dalam urutan terbaru dulu
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
