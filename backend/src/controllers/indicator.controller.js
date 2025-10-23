import { prisma } from "../lib/prisma.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

/* ===========================================================
   📊 OPTIMIZED INDICATOR CONTROLLER (Function-Based)
   - Uses pre-calculated signals from database
   - High-performance queries with selective fields
   - Overall signal analysis included
=========================================================== */

/* ===========================================================
   ✅ GET INDICATORS API (High-Performance Optimized)
=========================================================== */
export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const limit = Math.min(10000, parseInt(req.query.limit) || 2000);

    console.log(`📊 Fetching indicators for ${symbol}, limit: ${limit}`);
    const startTime = Date.now();

    // === Check if indicators exist first (faster query) ===
    const indicatorCount = await prisma.indicator.count({
      where: { symbol, timeframe },
    });

    // === If no indicators, calculate them ===
    if (indicatorCount === 0) {
      console.log(`📊 No indicators found for ${symbol}, calculating...`);

      const candleCount = await prisma.candle.count({
        where: { symbol, timeframe },
      });

      if (candleCount === 0) {
        return res.status(400).json({
          success: false,
          message: `No candle data available for ${symbol}.`,
        });
      }

      await calculateAndSaveIndicators(symbol, timeframe);
      console.log(`✅ ${symbol}: Indicators calculated successfully.`);
    }

    // === Fetch data with optimized query (including signals) ===
    const [data, candlePrices] = await Promise.all([
      // Get indicators with signals - all needed fields
      prisma.indicator.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
        select: {
          time: true,
          // Technical indicator values
          sma20: true,
          sma50: true,
          ema20: true,
          ema50: true,
          rsi: true,
          macd: true,
          macdSignalLine: true,
          macdHist: true,
          bbUpper: true,
          bbLower: true,
          stochK: true,
          stochD: true,
          stochRsiK: true,
          stochRsiD: true,
          psar: true,
          // Pre-calculated signals
          smaSignal: true,
          emaSignal: true,
          rsiSignal: true,
          bbSignal: true,
          stochSignal: true,
          stochRsiSignal: true,
          psarSignal: true,
          // Overall analysis
          overallSignal: true,
          signalStrength: true,
        },
      }),
      // Get only close prices for performance
      prisma.candle.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
        select: {
          time: true,
          close: true,
        },
      }),
    ]);

    // === Create price lookup map for O(1) access ===
    const priceMap = new Map();
    for (const candle of candlePrices) {
      // Convert BigInt to Number for map key
      priceMap.set(Number(candle.time), candle.close);
    }

    // === Format response with pre-calculated signals ===
    const organized = data.map((d) => {
      // Convert BigInt to Number for lookup
      const price = priceMap.get(Number(d.time)) ?? null;

      return {
        time: Number(d.time), // Convert BigInt to Number
        price,
        indicators: {
          sma: {
            20: d.sma20,
            50: d.sma50,
            signal: d.smaSignal, // Pre-calculated from database
          },
          ema: {
            20: d.ema20,
            50: d.ema50,
            signal: d.emaSignal, // Pre-calculated from database
          },
          rsi: {
            14: d.rsi,
            signal: d.rsiSignal, // Pre-calculated from database
          },
          macd: {
            fast: 12,
            slow: 26,
            signalPeriod: 9,
            macd: d.macd,
            signalLine: d.macdSignalLine, // Updated field name
            histogram: d.macdHist,
            signal: d.macdSignal, // Pre-calculated trading signal from database
          },
          bollingerBands: {
            period: 20,
            multiplier: 2,
            upper: d.bbUpper,
            lower: d.bbLower,
            signal: d.bbSignal, // Pre-calculated from database
          },
          stochastic: {
            kPeriod: 14,
            dPeriod: 3,
            "%K": d.stochK,
            "%D": d.stochD,
            signal: d.stochSignal, // Pre-calculated from database
          },
          stochasticRsi: {
            rsiPeriod: 14,
            stochPeriod: 14,
            kPeriod: 3,
            dPeriod: 3,
            "%K": d.stochRsiK,
            "%D": d.stochRsiD,
            signal: d.stochRsiSignal, // Pre-calculated from database
          },
          parabolicSar: {
            step: 0.02,
            maxStep: 0.2,
            value: d.psar,
            signal: d.psarSignal, // Pre-calculated from database
          },
        },
        // Overall signal analysis
        overallSignal: d.overallSignal,
        signalStrength: d.signalStrength,
      };
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ ${symbol}: ${organized.length} indicators processed in ${processingTime}ms`
    );

    // === Send optimized response ===
    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: organized.length,
      processingTime: `${processingTime}ms`,
      data: organized,
    });
  } catch (err) {
    console.error("❌ getIndicators error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

/* ===========================================================
   ✅ CALCULATE INDICATORS API (Force Recalculation)
=========================================================== */
export async function calculateIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const force = req.query.force === "true";

    console.log(
      `🔄 ${force ? "Force " : ""}Calculating indicators for ${symbol}...`
    );
    const startTime = Date.now();

    // Delete existing indicators if force recalculation
    if (force) {
      await prisma.indicator.deleteMany({
        where: { symbol, timeframe },
      });
      console.log(`🗑️ Deleted existing indicators for ${symbol}`);
    }

    await calculateAndSaveIndicators(symbol, timeframe);

    const count = await prisma.indicator.count({
      where: { symbol, timeframe },
    });

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ ${symbol}: ${count} indicators calculated in ${processingTime}ms`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      indicatorsCalculated: count,
      processingTime: `${processingTime}ms`,
      message: `Successfully calculated ${count} indicators for ${symbol}`,
    });
  } catch (err) {
    console.error("❌ calculateIndicators error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to calculate indicators",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

/* ===========================================================
   ✅ GET SIGNAL SUMMARY API (New Endpoint)
=========================================================== */
export async function getSignalSummary(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    console.log(`📊 Fetching signal summary for ${symbol}...`);
    const startTime = Date.now();

    // Get latest indicator with signals
    const latestIndicator = await prisma.indicator.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      select: {
        time: true,
        smaSignal: true,
        emaSignal: true,
        rsiSignal: true,
        macdSignal: true,
        bbSignal: true,
        stochSignal: true,
        stochRsiSignal: true,
        psarSignal: true,
        overallSignal: true,
        signalStrength: true,
      },
    });

    if (!latestIndicator) {
      return res.status(404).json({
        success: false,
        message: `No signal data found for ${symbol}`,
      });
    }

    // Count signal distribution from last 100 data points
    const recentSignals = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      take: 100,
      select: {
        overallSignal: true,
        signalStrength: true,
      },
    });

    const signalDistribution = {
      strong_buy: 0,
      buy: 0,
      neutral: 0,
      sell: 0,
      strong_sell: 0,
    };

    recentSignals.forEach((s) => {
      if (
        s.overallSignal &&
        signalDistribution.hasOwnProperty(s.overallSignal)
      ) {
        signalDistribution[s.overallSignal]++;
      }
    });

    const avgSignalStrength =
      recentSignals.reduce((sum, s) => sum + (s.signalStrength || 0), 0) /
      recentSignals.length;

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      symbol,
      timeframe,
      current: {
        timestamp: Number(latestIndicator.time), // Convert BigInt to Number
        signals: {
          sma: latestIndicator.smaSignal,
          ema: latestIndicator.emaSignal,
          rsi: latestIndicator.rsiSignal,
          macd: latestIndicator.macdSignal,
          bollingerBands: latestIndicator.bbSignal,
          stochastic: latestIndicator.stochSignal,
          stochasticRsi: latestIndicator.stochRsiSignal,
          parabolicSar: latestIndicator.psarSignal,
        },
        overall: latestIndicator.overallSignal,
        strength: latestIndicator.signalStrength,
      },
      analysis: {
        signalDistribution,
        averageStrength: Math.round(avgSignalStrength * 100) / 100,
        sampleSize: recentSignals.length,
      },
      processingTime: `${processingTime}ms`,
    });
  } catch (err) {
    console.error("❌ getSignalSummary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get signal summary",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
