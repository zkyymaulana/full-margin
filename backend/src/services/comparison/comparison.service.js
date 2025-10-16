import { prisma } from "../../lib/prisma.js";
import { analyzeMultiIndicator } from "../signals/signal-analyzer.service.js";

// Helper function to convert date string to BigInt timestamp
function convertDateToBigInt(dateString) {
  try {
    // Handle different date formats
    let timestamp;

    if (dateString.includes("-") && dateString.length === 10) {
      // Format: "2024-01-01" -> convert to timestamp
      timestamp = new Date(dateString + "T00:00:00.000Z").getTime();
    } else if (dateString.includes("-") && dateString.includes("T")) {
      // Format: "2024-01-01T00:00:00.000Z" -> convert to timestamp
      timestamp = new Date(dateString).getTime();
    } else {
      // Assume it's already a timestamp string
      timestamp = parseInt(dateString);
    }

    // Convert milliseconds to microseconds (add 3 zeros)
    return BigInt(timestamp * 1000);
  } catch (error) {
    throw new Error(
      `Invalid date format: ${dateString}. Expected format: YYYY-MM-DD or timestamp`
    );
  }
}

// Calculate backtesting results for a given strategy
function calculateBacktest(signals, candleMap, data) {
  let balance = 10000; // Starting balance
  let position = 0; // 0 = no position, 1 = long position
  let trades = 0;
  let wins = 0;
  let buyPrice = 0;

  for (let i = 1; i < signals.length; i++) {
    const signal = signals[i];
    const price = candleMap.get(data[i].time.toString());

    if (!price) continue;

    // Buy signal
    if (signal === "BUY" && position === 0) {
      position = 1;
      buyPrice = price;
      trades++;
    }
    // Sell signal
    else if (signal === "SELL" && position === 1) {
      const profit = price - buyPrice;
      if (profit > 0) wins++;
      balance += profit;
      position = 0;
    }
  }

  const roi = (((balance - 10000) / 10000) * 100).toFixed(2);
  const winRate = trades > 0 ? ((wins / trades) * 100).toFixed(2) : "0.00";

  return {
    roi: parseFloat(roi),
    winRate: parseFloat(winRate),
    trades,
  };
}

// Generate signals for a specific indicator
function generateSingleIndicatorSignals(data, candleMap, indicator) {
  return data.map((item) => {
    switch (indicator) {
      case "RSI":
        if (item.rsi < 30) return "BUY";
        if (item.rsi > 70) return "SELL";
        return "HOLD";

      case "MACD":
        if (item.macd > item.macdSignal && item.macdHist > 0) return "BUY";
        if (item.macd < item.macdSignal && item.macdHist < 0) return "SELL";
        return "HOLD";

      case "Stochastic":
        if (item.stochK < 20 && item.stochD < 20) return "BUY";
        if (item.stochK > 80 && item.stochD > 80) return "SELL";
        return "HOLD";

      case "EMA":
        const price = candleMap.get(item.time.toString());
        if (price && price > item.ema20) return "BUY";
        if (price && price < item.ema20) return "SELL";
        return "HOLD";

      case "SMA":
        const priceForSMA = candleMap.get(item.time.toString());
        if (priceForSMA && priceForSMA > item.sma20) return "BUY";
        if (priceForSMA && priceForSMA < item.sma20) return "SELL";
        return "HOLD";

      case "BollingerBands":
        const priceForBB = candleMap.get(item.time.toString());
        if (priceForBB && priceForBB < item.bbLower) return "BUY";
        if (priceForBB && priceForBB > item.bbUpper) return "SELL";
        return "HOLD";

      case "ParabolicSAR":
        const priceForPSAR = candleMap.get(item.time.toString());
        if (priceForPSAR && priceForPSAR > item.psar) return "BUY";
        if (priceForPSAR && priceForPSAR < item.psar) return "SELL";
        return "HOLD";

      case "StochasticRSI":
        if (item.stochRsiK < 20 && item.stochRsiD < 20) return "BUY";
        if (item.stochRsiK > 80 && item.stochRsiD > 80) return "SELL";
        return "HOLD";

      default:
        return "HOLD";
    }
  });
}

export async function compareStrategies(symbol, start, end) {
  // Convert date strings to BigInt timestamps
  const startTime = convertDateToBigInt(start);
  const endTime = convertDateToBigInt(end);

  console.log(`📅 Date range: ${start} to ${end}`);
  console.log(`🔢 Converted to: ${startTime} to ${endTime}`);

  // Get indicator data from database
  const data = await prisma.indicator.findMany({
    where: {
      symbol,
      time: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { time: "asc" },
    take: 2000,
  });

  if (data.length === 0) {
    throw new Error(
      `No indicator data found for ${symbol} in the specified time range (${start} to ${end})`
    );
  }

  console.log(`📊 Found ${data.length} indicator records`);

  // Get corresponding candle data for price information
  const candleData = await prisma.candle.findMany({
    where: {
      symbol,
      time: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { time: "asc" },
  });

  const candleMap = new Map(
    candleData.map((c) => [c.time.toString(), c.close])
  );

  // Define all indicators to test
  const indicators = [
    "RSI",
    "MACD",
    "Stochastic",
    "EMA",
    "SMA",
    "BollingerBands",
    "ParabolicSAR",
    "StochasticRSI",
  ];

  // Calculate results for each single indicator strategy
  const singleResults = {};

  for (const indicator of indicators) {
    const signals = generateSingleIndicatorSignals(data, candleMap, indicator);
    const result = calculateBacktest(signals, candleMap, data);
    singleResults[indicator] = result;
    console.log(
      `📈 ${indicator}: ROI ${result.roi}%, Win Rate ${result.winRate}%, Trades ${result.trades}`
    );
  }

  // Multi indicator strategy
  const weights = {
    rsi: 3,
    macd: 2,
    ema20: 1,
    psar: 1,
    bb: 1,
    stoch: 2,
  };

  const multiSignals = data.map((item) => analyzeMultiIndicator(item, weights));
  const multiResult = calculateBacktest(multiSignals, candleMap, data);

  console.log(
    `🔥 Multi-indicator: ROI ${multiResult.roi}%, Win Rate ${multiResult.winRate}%, Trades ${multiResult.trades}`
  );

  // Determine best single strategy
  const bestSingleIndicator = Object.entries(singleResults).reduce(
    (best, [indicator, result]) => {
      return result.roi > best.roi ? { indicator, ...result } : best;
    },
    { indicator: null, roi: -Infinity }
  );

  // Determine overall best strategy
  const bestStrategy =
    multiResult.roi > bestSingleIndicator.roi ? "multi" : "single";

  return {
    single: singleResults,
    multi: multiResult,
    bestStrategy,
    bestSingleIndicator: bestSingleIndicator.indicator,
  };
}
