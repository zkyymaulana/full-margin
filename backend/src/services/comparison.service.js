import { prisma } from "../lib/prisma.js";
import { convertBigIntToNumber } from "../utils/convertBingInt.js";

// ========================================
// 🧠 COMPARISON SERVICE
// ========================================
// Compares single indicator vs multi-indicator trading strategies
// with comprehensive backtesting and performance metrics

// Default indicator weights for multi-indicator strategy
const DEFAULT_INDICATOR_WEIGHTS = {
  sma20: 0.15,
  ema20: 0.2,
  rsi: 0.25,
  macd: 0.25,
  psar: 0.15,
};

// Signal thresholds for each indicator
const SIGNAL_THRESHOLDS = {
  rsi: { oversold: 30, overbought: 70 },
  stochK: { oversold: 20, overbought: 80 },
  stochD: { oversold: 20, overbought: 80 },
  stochRsiK: { oversold: 20, overbought: 80 },
  stochRsiD: { oversold: 20, overbought: 80 },
};

/**
 * 🎯 Main function: Compare single vs multi-indicator strategies
 * @param {string} symbol - Trading pair symbol (e.g., "BTC-USD")
 * @param {string} singleIndicator - Single indicator to test ("rsi", "macd", etc.)
 * @param {Object} multiConfig - Multi-indicator configuration
 * @param {Date} startDate - Backtest start date
 * @param {Date} endDate - Backtest end date
 * @param {string} timeframe - Data timeframe ("1h", "1d")
 * @param {number} initialCapital - Starting capital for simulation
 * @returns {Object} Comparison results with metrics for both strategies
 */
export async function compareStrategies(
  symbol,
  singleIndicator,
  multiConfig = {},
  startDate,
  endDate,
  timeframe = "1h",
  initialCapital = 10000
) {
  try {
    console.log(`🔍 Starting strategy comparison for ${symbol}`);
    console.log(`📊 Single: ${singleIndicator} | Multi: Combined indicators`);
    console.log(
      `📅 Period: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`
    );

    // 1️⃣ Fetch historical data
    const { candles, indicators } = await fetchHistoricalData(
      symbol,
      startDate,
      endDate,
      timeframe
    );

    if (candles.length < 50) {
      throw new Error(
        `Insufficient data: only ${candles.length} candles found`
      );
    }

    console.log(
      `📈 Loaded ${candles.length} candles and ${indicators.length} indicator records`
    );

    // 2️⃣ Generate signals for both strategies
    const singleSignals = generateSingleIndicatorSignals(
      indicators,
      singleIndicator
    );
    const multiSignals = generateMultiIndicatorSignals(indicators, multiConfig);

    console.log(
      `⚡ Generated ${singleSignals.length} single signals and ${multiSignals.length} multi signals`
    );

    // 3️⃣ Run backtests
    const singleResults = await runBacktest(
      candles,
      singleSignals,
      initialCapital,
      `Single_${singleIndicator}`
    );
    const multiResults = await runBacktest(
      candles,
      multiSignals,
      initialCapital,
      "Multi_Indicator"
    );

    // 4️⃣ Calculate additional metrics
    const singleMetrics = calculateAdvancedMetrics(singleResults, candles);
    const multiMetrics = calculateAdvancedMetrics(multiResults, candles);

    // 5️⃣ Create comparison summary
    const comparison = createComparisonSummary(
      singleMetrics,
      multiMetrics,
      singleIndicator,
      multiConfig,
      startDate,
      endDate
    );

    console.log(
      `✅ Comparison complete: Single ROI: ${singleMetrics.roi.toFixed(2)}% | Multi ROI: ${multiMetrics.roi.toFixed(2)}%`
    );

    return comparison;
  } catch (error) {
    console.error("❌ Error in compareStrategies:", error);
    throw error;
  }
}

/**
 * 📊 Fetch historical candle and indicator data
 */
async function fetchHistoricalData(symbol, startDate, endDate, timeframe) {
  const startTime = BigInt(Math.floor(startDate.getTime() / 1000));
  const endTime = BigInt(Math.floor(endDate.getTime() / 1000));

  // Fetch candles
  const candles = await prisma.candle.findMany({
    where: {
      symbol,
      timeframe,
      time: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { time: "asc" },
  });

  // Fetch indicators
  const indicators = await prisma.indicator.findMany({
    where: {
      symbol,
      timeframe,
      time: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { time: "asc" },
  });

  return {
    candles: candles.map(convertBigIntToNumber),
    indicators: indicators.map(convertBigIntToNumber),
  };
}

/**
 * ⚡ Generate signals for single indicator strategy
 */
function generateSingleIndicatorSignals(indicators, indicatorName) {
  const signals = [];

  for (let i = 1; i < indicators.length; i++) {
    const current = indicators[i];
    const previous = indicators[i - 1];

    if (!current || !previous) continue;

    let signal = null;
    let confidence = 0.5;

    switch (indicatorName.toLowerCase()) {
      case "rsi":
        if (current.rsi && previous.rsi) {
          if (
            current.rsi < SIGNAL_THRESHOLDS.rsi.oversold &&
            previous.rsi >= SIGNAL_THRESHOLDS.rsi.oversold
          ) {
            signal = "BUY";
            confidence = Math.min(
              0.95,
              (SIGNAL_THRESHOLDS.rsi.oversold - current.rsi) /
                SIGNAL_THRESHOLDS.rsi.oversold +
                0.5
            );
          } else if (
            current.rsi > SIGNAL_THRESHOLDS.rsi.overbought &&
            previous.rsi <= SIGNAL_THRESHOLDS.rsi.overbought
          ) {
            signal = "SELL";
            confidence = Math.min(
              0.95,
              (current.rsi - SIGNAL_THRESHOLDS.rsi.overbought) /
                (100 - SIGNAL_THRESHOLDS.rsi.overbought) +
                0.5
            );
          }
        }
        break;

      case "macd":
        if (
          current.macd &&
          current.macdSignal &&
          previous.macd &&
          previous.macdSignal
        ) {
          // MACD line crosses above signal line = BUY
          if (
            current.macd > current.macdSignal &&
            previous.macd <= previous.macdSignal
          ) {
            signal = "BUY";
            confidence = Math.min(
              0.95,
              Math.abs(current.macd - current.macdSignal) /
                Math.abs(current.macd) +
                0.5
            );
          }
          // MACD line crosses below signal line = SELL
          else if (
            current.macd < current.macdSignal &&
            previous.macd >= previous.macdSignal
          ) {
            signal = "SELL";
            confidence = Math.min(
              0.95,
              Math.abs(current.macd - current.macdSignal) /
                Math.abs(current.macd) +
                0.5
            );
          }
        }
        break;

      case "sma20":
      case "ema20":
        const ma = indicatorName === "sma20" ? current.sma20 : current.ema20;
        const prevMa =
          indicatorName === "sma20" ? previous.sma20 : previous.ema20;

        if (ma && prevMa) {
          // Price crosses above MA = BUY
          if (current.close && previous.close) {
            if (current.close > ma && previous.close <= prevMa) {
              signal = "BUY";
              confidence = Math.min(
                0.95,
                (current.close - ma) / current.close + 0.5
              );
            } else if (current.close < ma && previous.close >= prevMa) {
              signal = "SELL";
              confidence = Math.min(
                0.95,
                (ma - current.close) / current.close + 0.5
              );
            }
          }
        }
        break;

      case "psar":
        if (current.psar && previous.psar) {
          // Price crosses above PSAR = BUY
          if (current.close > current.psar && previous.close <= previous.psar) {
            signal = "BUY";
            confidence = 0.7;
          } else if (
            current.close < current.psar &&
            previous.close >= previous.psar
          ) {
            signal = "SELL";
            confidence = 0.7;
          }
        }
        break;
    }

    if (signal) {
      signals.push({
        time: current.time,
        action: signal,
        confidence,
        indicator: indicatorName,
        price: current.close || 0,
      });
    }
  }

  return signals;
}

/**
 * ⚖️ Generate signals for multi-indicator strategy
 */
function generateMultiIndicatorSignals(indicators, config = {}) {
  const weights = { ...DEFAULT_INDICATOR_WEIGHTS, ...config.weights };
  const signals = [];

  for (let i = 1; i < indicators.length; i++) {
    const current = indicators[i];
    const previous = indicators[i - 1];

    if (!current || !previous) continue;

    const votes = {
      BUY: 0,
      SELL: 0,
      HOLD: 0,
    };

    // RSI Vote
    if (current.rsi && previous.rsi) {
      if (current.rsi < SIGNAL_THRESHOLDS.rsi.oversold)
        votes.BUY += weights.rsi || 0.25;
      else if (current.rsi > SIGNAL_THRESHOLDS.rsi.overbought)
        votes.SELL += weights.rsi || 0.25;
      else votes.HOLD += weights.rsi || 0.25;
    }

    // MACD Vote
    if (
      current.macd &&
      current.macdSignal &&
      previous.macd &&
      previous.macdSignal
    ) {
      if (
        current.macd > current.macdSignal &&
        previous.macd <= previous.macdSignal
      ) {
        votes.BUY += weights.macd || 0.25;
      } else if (
        current.macd < current.macdSignal &&
        previous.macd >= previous.macdSignal
      ) {
        votes.SELL += weights.macd || 0.25;
      } else {
        votes.HOLD += weights.macd || 0.25;
      }
    }

    // SMA Vote
    if (current.sma20 && previous.sma20 && current.close && previous.close) {
      if (current.close > current.sma20 && previous.close <= previous.sma20) {
        votes.BUY += weights.sma20 || 0.15;
      } else if (
        current.close < current.sma20 &&
        previous.close >= previous.sma20
      ) {
        votes.SELL += weights.sma20 || 0.15;
      } else {
        votes.HOLD += weights.sma20 || 0.15;
      }
    }

    // EMA Vote
    if (current.ema20 && previous.ema20 && current.close && previous.close) {
      if (current.close > current.ema20 && previous.close <= previous.ema20) {
        votes.BUY += weights.ema20 || 0.2;
      } else if (
        current.close < current.ema20 &&
        previous.close >= previous.ema20
      ) {
        votes.SELL += weights.ema20 || 0.2;
      } else {
        votes.HOLD += weights.ema20 || 0.2;
      }
    }

    // PSAR Vote
    if (current.psar && previous.psar && current.close && previous.close) {
      if (current.close > current.psar && previous.close <= previous.psar) {
        votes.BUY += weights.psar || 0.15;
      } else if (
        current.close < current.psar &&
        previous.close >= previous.psar
      ) {
        votes.SELL += weights.psar || 0.15;
      } else {
        votes.HOLD += weights.psar || 0.15;
      }
    }

    // Determine final action based on weighted votes
    const maxVote = Math.max(votes.BUY, votes.SELL, votes.HOLD);
    let action = "HOLD";
    let confidence = 0.5;

    if (maxVote === votes.BUY && votes.BUY > 0.4) {
      action = "BUY";
      confidence = Math.min(0.95, votes.BUY);
    } else if (maxVote === votes.SELL && votes.SELL > 0.4) {
      action = "SELL";
      confidence = Math.min(0.95, votes.SELL);
    }

    if (action !== "HOLD") {
      signals.push({
        time: current.time,
        action,
        confidence,
        indicator: "MULTI",
        price: current.close || 0,
        votes: { ...votes },
      });
    }
  }

  return signals;
}

/**
 * 🔄 Run backtest simulation
 */
async function runBacktest(candles, signals, initialCapital, strategyName) {
  let capital = initialCapital;
  let position = null; // { type: 'LONG', entry: price, time: timestamp, quantity: number }
  let trades = [];
  let equity = [initialCapital];
  let equityHistory = [];

  // Create price lookup for faster access
  const priceMap = new Map();
  candles.forEach((candle) => {
    priceMap.set(candle.time.toString(), candle.close);
  });

  for (const signal of signals) {
    const price = signal.price || priceMap.get(signal.time.toString());
    if (!price) continue;

    if (signal.action === "BUY" && !position) {
      // Open long position
      const quantity = capital / price;
      position = {
        type: "LONG",
        entry: price,
        time: signal.time,
        quantity: quantity,
        confidence: signal.confidence,
      };

      // Record equity at position open
      equityHistory.push({
        time: signal.time,
        equity: capital,
        action: "BUY",
        price: price,
      });
    } else if (signal.action === "SELL" && position) {
      // Close long position
      const exitPrice = price;
      const pnl = (exitPrice - position.entry) * position.quantity;
      const pnlPercent = ((exitPrice - position.entry) / position.entry) * 100;

      capital += pnl;

      const trade = {
        entry: position.entry,
        exit: exitPrice,
        quantity: position.quantity,
        pnl: pnl,
        pnlPercent: pnlPercent,
        duration: signal.time - position.time,
        entryTime: position.time,
        exitTime: signal.time,
        isWin: pnl > 0,
        confidence: (position.confidence + signal.confidence) / 2,
      };

      trades.push(trade);
      equity.push(capital);

      equityHistory.push({
        time: signal.time,
        equity: capital,
        action: "SELL",
        price: price,
        pnl: pnl,
      });

      position = null;
    }
  }

  // Close any open position at the end
  if (position && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const exitPrice = lastCandle.close;
    const pnl = (exitPrice - position.entry) * position.quantity;
    const pnlPercent = ((exitPrice - position.entry) / position.entry) * 100;

    capital += pnl;

    trades.push({
      entry: position.entry,
      exit: exitPrice,
      quantity: position.quantity,
      pnl: pnl,
      pnlPercent: pnlPercent,
      duration: lastCandle.time - position.time,
      entryTime: position.time,
      exitTime: lastCandle.time,
      isWin: pnl > 0,
      confidence: position.confidence,
    });

    equity.push(capital);
  }

  return {
    strategyName,
    initialCapital,
    finalCapital: capital,
    trades,
    equity,
    equityHistory,
    totalTrades: trades.length,
    winTrades: trades.filter((t) => t.isWin).length,
    lossTrades: trades.filter((t) => !t.isWin).length,
  };
}

/**
 * 📈 Calculate advanced performance metrics
 */
function calculateAdvancedMetrics(backtestResults, candles) {
  const {
    initialCapital,
    finalCapital,
    trades,
    equity,
    totalTrades,
    winTrades,
    lossTrades,
  } = backtestResults;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0,
      roi: 0,
      totalProfit: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      averageTradeDuration: 0,
      sharpeRatio: 0,
      totalReturn: finalCapital - initialCapital,
      startDate: candles[0]?.time || 0,
      endDate: candles[candles.length - 1]?.time || 0,
    };
  }

  // Basic metrics
  const roi = ((finalCapital - initialCapital) / initialCapital) * 100;
  const winRate = (winTrades / totalTrades) * 100;

  // Profit metrics
  const profitTrades = trades.filter((t) => t.pnl > 0);
  const lossTrades_filtered = trades.filter((t) => t.pnl <= 0);

  const totalProfit = profitTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(
    lossTrades_filtered.reduce((sum, t) => sum + t.pnl, 0)
  );

  const profitFactor =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

  // Drawdown calculation
  let peak = initialCapital;
  let maxDrawdown = 0;

  for (const equityValue of equity) {
    if (equityValue > peak) {
      peak = equityValue;
    } else {
      const drawdown = ((peak - equityValue) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  // Average trade duration (in hours, assuming 1h timeframe)
  const avgDuration =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + Number(t.duration), 0) /
        trades.length /
        3600
      : 0;

  // Simple Sharpe ratio approximation
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const returnStdDev =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            (returns.length - 1)
        )
      : 0;

  const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

  return {
    totalTrades,
    winTrades,
    lossTrades,
    winRate: Math.round(winRate * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    averageTradeDuration: Math.round(avgDuration * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 10000) / 10000,
    totalReturn: Math.round((finalCapital - initialCapital) * 100) / 100,
    startDate: candles[0]?.time || 0,
    endDate: candles[candles.length - 1]?.time || 0,
    equityHistory: backtestResults.equityHistory,
    trades: trades.slice(0, 10), // Return first 10 trades for analysis
  };
}

/**
 * 📊 Create comparison summary
 */
function createComparisonSummary(
  singleMetrics,
  multiMetrics,
  singleIndicator,
  multiConfig,
  startDate,
  endDate
) {
  const winner = singleMetrics.roi > multiMetrics.roi ? "single" : "multi";
  const roiDifference = Math.abs(singleMetrics.roi - multiMetrics.roi);

  return {
    summary: {
      winner,
      roiDifference: Math.round(roiDifference * 100) / 100,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
      },
    },
    singleIndicator: {
      name: singleIndicator,
      metrics: singleMetrics,
    },
    multiIndicator: {
      config: multiConfig.weights || DEFAULT_INDICATOR_WEIGHTS,
      metrics: multiMetrics,
    },
    comparison: {
      roiComparison: {
        single: singleMetrics.roi,
        multi: multiMetrics.roi,
        difference: multiMetrics.roi - singleMetrics.roi,
      },
      winRateComparison: {
        single: singleMetrics.winRate,
        multi: multiMetrics.winRate,
        difference: multiMetrics.winRate - singleMetrics.winRate,
      },
      tradesComparison: {
        single: singleMetrics.totalTrades,
        multi: multiMetrics.totalTrades,
        difference: multiMetrics.totalTrades - singleMetrics.totalTrades,
      },
      maxDrawdownComparison: {
        single: singleMetrics.maxDrawdown,
        multi: multiMetrics.maxDrawdown,
        difference: singleMetrics.maxDrawdown - multiMetrics.maxDrawdown, // Lower is better
      },
    },
    recommendations: generateRecommendations(
      singleMetrics,
      multiMetrics,
      singleIndicator
    ),
  };
}

/**
 * 💡 Generate trading recommendations based on comparison
 */
function generateRecommendations(singleMetrics, multiMetrics, singleIndicator) {
  const recommendations = [];

  // ROI comparison
  if (multiMetrics.roi > singleMetrics.roi) {
    recommendations.push({
      type: "strategy",
      message: `Multi-indicator strategy outperformed ${singleIndicator} by ${(multiMetrics.roi - singleMetrics.roi).toFixed(2)}% ROI`,
      priority: "high",
    });
  } else {
    recommendations.push({
      type: "strategy",
      message: `Single ${singleIndicator} strategy outperformed multi-indicator by ${(singleMetrics.roi - multiMetrics.roi).toFixed(2)}% ROI`,
      priority: "high",
    });
  }

  // Risk analysis
  if (multiMetrics.maxDrawdown < singleMetrics.maxDrawdown) {
    recommendations.push({
      type: "risk",
      message: `Multi-indicator strategy showed lower risk with ${multiMetrics.maxDrawdown.toFixed(2)}% max drawdown vs ${singleMetrics.maxDrawdown.toFixed(2)}%`,
      priority: "medium",
    });
  }

  // Trade frequency analysis
  if (singleMetrics.totalTrades > multiMetrics.totalTrades * 1.5) {
    recommendations.push({
      type: "frequency",
      message: `Single indicator generated ${singleMetrics.totalTrades} trades vs ${multiMetrics.totalTrades} for multi-indicator. Consider if overtrading is an issue.`,
      priority: "medium",
    });
  }

  // Win rate analysis
  const winRateDiff = multiMetrics.winRate - singleMetrics.winRate;
  if (Math.abs(winRateDiff) > 10) {
    recommendations.push({
      type: "accuracy",
      message: `${winRateDiff > 0 ? "Multi-indicator" : "Single indicator"} showed significantly better win rate (${Math.abs(winRateDiff).toFixed(1)}% difference)`,
      priority: "medium",
    });
  }

  return recommendations;
}

/**
 * 🎯 Get available indicators for comparison
 */
export async function getAvailableIndicators(symbol, timeframe = "1h") {
  try {
    const sample = await prisma.indicator.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
    });

    if (!sample) {
      return [];
    }

    const indicators = [];
    if (sample.rsi !== null)
      indicators.push({ name: "rsi", displayName: "RSI" });
    if (sample.macd !== null)
      indicators.push({ name: "macd", displayName: "MACD" });
    if (sample.sma20 !== null)
      indicators.push({ name: "sma20", displayName: "SMA 20" });
    if (sample.ema20 !== null)
      indicators.push({ name: "ema20", displayName: "EMA 20" });
    if (sample.psar !== null)
      indicators.push({ name: "psar", displayName: "Parabolic SAR" });
    if (sample.stochK !== null)
      indicators.push({ name: "stochK", displayName: "Stochastic %K" });
    if (sample.bbUpper !== null)
      indicators.push({ name: "bollinger", displayName: "Bollinger Bands" });

    return indicators;
  } catch (error) {
    console.error("Error getting available indicators:", error);
    return [];
  }
}

/**
 * 📊 Get comparison history for a symbol
 */
export async function getComparisonHistory(symbol, limit = 10) {
  try {
    // This would typically be stored in a ComparisonResult model
    // For now, return empty array - implement based on your needs
    return [];
  } catch (error) {
    console.error("Error getting comparison history:", error);
    return [];
  }
}

export { DEFAULT_INDICATOR_WEIGHTS, SIGNAL_THRESHOLDS };
