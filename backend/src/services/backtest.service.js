/**
 * 🧪 Backtest Service - Trading Strategy Backtesting
 * Contains all backtesting logic and performance evaluation functions
 * 
 * @description Service untuk backtesting strategi trading dan evaluasi performa
 * @features Individual strategy backtest, multi-indicator strategies, performance metrics
 */

import { 
  generateMASignals, 
  generateRSISignals, 
  generateStochasticSignals,
  generateStochasticRSISignals,
  generateMACDSignals,
  generateBollingerBandsSignals,
  generateParabolicSARSignals,
  generateIndividualSignals
} from "./signals.service.js";
import { calculateWinRate, calculateTotalReturn, calculateMaxDrawdown, formatTime } from "../utils/helpers.js";

/**
 * 📊 Evaluate trading performance based on signals
 * @param {number[]} closes - Array of close prices
 * @param {string[]} signals - Array of BUY/SELL/HOLD signals
 * @param {number[]} timestamps - Array of timestamps
 * @returns {Object} Backtest results with performance metrics
 */
export function evaluatePerformance(closes, signals, timestamps = null) {
  let trades = [];
  let position = null;
  let entryPrice = 0;
  let entryIndex = 0;
  let entryTime = 0;

  for (let i = 1; i < closes.length; i++) {
    const signal = signals[i];
    const price = closes[i];
    const currentTime = timestamps ? timestamps[i] : i;

    if (signal === "BUY" && position === null) {
      // Open LONG position
      position = "LONG";
      entryPrice = price;
      entryIndex = i;
      entryTime = currentTime;
    } else if (signal === "SELL" && position === "LONG") {
      // Close LONG position
      const returnPct = ((price - entryPrice) / entryPrice) * 100;
      const holdingPeriod = i - entryIndex;
      const holdingDays = timestamps ? 
        Math.round((currentTime - entryTime) / (24 * 60 * 60)) : holdingPeriod;

      trades.push({
        entryPrice,
        exitPrice: price,
        returnPct,
        holdingPeriod,
        holdingDays,
        entryIndex,
        exitIndex: i,
        entryTime: entryTime,
        exitTime: currentTime,
        entryDate: timestamps ? formatTime(entryTime * 1000) : `Day ${entryIndex}`,
        exitDate: timestamps ? formatTime(currentTime * 1000) : `Day ${i}`
      });
      position = null;
    }
  }

  // Calculate performance metrics
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.returnPct > 0).length;
  const losses = trades.filter(t => t.returnPct < 0).length;

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgReturn = trades.length > 0 ? 
    trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length : 0;

  // Calculate cumulative ROI
  const roi = trades.reduce((acc, t) => acc * (1 + t.returnPct / 100), 1) - 1;

  // Calculate average holding period
  const avgHoldingPeriod = trades.length > 0 ? 
    trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0;

  // Calculate maximum drawdown
  const maxDrawdown = calculateMaxDrawdown(trades);

  return {
    totalTrades,
    wins,
    losses,
    winRate: parseFloat(winRate.toFixed(2)),
    avgReturn: parseFloat(avgReturn.toFixed(2)),
    roi: parseFloat((roi * 100).toFixed(2)),
    avgHoldingPeriod: parseFloat(avgHoldingPeriod.toFixed(1)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    trades
  };
}

/**
 * 🎯 Run backtest for single indicator strategy
 * @param {string} strategyName - Name of the strategy
 * @param {string[]} signals - Array of trading signals
 * @param {number[]} closes - Array of close prices
 * @param {number[]} timestamps - Array of timestamps
 * @returns {Object} Backtest results
 */
export function runSingleIndicatorBacktest(strategyName, signals, closes, timestamps) {
  console.log(`🧪 Running backtest for ${strategyName} strategy...`);
  
  const results = evaluatePerformance(closes, signals, timestamps);
  
  console.log(`✅ ${strategyName}: ${results.totalTrades} trades, ${results.winRate}% win rate, ${results.roi}% ROI`);
  
  return {
    strategy: strategyName,
    ...results
  };
}

/**
 * 🎯 Backtest voting strategy (majority vote from multiple indicators)
 * @param {number[]} closes - Array of close prices
 * @param {Object} indicators - Object containing all indicator data
 * @param {number[]} timestamps - Array of timestamps
 * @returns {Object} Backtest results for voting strategy
 */
export function backtestVotingStrategy(closes, indicators, timestamps) {
  try {
    console.log("🧪 Running voting strategy backtest...");

    // Generate signals for each indicator
    const maSignals = generateMASignals(indicators.sma20, indicators.sma50);
    const rsiSignals = generateRSISignals(indicators.rsi14);
    const stochasticSignals = generateStochasticSignals(
      indicators.stochastic.k, 
      indicators.stochastic.d
    );
    const stochRSISignals = generateStochasticRSISignals(
      indicators.stochRSI.k, 
      indicators.stochRSI.d
    );
    const macdSignals = generateMACDSignals(
      indicators.macd.macd, 
      indicators.macd.signal, 
      indicators.macd.histogram
    );
    const bollingerSignals = generateBollingerBandsSignals(
      closes, 
      indicators.bollinger.upper, 
      indicators.bollinger.lower
    );
    const psarSignals = generateParabolicSARSignals(closes, indicators.psar);

    // Combine signals using majority voting
    const finalSignals = Array(closes.length).fill("HOLD");
    
    for (let i = 0; i < closes.length; i++) {
      const signalsList = [
        maSignals[i],
        rsiSignals[i], 
        stochasticSignals[i],
        stochRSISignals[i],
        macdSignals[i],
        bollingerSignals[i],
        psarSignals[i]
      ].filter(signal => signal !== "HOLD"); // Only count BUY/SELL votes

      if (signalsList.length === 0) {
        finalSignals[i] = "HOLD";
        continue;
      }

      // Count votes
      const buyVotes = signalsList.filter(s => s === "BUY").length;
      const sellVotes = signalsList.filter(s => s === "SELL").length;

      // Majority vote decision
      if (buyVotes > sellVotes) {
        finalSignals[i] = "BUY";
      } else if (sellVotes > buyVotes) {
        finalSignals[i] = "SELL";
      } else {
        finalSignals[i] = "HOLD";
      }
    }

    // Evaluate performance
    const results = evaluatePerformance(closes, finalSignals, timestamps);

    console.log(`✅ Voting Strategy: ${results.totalTrades} trades, ${results.winRate}% win rate, ${results.roi}% ROI`);

    return {
      strategy: "Voting Strategy",
      ...results
    };

  } catch (error) {
    console.error("❌ Error in voting strategy backtest:", error.message);
    return {
      strategy: "Voting Strategy",
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgReturn: 0,
      roi: 0,
      avgHoldingPeriod: 0,
      maxDrawdown: 0,
      trades: []
    };
  }
}

/**
 * 🎯 Backtest weighted strategy (weighted scoring from multiple indicators)
 * @param {number[]} closes - Array of close prices
 * @param {Object} indicatorData - Object containing indicator arrays
 * @param {number[]} timestamps - Array of timestamps
 * @returns {Object} Backtest results for weighted strategy
 */
export function backtestWeightedStrategy(closes, indicatorData, timestamps) {
  try {
    console.log("🧪 Running weighted strategy backtest...");

    const signals = [];

    // Generate weighted signals for each candle
    for (let i = 0; i < closes.length; i++) {
      const data = {
        close: closes[i],
        sma20: indicatorData.sma20 ? indicatorData.sma20[i] : null,
        sma50: indicatorData.sma50 ? indicatorData.sma50[i] : null,
        ema20: indicatorData.ema20 ? indicatorData.ema20[i] : null,
        rsi: indicatorData.rsi14 ? indicatorData.rsi14[i] : null,
        stochK: indicatorData.stochastic ? indicatorData.stochastic.k[i] : null,
        stochD: indicatorData.stochastic ? indicatorData.stochastic.d[i] : null,
        stochRsiK: indicatorData.stochRSI ? indicatorData.stochRSI.k[i] : null,
        stochRsiD: indicatorData.stochRSI ? indicatorData.stochRSI.d[i] : null,
        macdLine: indicatorData.macd ? indicatorData.macd.macd[i] : null,
        macdSignal: indicatorData.macd ? indicatorData.macd.signal[i] : null,
        bbUpper: indicatorData.bollinger ? indicatorData.bollinger.upper[i] : null,
        bbLower: indicatorData.bollinger ? indicatorData.bollinger.lower[i] : null,
        psar: indicatorData.psar ? indicatorData.psar[i] : null
      };

      // Get individual signals and calculate weighted score
      const individualSignals = generateIndividualSignals(data);
      const signalValues = Object.values(individualSignals);
      
      const buyCount = signalValues.filter(s => s === "BUY").length;
      const sellCount = signalValues.filter(s => s === "SELL").length;
      const totalSignals = signalValues.length;

      // Weighted decision based on signal strength
      const buyStrength = buyCount / totalSignals;
      const sellStrength = sellCount / totalSignals;

      if (buyStrength >= 0.6) {
        signals.push("BUY");
      } else if (sellStrength >= 0.6) {
        signals.push("SELL");
      } else {
        signals.push("HOLD");
      }
    }

    // Evaluate performance
    const results = evaluatePerformance(closes, signals, timestamps);

    console.log(`✅ Weighted Strategy: ${results.totalTrades} trades, ${results.winRate}% win rate, ${results.roi}% ROI`);

    return {
      strategy: "Weighted Strategy",
      ...results
    };

  } catch (error) {
    console.error("❌ Error in weighted strategy backtest:", error.message);
    return {
      strategy: "Weighted Strategy",
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgReturn: 0,
      roi: 0,
      avgHoldingPeriod: 0,
      maxDrawdown: 0,
      trades: []
    };
  }
}

/**
 * 🏆 Run comprehensive backtest for all strategies
 * @param {Object} historicalData - Historical price data with indicators
 * @param {Object} indicators - Calculated indicators
 * @returns {Object} Results for all strategies
 */
export function runComprehensiveBacktest(historicalData, indicators) {
  console.log("🚀 Starting comprehensive backtest...");

  const closes = historicalData.map(d => d.close);
  const timestamps = historicalData.map(d => d.time);

  // Individual indicator backtests
  const results = [];

  // SMA Strategy
  const smaSignals = generateMASignals(indicators.sma20, indicators.sma50);
  results.push(runSingleIndicatorBacktest("SMA", smaSignals, closes, timestamps));

  // RSI Strategy
  const rsiSignals = generateRSISignals(indicators.rsi14);
  results.push(runSingleIndicatorBacktest("RSI", rsiSignals, closes, timestamps));

  // Stochastic Strategy
  const stochSignals = generateStochasticSignals(indicators.stochastic.k, indicators.stochastic.d);
  results.push(runSingleIndicatorBacktest("Stochastic", stochSignals, closes, timestamps));

  // Stochastic RSI Strategy
  const stochRSISignals = generateStochasticRSISignals(indicators.stochasticRSI.k, indicators.stochasticRSI.d);
  results.push(runSingleIndicatorBacktest("StochRSI", stochRSISignals, closes, timestamps));

  // MACD Strategy
  const macdSignals = generateMACDSignals(indicators.macd.macd, indicators.macd.signal, indicators.macd.histogram);
  results.push(runSingleIndicatorBacktest("MACD", macdSignals, closes, timestamps));

  // Bollinger Bands Strategy
  const bbSignals = generateBollingerBandsSignals(closes, indicators.bollingerBands.upper, indicators.bollingerBands.lower);
  results.push(runSingleIndicatorBacktest("Bollinger", bbSignals, closes, timestamps));

  // Parabolic SAR Strategy
  const psarSignals = generateParabolicSARSignals(closes, indicators.parabolicSAR);
  results.push(runSingleIndicatorBacktest("PSAR", psarSignals, closes, timestamps));

  // Multi-indicator strategies
  const votingResult = backtestVotingStrategy(closes, indicators, timestamps);
  results.push(votingResult);

  const weightedResult = backtestWeightedStrategy(closes, indicators, timestamps);
  results.push(weightedResult);

  console.log("✅ Comprehensive backtest completed");

  return {
    individual: results.slice(0, -2),
    multiIndicator: results.slice(-2),
    all: results,
    summary: generateBacktestSummary(results)
  };
}

/**
 * 📊 Generate summary statistics from backtest results
 * @param {Array} results - Array of backtest results
 * @returns {Object} Summary statistics
 */
export function generateBacktestSummary(results) {
  if (!results || results.length === 0) {
    return {
      totalStrategies: 0,
      avgROI: 0,
      avgWinRate: 0,
      avgMaxDD: 0,
      bestStrategy: null,
      worstStrategy: null,
      profitableStrategies: 0
    };
  }

  const validResults = results.filter(r => r && typeof r.roi === 'number');
  
  const avgROI = validResults.reduce((sum, r) => sum + r.roi, 0) / validResults.length;
  const avgWinRate = validResults.reduce((sum, r) => sum + r.winRate, 0) / validResults.length;
  const avgMaxDD = validResults.reduce((sum, r) => sum + r.maxDrawdown, 0) / validResults.length;
  
  const bestStrategy = validResults.reduce((best, current) => 
    current.roi > best.roi ? current : best, validResults[0]);
  const worstStrategy = validResults.reduce((worst, current) => 
    current.roi < worst.roi ? current : worst, validResults[0]);
  
  const profitableStrategies = validResults.filter(r => r.roi > 0).length;

  return {
    totalStrategies: validResults.length,
    avgROI: parseFloat(avgROI.toFixed(2)),
    avgWinRate: parseFloat(avgWinRate.toFixed(2)),
    avgMaxDD: parseFloat(avgMaxDD.toFixed(2)),
    bestStrategy: {
      name: bestStrategy.strategy,
      roi: bestStrategy.roi,
      winRate: bestStrategy.winRate
    },
    worstStrategy: {
      name: worstStrategy.strategy,
      roi: worstStrategy.roi,
      winRate: worstStrategy.winRate
    },
    profitableStrategies,
    profitabilityRate: parseFloat(((profitableStrategies / validResults.length) * 100).toFixed(1))
  };
}

/**
 * 📈 Compare multiple strategies
 * @param {Array} results - Array of backtest results
 * @returns {String} Formatted comparison table
 */
export function compareStrategies(results) {
  let output = "\n📊 STRATEGY COMPARISON\n";
  output += "=".repeat(80) + "\n";
  output += "Strategy".padEnd(20) + "Trades".padEnd(8) + "Win%".padEnd(8) + "Avg%".padEnd(8) + "ROI%".padEnd(8) + "MaxDD%\n";
  output += "-".repeat(80) + "\n";

  for (const result of results) {
    const line = 
      result.strategy.padEnd(20) +
      result.totalTrades.toString().padEnd(8) +
      `${result.winRate}%`.padEnd(8) +
      `${result.avgReturn}%`.padEnd(8) +
      `${result.roi}%`.padEnd(8) +
      `${result.maxDrawdown}%`;
    output += line + "\n";
  }
  
  output += "=".repeat(80);
  return output;
}

/**
 * 📄 Export backtest results to CSV format
 * @param {Array|Object} results - Backtest results
 * @param {String} filename - Output filename
 * @returns {String} CSV content
 */
export function exportToCSV(results, filename = "backtest_results.csv") {
  const headers = "Strategy,TotalTrades,Wins,Losses,WinRate,AvgReturn,ROI,AvgHoldingPeriod,MaxDrawdown\n";
  let csvContent = headers;

  const resultsArray = Array.isArray(results) ? results : [results];

  for (const result of resultsArray) {
    csvContent += `${result.strategy},${result.totalTrades},${result.wins},${result.losses},${result.winRate},${result.avgReturn},${result.roi},${result.avgHoldingPeriod},${result.maxDrawdown}\n`;
  }

  console.log(`📄 CSV export ready: ${filename}`);
  return csvContent;
}