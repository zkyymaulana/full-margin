import { prisma } from "../lib/prisma.js";
import { analyzeMultiIndicator } from "../services/signals/signal-analyzer.service.js";

export async function getSignals(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const strategy = req.query.strategy || "multi";
    const limit = Math.min(2000, parseInt(req.query.limit) || 500);

    // ✅ Enhanced query to include candle data for close price
    const indicators = await prisma.indicator.findMany({
      where: { symbol },
      orderBy: { time: "desc" },
      take: limit,
      include: {
        // We need to get close price from candle data
        // Since there's no direct relation, we'll fetch candles separately
      },
    });

    if (indicators.length === 0) {
      return res.json({
        success: true,
        symbol,
        strategy,
        total: 0,
        data: [],
      });
    }

    // ✅ Get corresponding candle data for close prices
    const indicatorTimes = indicators.map((i) => i.time);
    const candles = await prisma.candle.findMany({
      where: {
        symbol,
        time: { in: indicatorTimes },
      },
      select: {
        time: true,
        close: true,
      },
    });

    // Create a map for quick close price lookup
    const closePriceMap = new Map();
    candles.forEach((candle) => {
      closePriceMap.set(candle.time.toString(), candle.close);
    });

    // ✅ UPDATED: Academic-aligned weights for MA 20/50 strategy
    const academicWeights = {
      rsi: 0.2, // Zatwarnicki et al. (2023) - RSI effectiveness in crypto
      macd: 0.2, // Sukma & Namahoot (2025) - momentum analysis
      dualMA: 0.2, // Romo et al. (2025) - dual SMA moving average strategy
      emaSignal: 0.15, // EMA momentum confirmation
      volatility: 0.25, // Combined volatility indicators
    };

    // ✅ ENHANCED: Generate signals with close price and updated academic weights
    const signals = indicators.map((i) => {
      const closePrice = closePriceMap.get(i.time.toString());

      // Add close price to indicator data for signal analysis
      const enhancedIndicator = {
        ...i,
        close: closePrice,
      };

      // Use the new academic-aligned signal analysis
      const signal = analyzeMultiIndicator(enhancedIndicator, academicWeights);

      return {
        time: Number(i.time).toString(),
        signal: signal,
        // ✅ UPDATED: Add detailed breakdown including EMA 20/50
        details:
          strategy === "research"
            ? {
                rsi: i.rsi,
                macd: i.macd,
                macdSignal: i.macdSignal,
                sma20: i.sma20, // ✅ SMA 20
                sma50: i.sma50, // ✅ SMA 50
                ema20: i.ema20, // ✅ EMA 20
                ema50: i.ema50, // ✅ EMA 50
                bbUpper: i.bbUpper,
                bbLower: i.bbLower,
                stochK: i.stochK,
                stochD: i.stochD,
                psar: i.psar,
                close: closePrice,
              }
            : undefined,
      };
    });

    // ✅ Response format aligned with academic expectations
    res.json({
      success: true,
      symbol,
      strategy,
      timeframe: "1h", // ✅ Add timeframe as per journal standards
      total: signals.length,
      data: signals,
      // ✅ UPDATED: Add metadata including EMA indicators
      metadata:
        strategy === "research"
          ? {
              weights: academicWeights,
              references: [
                "Sukma & Namahoot (2025): Multi-Indicator Analysis for Profitable Algorithmic Trading",
                "Romo et al. (2025): Dual Moving Average Strategy for Automated Cryptocurrency Trading",
                "Zatwarnicki et al. (2023): Effectiveness of RSI in Timing the Cryptocurrency Market",
              ],
              indicators: {
                rsi: "RSI(14) - Relative Strength Index",
                macd: "MACD(12,26,9) - Moving Average Convergence Divergence",
                sma20: "SMA(20) - Simple Moving Average 20", // ✅ Updated
                sma50: "SMA(50) - Simple Moving Average 50", // ✅ Updated
                ema20: "EMA(20) - Exponential Moving Average 20", // ✅ Added
                ema50: "EMA(50) - Exponential Moving Average 50", // ✅ Added
                bb: "BB(20,2) - Bollinger Bands",
                stoch: "Stoch(14,3) - Stochastic Oscillator",
                psar: "PSAR(0.02,0.2) - Parabolic SAR",
              },
            }
          : undefined,
    });
  } catch (err) {
    console.error(`❌ getSignals error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
