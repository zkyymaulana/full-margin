/**
 * 🎮 Backtest Controller - Business Logic for Trading Strategy Backtesting
 * Handles HTTP requests and coordinates between routes and services
 * 
 * @description Controller untuk mengelola logika bisnis backtesting strategi trading
 * @features Strategy backtesting, performance evaluation, results management
 */

import { getHistoricalData } from "../services/data.service.js";
import { calculateAllIndicators } from "../services/indicators.service.js";
import { 
  runComprehensiveBacktest, 
  runSingleIndicatorBacktest,
  backtestVotingStrategy,
  backtestWeightedStrategy,
  generateBacktestSummary,
  compareStrategies,
  exportToCSV
} from "../services/backtest.service.js";
import { generateAllSignals } from "../services/signals.service.js";
import { setCache, getCache } from "../utils/cache.js";
import { formatTime, getCurrentTime, createSummaryStatistics } from "../utils/helpers.js";
import fs from "fs";
import path from "path";

/**
 * 🧪 Get historical backtest results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getBacktestResults(req, res) {
  try {
    const {
      symbol = "BTCUSDT",
      timeframe = "1d",
      strategy = "all",
      limit = 1000
    } = req.query;

    console.log(`🧪 Getting backtest results for ${symbol}@${timeframe}, strategy: ${strategy}`);

    // Try to get from cache first
    const cacheKey = `backtest_${symbol}_${timeframe}_${strategy}_${limit}`;
    const cachedData = getCache(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        message: "✅ Backtest results retrieved from cache",
        symbol,
        timeframe,
        strategy,
        data: cachedData,
        cached: true,
        timestamp: getCurrentTime().iso
      });
    }

    // Fetch historical data
    const startTime = new Date("2020-10-01").getTime();
    const historicalData = await getHistoricalData(symbol, timeframe, startTime);

    if (!historicalData || historicalData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `❌ No historical data found for ${symbol}@${timeframe}`,
        symbol,
        timeframe
      });
    }

    // Calculate indicators
    const priceData = {
      opens: historicalData.map(d => d.open),
      highs: historicalData.map(d => d.high),
      lows: historicalData.map(d => d.low),
      closes: historicalData.map(d => d.close),
      volumes: historicalData.map(d => d.volume)
    };

    const indicators = calculateAllIndicators(priceData);

    // Run comprehensive backtest
    const backtestResults = runComprehensiveBacktest(historicalData, indicators);

    // Apply limit to trade details if specified
    if (limit && limit < historicalData.length) {
      const limitedData = historicalData.slice(-limit);
      // Note: For simplicity, we're using full backtest but could optimize this
    }

    // Cache the results
    setCache(cacheKey, backtestResults, 30 * 60 * 1000); // 30 minutes cache

    console.log(`✅ Backtest completed for ${backtestResults.all.length} strategies`);

    res.json({
      success: true,
      message: "✅ Backtest results generated successfully",
      symbol,
      timeframe,
      strategy,
      dataPoints: historicalData.length,
      dateRange: {
        start: formatTime(historicalData[0].time * 1000),
        end: formatTime(historicalData[historicalData.length - 1].time * 1000)
      },
      results: backtestResults,
      cached: false,
      timestamp: getCurrentTime().iso
    });

  } catch (error) {
    console.error("❌ Error in getBacktestResults:", error.message);
    res.status(500).json({
      success: false,
      message: "❌ Error generating backtest results",
      error: error.message,
      timestamp: getCurrentTime().iso
    });
  }
}

/**
 * 🧪 Run new backtest with specified parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function runBacktest(req, res) {
  try {
    const {
      symbol = "BTCUSDT",
      timeframe = "1d",
      strategies = ["all"],
      startTime,
      endTime,
      parameters = {}
    } = req.body;

    console.log(`🧪 Running custom backtest for ${symbol}@${timeframe}`);

    // Validate parameters
    const finalStartTime = startTime ? Number(startTime) : new Date("2020-10-01").getTime();
    const finalEndTime = endTime ? Number(endTime) : null;

    // Fetch historical data
    const historicalData = await getHistoricalData(symbol, timeframe, finalStartTime, finalEndTime);

    if (!historicalData || historicalData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `❌ No historical data found for specified parameters`,
        symbol,
        timeframe,
        startTime: formatTime(finalStartTime),
        endTime: finalEndTime ? formatTime(finalEndTime) : "latest"
      });
    }

    // Calculate indicators
    const priceData = {
      opens: historicalData.map(d => d.open),
      highs: historicalData.map(d => d.high),
      lows: historicalData.map(d => d.low),
      closes: historicalData.map(d => d.close),
      volumes: historicalData.map(d => d.volume)
    };

    const indicators = calculateAllIndicators(priceData);
    const closes = historicalData.map(d => d.close);
    const timestamps = historicalData.map(d => d.time);

    // Run selected strategies
    const results = [];
    const strategiesList = Array.isArray(strategies) ? strategies : [strategies];

    for (const strategy of strategiesList) {
      switch (strategy.toLowerCase()) {
        case "all":
          const comprehensiveResults = runComprehensiveBacktest(historicalData, indicators);
          results.push(...comprehensiveResults.all);
          break;

        case "voting":
          const votingResult = backtestVotingStrategy(closes, indicators, timestamps);
          results.push(votingResult);
          break;

        case "weighted":
          const weightedResult = backtestWeightedStrategy(closes, indicators, timestamps);
          results.push(weightedResult);
          break;

        case "sma":
        case "rsi":
        case "macd":
        case "stochastic":
        case "bollinger":
        case "psar":
          // Run individual strategy backtest
          const signals = generateAllSignals(historicalData.map((candle, index) => ({
            ...candle,
            sma20: indicators.sma20[index],
            sma50: indicators.sma50[index],
            ema20: indicators.ema20[index],
            rsi14: indicators.rsi14[index],
            stochK: indicators.stochastic.k[index],
            stochD: indicators.stochastic.d[index],
            stochRsiK: indicators.stochasticRSI.k[index],
            stochRsiD: indicators.stochasticRSI.d[index],
            macdLine: indicators.macd.macd[index],
            macdSignal: indicators.macd.signal[index],
            macdHistogram: indicators.macd.histogram[index],
            bbUpper: indicators.bollingerBands.upper[index],
            bbLower: indicators.bollingerBands.lower[index],
            psar: indicators.parabolicSAR[index]
          })));

          if (signals[strategy]) {
            const result = runSingleIndicatorBacktest(
              strategy.toUpperCase(), 
              signals[strategy], 
              closes, 
              timestamps
            );
            results.push(result);
          }
          break;

        default:
          console.warn(`⚠️ Unknown strategy: ${strategy}`);
      }
    }

    // Generate summary
    const summary = generateBacktestSummary(results);

    // Generate comparison table
    const comparisonTable = compareStrategies(results);

    console.log(`✅ Custom backtest completed for ${results.length} strategies`);

    res.json({
      success: true,
      message: "✅ Custom backtest completed successfully",
      symbol,
      timeframe,
      strategies: strategiesList,
      dataPoints: historicalData.length,
      dateRange: {
        start: formatTime(historicalData[0].time * 1000),
        end: formatTime(historicalData[historicalData.length - 1].time * 1000)
      },
      results: {
        strategies: results,
        summary,
        comparison: comparisonTable
      },
      parameters,
      timestamp: getCurrentTime().iso
    });

  } catch (error) {
    console.error("❌ Error in runBacktest:", error.message);
    res.status(500).json({
      success: false,
      message: "❌ Error running custom backtest",
      error: error.message,
      timestamp: getCurrentTime().iso
    });
  }
}

/**
 * 🧪 Get detailed backtest results and statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getBacktestHistory(req, res) {
  try {
    const {
      symbol = "BTCUSDT",
      timeframe = "1d",
      format = "json", // json or csv
      includeTradeDetails = false
    } = req.query;

    console.log(`🧪 Getting detailed backtest history for ${symbol}@${timeframe}`);

    // Get comprehensive backtest results
    const startTime = new Date("2020-10-01").getTime();
    const historicalData = await getHistoricalData(symbol, timeframe, startTime);

    if (!historicalData || historicalData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `❌ No historical data found for ${symbol}@${timeframe}`,
        symbol,
        timeframe
      });
    }

    // Calculate indicators and run backtest
    const priceData = {
      opens: historicalData.map(d => d.open),
      highs: historicalData.map(d => d.high),
      lows: historicalData.map(d => d.low),
      closes: historicalData.map(d => d.close),
      volumes: historicalData.map(d => d.volume)
    };

    const indicators = calculateAllIndicators(priceData);
    const backtestResults = runComprehensiveBacktest(historicalData, indicators);

    // Prepare detailed response
    const detailedResults = {
      summary: backtestResults.summary,
      individualStrategies: backtestResults.individual,
      multiIndicatorStrategies: backtestResults.multiIndicator,
      allStrategies: backtestResults.all
    };

    // Remove trade details if not requested (for performance)
    if (!includeTradeDetails) {
      detailedResults.allStrategies.forEach(strategy => {
        if (strategy.trades) {
          strategy.tradesCount = strategy.trades.length;
          delete strategy.trades;
        }
      });
    }

    // Handle CSV export
    if (format === "csv") {
      const csvContent = exportToCSV(backtestResults.all, `backtest_${symbol}_${timeframe}.csv`);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="backtest_${symbol}_${timeframe}.csv"`);
      return res.send(csvContent);
    }

    // Statistics for thesis/research
    const thesisStats = createSummaryStatistics(backtestResults.all);

    console.log(`✅ Detailed backtest history generated with ${backtestResults.all.length} strategies`);

    res.json({
      success: true,
      message: "✅ Detailed backtest history retrieved",
      symbol,
      timeframe,
      dataPoints: historicalData.length,
      analysisDate: formatTime(Date.now()),
      dateRange: {
        start: formatTime(historicalData[0].time * 1000),
        end: formatTime(historicalData[historicalData.length - 1].time * 1000)
      },
      results: detailedResults,
      thesisStatistics: thesisStats,
      includeTradeDetails: includeTradeDetails,
      timestamp: getCurrentTime().iso
    });

  } catch (error) {
    console.error("❌ Error in getBacktestHistory:", error.message);
    res.status(500).json({
      success: false,
      message: "❌ Error retrieving backtest history",
      error: error.message,
      timestamp: getCurrentTime().iso
    });
  }
}