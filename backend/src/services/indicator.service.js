import { prisma } from "../lib/prisma.js";

// Get the latest indicator data for a symbol
export async function getLastIndicator(symbol, timeframe = "1h") {
  try {
    const indicator = await prisma.indicator.findFirst({
      where: {
        symbol,
        timeframe,
      },
      orderBy: {
        time: "desc",
      },
    });
    return indicator;
  } catch (error) {
    console.error("Error getting last indicator:", error);
    throw error;
  }
}

// Save indicator data (upsert to handle duplicates)
export async function saveIndicator(symbol, indicatorData, timeframe = "1h") {
  try {
    const indicator = await prisma.indicator.upsert({
      where: {
        symbol_timeframe_time: {
          symbol,
          timeframe,
          time: indicatorData.time,
        },
      },
      update: {
        sma20: indicatorData.sma20,
        ema20: indicatorData.ema20,
        rsi: indicatorData.rsi,
        macd: indicatorData.macd,
        macdSignal: indicatorData.macdSignal,
        macdHist: indicatorData.macdHist,
        bbUpper: indicatorData.bbUpper,
        bbLower: indicatorData.bbLower,
        stochK: indicatorData.stochK,
        stochD: indicatorData.stochD,
        stochRsiK: indicatorData.stochRsiK,
        stochRsiD: indicatorData.stochRsiD,
        psar: indicatorData.psar,
        updatedAt: new Date(),
      },
      create: {
        symbol,
        timeframe,
        time: indicatorData.time,
        sma20: indicatorData.sma20,
        ema20: indicatorData.ema20,
        rsi: indicatorData.rsi,
        macd: indicatorData.macd,
        macdSignal: indicatorData.macdSignal,
        macdHist: indicatorData.macdHist,
        bbUpper: indicatorData.bbUpper,
        bbLower: indicatorData.bbLower,
        stochK: indicatorData.stochK,
        stochD: indicatorData.stochD,
        stochRsiK: indicatorData.stochRsiK,
        stochRsiD: indicatorData.stochRsiD,
        psar: indicatorData.psar,
      },
    });
    return indicator;
  } catch (error) {
    console.error("Error saving indicator:", error);
    throw error;
  }
}

// Get recent indicators for a symbol (for historical analysis)
export async function getRecentIndicators(
  symbol,
  limit = 50,
  timeframe = "1h"
) {
  try {
    const indicators = await prisma.indicator.findMany({
      where: {
        symbol,
        timeframe,
      },
      orderBy: {
        time: "desc",
      },
      take: limit,
    });
    return indicators;
  } catch (error) {
    console.error("Error getting recent indicators:", error);
    throw error;
  }
}

// Get indicators for multiple symbols
export async function getIndicatorsForSymbols(symbols, timeframe = "1h") {
  try {
    const indicators = await prisma.indicator.findMany({
      where: {
        symbol: {
          in: symbols,
        },
        timeframe,
      },
      orderBy: [{ symbol: "asc" }, { time: "desc" }],
    });

    // Group by symbol and return latest for each
    const grouped = indicators.reduce((acc, indicator) => {
      if (!acc[indicator.symbol]) {
        acc[indicator.symbol] = indicator;
      }
      return acc;
    }, {});

    return grouped;
  } catch (error) {
    console.error("Error getting indicators for symbols:", error);
    throw error;
  }
}
