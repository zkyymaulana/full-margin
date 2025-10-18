import { prisma } from "../lib/prisma.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js"; // ✅ Import indicator service

// ✅ UPDATED: Signal analysis functions for MA 20/50 academic structure

/**
 * ✅ SMA Signal Analysis (Romo et al. 2025)
 * Analyzes SMA 20/50 crossover for trend detection
 */
function analyzeSMA(sma20, sma50, currentPrice) {
  if (!sma20 || !sma50 || !currentPrice) return "neutral";

  // Dual SMA strategy (Romo et al. 2025)
  // SMA20 > SMA50 and price above both = strong bullish
  if (currentPrice > sma20 && currentPrice > sma50 && sma20 > sma50)
    return "buy";
  // SMA20 < SMA50 and price below both = strong bearish
  if (currentPrice < sma20 && currentPrice < sma50 && sma20 < sma50)
    return "sell";

  // Weak signals
  if (sma20 > sma50) return "weak_buy";
  if (sma20 < sma50) return "weak_sell";

  return "neutral";
}

/**
 * ✅ EMA Signal Analysis (Momentum confirmation)
 * Analyzes EMA 20/50 crossover for momentum detection
 */
function analyzeEMA(ema20, ema50, currentPrice) {
  if (!ema20 || !ema50 || !currentPrice) return "neutral";

  // EMA crossover for momentum confirmation
  // EMA20 > EMA50 and price above both = bullish momentum
  if (currentPrice > ema20 && currentPrice > ema50 && ema20 > ema50)
    return "buy";
  // EMA20 < EMA50 and price below both = bearish momentum
  if (currentPrice < ema20 && currentPrice < ema50 && ema20 < ema50)
    return "sell";

  // Weak momentum signals
  if (ema20 > ema50) return "weak_buy";
  if (ema20 < ema50) return "weak_sell";

  return "neutral";
}

/**
 * ✅ RSI Signal Analysis (Zatwarnicki et al. 2023)
 */
function analyzeRSI(rsi) {
  if (!rsi) return "neutral";

  if (rsi > 70) return "sell"; // Overbought
  if (rsi < 30) return "buy"; // Oversold
  if (rsi > 60) return "weak_sell"; // Approaching overbought
  if (rsi < 40) return "weak_buy"; // Approaching oversold

  return "neutral";
}

function analyzeStochastic(k, d) {
  if (!k || !d) return "neutral";

  // Overbought/Oversold levels
  if (k > 80 && d > 80) return "sell";
  if (k < 20 && d < 20) return "buy";

  // Crossover signals
  if (k > d && k < 80) return "buy"; // Bullish crossover
  if (k < d && k > 20) return "sell"; // Bearish crossover

  return "neutral";
}

function analyzeStochasticRSI(k, d) {
  if (!k || !d) return "neutral";

  // More sensitive than regular stochastic
  if (k > 80 && d > 80) return "sell";
  if (k < 20 && d < 20) return "buy";

  return "neutral";
}

/**
 * ✅ MACD Signal Analysis (Sukma & Namahoot 2025)
 */
function analyzeMACD(macd, signal, histogram) {
  if (!macd || !signal || histogram === null) return "neutral";

  // Strong signals with histogram confirmation
  if (macd > signal && histogram > 0) return "buy";
  if (macd < signal && histogram < 0) return "sell";

  // Weak signals without histogram confirmation
  if (macd > signal) return "weak_buy";
  if (macd < signal) return "weak_sell";

  return "neutral";
}

function analyzeBollingerBands(currentPrice, upper, lower) {
  if (!currentPrice || !upper || !lower) return "neutral";

  const bandWidth = upper - lower;
  const middleBand = (upper + lower) / 2;

  // Price near upper band = potential sell
  if (currentPrice > upper - bandWidth * 0.1) return "sell";
  // Price near lower band = potential buy
  if (currentPrice < lower + bandWidth * 0.1) return "buy";

  return "neutral";
}

function analyzeParabolicSAR(currentPrice, psar) {
  if (!currentPrice || !psar) return "neutral";

  // Price above SAR = bullish trend
  if (currentPrice > psar) return "buy";
  // Price below SAR = bearish trend
  if (currentPrice < psar) return "sell";

  return "neutral";
}

export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const limit = Math.min(10000, parseInt(req.query.limit) || 2000);

    // ✅ Check for indicator data, calculate automatically if missing
    let data = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      take: limit,
    });

    // If indicator data is empty or insufficient, calculate automatically
    if (data.length === 0) {
      console.log(`📊 Indicator ${symbol} kosong, menghitung otomatis...`);

      // Check if candle data exists
      const candleCount = await prisma.candle.count({
        where: { symbol, timeframe },
      });

      if (candleCount === 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak ada candle data untuk ${symbol}. Pastikan data candle sudah tersedia melalui scheduler.`,
        });
      }

      try {
        // Calculate indicators automatically
        await calculateAndSaveIndicators(symbol, timeframe, "full");

        // Fetch newly calculated indicator data
        data = await prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
          take: limit,
        });

        console.log(
          `✅ ${symbol}: ${data.length} indicator berhasil dihitung otomatis`
        );
      } catch (calcError) {
        console.error(
          `❌ Gagal menghitung indicator ${symbol}:`,
          calcError.message
        );
        return res.status(500).json({
          success: false,
          message: `Gagal menghitung indicator: ${calcError.message}`,
        });
      }
    }

    // Get corresponding candle data for current price analysis
    const candleData = await prisma.candle.findMany({
      where: {
        symbol,
        timeframe,
        time: { in: data.map((d) => d.time) },
      },
      orderBy: { time: "desc" },
    });

    // Create a map for quick candle lookup
    const candleMap = new Map(
      candleData.map((c) => [c.time.toString(), c.close])
    );

    // ✅ REFACTORED: Transform data to academic structure (Romo et al. 2025 & Sukma & Namahoot 2025)
    const organizedData = data.map((item) => {
      const currentPrice = candleMap.get(item.time.toString()) || null;

      return {
        time: Number(item.time),

        // ✅ SMA Group (Romo et al. 2025) - Independent from EMA
        sma: {
          20: item.sma20,
          50: item.sma50,
          signal: analyzeSMA(item.sma20, item.sma50, currentPrice),
          crossover:
            item.sma20 && item.sma50
              ? item.sma20 > item.sma50
                ? "bullish"
                : "bearish"
              : null,
        },

        // ✅ EMA Group (Momentum confirmation) - Independent from SMA
        ema: {
          20: item.ema20,
          50: item.ema50,
          signal: analyzeEMA(item.ema20, item.ema50, currentPrice),
          crossover:
            item.ema20 && item.ema50
              ? item.ema20 > item.ema50
                ? "bullish"
                : "bearish"
              : null,
        },

        // ✅ RSI Group (Zatwarnicki et al. 2023)
        rsi: {
          14: item.rsi,
          signal: analyzeRSI(item.rsi),
          level: item.rsi
            ? item.rsi > 70
              ? "overbought"
              : item.rsi < 30
                ? "oversold"
                : "neutral"
            : null,
        },

        // ✅ MACD Group (Sukma & Namahoot 2025)
        macd: {
          fast: 12,
          slow: 26,
          signal: 9,
          macd: item.macd,
          signalLine: item.macdSignal,
          histogram: item.macdHist,
          tradeSignal: analyzeMACD(item.macd, item.macdSignal, item.macdHist),
          crossover:
            item.macd && item.macdSignal
              ? item.macd > item.macdSignal
                ? "bullish"
                : "bearish"
              : null,
        },

        // ✅ Bollinger Bands Group
        bollingerBands: {
          period: 20,
          multiplier: 2,
          upper: item.bbUpper,
          lower: item.bbLower,
          signal: analyzeBollingerBands(
            currentPrice,
            item.bbUpper,
            item.bbLower
          ),
          position:
            currentPrice && item.bbUpper && item.bbLower
              ? (
                  ((currentPrice - item.bbLower) /
                    (item.bbUpper - item.bbLower)) *
                  100
                ).toFixed(1) + "%"
              : null,
        },

        // ✅ Stochastic Group
        stochastic: {
          kPeriod: 14,
          dPeriod: 3,
          "%K": item.stochK,
          "%D": item.stochD,
          signal: analyzeStochastic(item.stochK, item.stochD),
          level: item.stochK
            ? item.stochK > 80
              ? "overbought"
              : item.stochK < 20
                ? "oversold"
                : "neutral"
            : null,
        },

        // ✅ Stochastic RSI Group
        stochasticRsi: {
          rsiPeriod: 14,
          stochPeriod: 14,
          kPeriod: 3,
          dPeriod: 3,
          "%K": item.stochRsiK,
          "%D": item.stochRsiD,
          signal: analyzeStochasticRSI(item.stochRsiK, item.stochRsiD),
          level: item.stochRsiK
            ? item.stochRsiK > 80
              ? "overbought"
              : item.stochRsiK < 20
                ? "oversold"
                : "neutral"
            : null,
        },

        // ✅ Parabolic SAR Group
        parabolicSar: {
          step: 0.02,
          maxStep: 0.2,
          value: item.psar,
          signal: analyzeParabolicSAR(currentPrice, item.psar),
          trend:
            currentPrice && item.psar
              ? currentPrice > item.psar
                ? "uptrend"
                : "downtrend"
              : null,
        },

        // ✅ Additional metadata for academic analysis
        currentPrice: currentPrice,
        timestamp: new Date(Number(item.time)).toISOString(),
      };
    });

    // ✅ Enhanced response with academic metadata
    res.json({
      success: true,
      symbol,
      timeframe,
      total: organizedData.length,
      data: organizedData,
      // ✅ Academic metadata
      methodology: {
        references: [
          "Romo et al. (2025): Dual Moving Average Strategy",
          "Sukma & Namahoot (2025): Multi-Indicator Analysis",
          "Zatwarnicki et al. (2023): RSI Effectiveness in Crypto",
        ],
        indicators: {
          sma: "Simple Moving Average (20, 50) - Trend identification",
          ema: "Exponential Moving Average (20, 50) - Momentum confirmation",
          rsi: "Relative Strength Index (14) - Overbought/Oversold detection",
          macd: "MACD (12,26,9) - Momentum and trend convergence",
          bollingerBands: "Bollinger Bands (20,2) - Volatility analysis",
          stochastic: "Stochastic Oscillator (14,3) - Momentum reversal",
          stochasticRsi: "Stochastic RSI (14,14,3,3) - Enhanced sensitivity",
          parabolicSar: "Parabolic SAR (0.02,0.2) - Trend following",
        },
      },
    });
  } catch (err) {
    console.error(`❌ getIndicators error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
