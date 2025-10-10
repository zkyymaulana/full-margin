// /**
//  * 🎮 Signals Controller - Business Logic for Trading Signals (Coinbase Edition)
//  * Handles HTTP requests and coordinates between routes and services
//  *
//  * @description Controller untuk mengelola logika bisnis sinyal trading
//  * @features Signal generation, multi-indicator analysis, current market sentiment
//  */

// import {
//   getHistoricalData,
//   getSupportedSymbols,
//   isSymbolSupported,
// } from "../services/data.service.js";
// import { calculateAllIndicators } from "../services/indicators.service.js";
// import {
//   generateAllSignals,
//   getCurrentSignalsSummary,
//   generateIndividualSignals,
// } from "../services/signals.service.js";
// import { getCachedIndicatorData, cacheIndicatorData } from "../utils/cache.js";
// import { formatTime, getCurrentTime } from "../utils/helpers.js";

// /**
//  * 🎯 Get trading signals for individual indicators (Coinbase 1h only)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getSignals(req, res) {
//   try {
//     const {
//       symbol = "BTC-USD", // Changed to Coinbase format
//       indicator = "all",
//       limit = 500, // Increased for more hourly data
//     } = req.query;

//     // Force timeframe to 1h (hardcoded)
//     const timeframe = "1h";

//     console.log(
//       `🎯 Getting 1h signals for ${symbol} (Coinbase), indicator: ${indicator}`
//     );

//     // Validate symbol
//     if (!isSymbolSupported(symbol)) {
//       return res.status(400).json({
//         success: false,
//         message: `❌ Symbol ${symbol} not supported`,
//         supportedSymbols: getSupportedSymbols().slice(0, 20),
//         totalSupportedSymbols: getSupportedSymbols().length,
//         note: "Only top 100 CMC coins available on Coinbase are supported",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Try to get enriched data from cache first
//     const cacheKey = `signals_${symbol}_${timeframe}_${indicator}_${limit}`;
//     const cachedData = getCachedIndicatorData(symbol, "signals", {
//       timeframe,
//       indicator,
//       limit,
//     });

//     if (cachedData) {
//       return res.json({
//         success: true,
//         message: "✅ Signals data retrieved from cache",
//         symbol,
//         timeframe: "1h",
//         dataProvider: "Coinbase Pro API",
//         indicator,
//         data: cachedData,
//         cached: true,
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Fetch historical data with more recent start time
//     const startTime = new Date("2024-01-01").getTime(); // More recent for hourly data
//     const historicalData = await getHistoricalData(
//       symbol,
//       timeframe,
//       startTime
//     );

//     if (!historicalData || historicalData.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `❌ No historical data found for ${symbol}@${timeframe}`,
//         symbol,
//         timeframe: "1h",
//         dataProvider: "Coinbase Pro API",
//       });
//     }

//     // Calculate indicators
//     const priceData = {
//       opens: historicalData.map((d) => d.open),
//       highs: historicalData.map((d) => d.high),
//       lows: historicalData.map((d) => d.low),
//       closes: historicalData.map((d) => d.close),
//       volumes: historicalData.map((d) => d.volume),
//     };

//     const indicators = calculateAllIndicators(priceData);

//     // Combine historical data with indicators (adjusted for 1h timeframe)
//     const enrichedData = historicalData.map((candle, index) => ({
//       time: candle.time,
//       datetime: formatTime(candle.time * 1000),
//       open: candle.open,
//       high: candle.high,
//       low: candle.low,
//       close: candle.close,
//       volume: candle.volume,
//       sma12: indicators.sma12?.[index], // 12 hours
//       sma24: indicators.sma24?.[index], // 24 hours (1 day)
//       sma168: indicators.sma168?.[index], // 168 hours (1 week)
//       ema24: indicators.ema24?.[index], // 24 hours
//       rsi14: indicators.rsi14[index],
//       stochK: indicators.stochastic?.k[index],
//       stochD: indicators.stochastic?.d[index],
//       stochRsiK: indicators.stochasticRSI?.k[index],
//       stochRsiD: indicators.stochasticRSI?.d[index],
//       macdLine: indicators.macd?.macd[index],
//       macdSignal: indicators.macd?.signal[index],
//       macdHistogram: indicators.macd?.histogram[index],
//       bbUpper: indicators.bollingerBands?.upper[index],
//       bbMiddle: indicators.bollingerBands?.middle[index],
//       bbLower: indicators.bollingerBands?.lower[index],
//       psar: indicators.parabolicSAR?.[index],
//     }));

//     // Generate all signals
//     const allSignals = generateAllSignals(enrichedData);

//     // Apply limit
//     const limitedData = limit ? enrichedData.slice(-limit) : enrichedData;
//     const limitedSignals = {};

//     Object.keys(allSignals).forEach((key) => {
//       limitedSignals[key] = limit
//         ? allSignals[key].slice(-limit)
//         : allSignals[key];
//     });

//     // Combine data with signals
//     const dataWithSignals = limitedData.map((candle, index) => ({
//       ...candle,
//       signals: {
//         sma: limitedSignals.sma?.[index],
//         ema: limitedSignals.ema?.[index],
//         rsi: limitedSignals.rsi?.[index],
//         stochastic: limitedSignals.stochastic?.[index],
//         stochasticRSI: limitedSignals.stochasticRSI?.[index],
//         macd: limitedSignals.macd?.[index],
//         bollingerBands: limitedSignals.bollingerBands?.[index],
//         parabolicSAR: limitedSignals.parabolicSAR?.[index],
//       },
//     }));

//     // Filter by specific indicator if requested
//     let responseData;
//     if (indicator === "all") {
//       responseData = {
//         enrichedData: dataWithSignals,
//         signals: limitedSignals,
//       };
//     } else {
//       if (!limitedSignals[indicator]) {
//         return res.status(400).json({
//           success: false,
//           message: `❌ Invalid indicator: ${indicator}`,
//           availableIndicators: Object.keys(limitedSignals),
//           timeframe: "1h",
//         });
//       }
//       responseData = {
//         enrichedData: dataWithSignals.map((d) => ({
//           time: d.time,
//           datetime: d.datetime,
//           close: d.close,
//           signal: d.signals[indicator],
//         })),
//         signals: { [indicator]: limitedSignals[indicator] },
//       };
//     }

//     // Cache the result (30 minutes TTL for signals)
//     cacheIndicatorData(
//       symbol,
//       "signals",
//       { timeframe, indicator, limit },
//       responseData,
//       30 * 60 * 1000
//     );

//     // Count signal distribution
//     const signalCounts = {};
//     Object.keys(limitedSignals).forEach((key) => {
//       signalCounts[key] = { BUY: 0, SELL: 0, HOLD: 0 };
//       limitedSignals[key]?.forEach((signal) => {
//         if (signal) signalCounts[key][signal]++;
//       });
//     });

//     console.log(
//       `✅ Generated 1h signals for ${limitedData.length} data points`
//     );

//     res.json({
//       success: true,
//       message: "✅ Trading signals generated successfully",
//       symbol,
//       timeframe: "1h", // Always 1h
//       dataProvider: "Coinbase Pro API",
//       indicator,
//       dataPoints: limitedData.length,
//       totalDataAvailable: enrichedData.length,
//       dateRange: {
//         start: formatTime(limitedData[0].time * 1000),
//         end: formatTime(limitedData[limitedData.length - 1].time * 1000),
//       },
//       signalCounts,
//       supportedCoins: {
//         total: getSupportedSymbols().length,
//         note: "Top 100 CMC coins available on Coinbase",
//       },
//       data: responseData,
//       cached: false,
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error in getSignals:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error generating trading signals",
//       error: error.message,
//       timeframe: "1h",
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }

// /**
//  * 🎯 Get multi-indicator combined signals analysis (Coinbase 1h only)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getMultiIndicatorSignals(req, res) {
//   try {
//     const {
//       symbol = "BTC-USD", // Changed to Coinbase format
//       method = "voting", // voting or weighted
//     } = req.query;

//     // Force timeframe to 1h (hardcoded)
//     const timeframe = "1h";

//     console.log(
//       `🎯 Getting multi-indicator 1h signals for ${symbol} (Coinbase), method: ${method}`
//     );

//     // Validate symbol
//     if (!isSymbolSupported(symbol)) {
//       return res.status(400).json({
//         success: false,
//         message: `❌ Symbol ${symbol} not supported`,
//         supportedSymbols: getSupportedSymbols().slice(0, 20),
//         totalSupportedSymbols: getSupportedSymbols().length,
//         note: "Only top 100 CMC coins available on Coinbase are supported",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Get current data with indicators (more recent start time)
//     const startTime = new Date("2024-01-01").getTime();
//     const historicalData = await getHistoricalData(
//       symbol,
//       timeframe,
//       startTime
//     );

//     if (!historicalData || historicalData.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `❌ No historical data found for ${symbol}@${timeframe}`,
//         symbol,
//         timeframe: "1h",
//         dataProvider: "Coinbase Pro API",
//       });
//     }

//     // Calculate indicators
//     const priceData = {
//       opens: historicalData.map((d) => d.open),
//       highs: historicalData.map((d) => d.high),
//       lows: historicalData.map((d) => d.low),
//       closes: historicalData.map((d) => d.close),
//       volumes: historicalData.map((d) => d.volume),
//     };

//     const indicators = calculateAllIndicators(priceData);

//     // Get latest values
//     const latestIndex = historicalData.length - 1;
//     const latestData = {
//       close: historicalData[latestIndex].close,
//       sma12: indicators.sma12?.[latestIndex],
//       sma24: indicators.sma24?.[latestIndex],
//       sma168: indicators.sma168?.[latestIndex],
//       ema24: indicators.ema24?.[latestIndex],
//       rsi: indicators.rsi14[latestIndex],
//       stochK: indicators.stochastic?.k[latestIndex],
//       stochD: indicators.stochastic?.d[latestIndex],
//       stochRsiK: indicators.stochasticRSI?.k[latestIndex],
//       stochRsiD: indicators.stochasticRSI?.d[latestIndex],
//       macdLine: indicators.macd?.macd[latestIndex],
//       macdSignal: indicators.macd?.signal[latestIndex],
//       bbUpper: indicators.bollingerBands?.upper[latestIndex],
//       bbLower: indicators.bollingerBands?.lower[latestIndex],
//       psar: indicators.parabolicSAR?.[latestIndex],
//     };

//     // Get current signals summary
//     const signalsSummary = getCurrentSignalsSummary(latestData);

//     // Calculate historical multi-indicator signals for the last 72 hours (more relevant for 1h)
//     const last72Hours = historicalData.slice(-72);
//     const multiSignalHistory = [];

//     for (let i = 0; i < last72Hours.length; i++) {
//       const idx = historicalData.length - 72 + i;
//       if (idx < 0) continue;

//       const hourData = {
//         close: historicalData[idx].close,
//         sma12: indicators.sma12?.[idx],
//         sma24: indicators.sma24?.[idx],
//         sma168: indicators.sma168?.[idx],
//         ema24: indicators.ema24?.[idx],
//         rsi: indicators.rsi14[idx],
//         stochK: indicators.stochastic?.k[idx],
//         stochD: indicators.stochastic?.d[idx],
//         stochRsiK: indicators.stochasticRSI?.k[idx],
//         stochRsiD: indicators.stochasticRSI?.d[idx],
//         macdLine: indicators.macd?.macd[idx],
//         macdSignal: indicators.macd?.signal[idx],
//         bbUpper: indicators.bollingerBands?.upper[idx],
//         bbLower: indicators.bollingerBands?.lower[idx],
//         psar: indicators.parabolicSAR?.[idx],
//       };

//       const hourSummary = getCurrentSignalsSummary(hourData);
//       multiSignalHistory.push({
//         time: historicalData[idx].time,
//         datetime: formatTime(historicalData[idx].time * 1000),
//         close: historicalData[idx].close,
//         ...hourSummary,
//       });
//     }

//     console.log(`✅ Multi-indicator 1h analysis completed for ${symbol}`);

//     res.json({
//       success: true,
//       message: "✅ Multi-indicator analysis completed",
//       symbol,
//       timeframe: "1h", // Always 1h
//       dataProvider: "Coinbase Pro API",
//       method,
//       analysisDate: formatTime(historicalData[latestIndex].time * 1000),
//       currentPrice: latestData.close,
//       currentAnalysis: signalsSummary,
//       history: multiSignalHistory,
//       summary: {
//         totalIndicators: signalsSummary.totalIndicators,
//         currentSignal: signalsSummary.overallSignal,
//         confidence: Math.round(signalsSummary.confidence * 100),
//         bullishIndicators: signalsSummary.signalCounts.BUY,
//         bearishIndicators: signalsSummary.signalCounts.SELL,
//         neutralIndicators: signalsSummary.signalCounts.HOLD,
//       },
//       supportedCoins: {
//         total: getSupportedSymbols().length,
//         note: "Top 100 CMC coins available on Coinbase",
//       },
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error in getMultiIndicatorSignals:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error in multi-indicator analysis",
//       error: error.message,
//       timeframe: "1h",
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }

// /**
//  * 🎯 Get current market signals summary (Coinbase 1h only)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getCurrentSignals(req, res) {
//   try {
//     const {
//       symbol = "BTC-USD", // Changed to Coinbase format
//     } = req.query;

//     // Force timeframe to 1h (hardcoded)
//     const timeframe = "1h";

//     console.log(`🎯 Getting current 1h signals for ${symbol} (Coinbase)`);

//     // Validate symbol
//     if (!isSymbolSupported(symbol)) {
//       return res.status(400).json({
//         success: false,
//         message: `❌ Symbol ${symbol} not supported`,
//         supportedSymbols: getSupportedSymbols().slice(0, 20),
//         totalSupportedSymbols: getSupportedSymbols().length,
//         note: "Only top 100 CMC coins available on Coinbase are supported",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Get recent data (last 7 days = 168 hours)
//     const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
//     const historicalData = await getHistoricalData(
//       symbol,
//       timeframe,
//       startTime
//     );

//     if (!historicalData || historicalData.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `❌ No recent data found for ${symbol}@${timeframe}`,
//         symbol,
//         timeframe: "1h",
//         dataProvider: "Coinbase Pro API",
//       });
//     }

//     // Calculate indicators
//     const priceData = {
//       opens: historicalData.map((d) => d.open),
//       highs: historicalData.map((d) => d.high),
//       lows: historicalData.map((d) => d.low),
//       closes: historicalData.map((d) => d.close),
//       volumes: historicalData.map((d) => d.volume),
//     };

//     const indicators = calculateAllIndicators(priceData);

//     // Get current (latest) values
//     const latestIndex = historicalData.length - 1;
//     const currentData = {
//       close: historicalData[latestIndex].close,
//       sma12: indicators.sma12?.[latestIndex],
//       sma24: indicators.sma24?.[latestIndex],
//       sma168: indicators.sma168?.[latestIndex],
//       ema24: indicators.ema24?.[latestIndex],
//       rsi: indicators.rsi14[latestIndex],
//       stochK: indicators.stochastic?.k[latestIndex],
//       stochD: indicators.stochastic?.d[latestIndex],
//       stochRsiK: indicators.stochasticRSI?.k[latestIndex],
//       stochRsiD: indicators.stochasticRSI?.d[latestIndex],
//       macdLine: indicators.macd?.macd[latestIndex],
//       macdSignal: indicators.macd?.signal[latestIndex],
//       bbUpper: indicators.bollingerBands?.upper[latestIndex],
//       bbLower: indicators.bollingerBands?.lower[latestIndex],
//       psar: indicators.parabolicSAR?.[latestIndex],
//     };

//     // Get individual signals
//     const individualSignals = generateIndividualSignals(currentData);
//     const signalsSummary = getCurrentSignalsSummary(currentData);

//     // Calculate price change (1 hour ago vs current)
//     const previousClose =
//       historicalData.length > 1
//         ? historicalData[latestIndex - 1].close
//         : currentData.close;
//     const priceChange = currentData.close - previousClose;
//     const priceChangePercent = (priceChange / previousClose) * 100;

//     console.log(`✅ Current 1h signals retrieved for ${symbol}`);

//     res.json({
//       success: true,
//       message: "✅ Current market signals retrieved",
//       symbol,
//       timeframe: "1h", // Always 1h
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//       marketData: {
//         currentPrice: currentData.close,
//         previousPrice: previousClose,
//         priceChange: Math.round(priceChange * 100) / 100,
//         priceChangePercent: Math.round(priceChangePercent * 100) / 100,
//         lastUpdate: formatTime(historicalData[latestIndex].time * 1000),
//       },
//       signals: {
//         individual: individualSignals,
//         summary: signalsSummary,
//         recommendation: {
//           action: signalsSummary.overallSignal,
//           confidence: Math.round(signalsSummary.confidence * 100),
//           strength:
//             signalsSummary.confidence > 0.6
//               ? "STRONG"
//               : signalsSummary.confidence > 0.4
//                 ? "MODERATE"
//                 : "WEAK",
//         },
//       },
//       indicatorValues: {
//         sma12: Math.round((currentData.sma12 || 0) * 100) / 100,
//         sma24: Math.round((currentData.sma24 || 0) * 100) / 100,
//         sma168: Math.round((currentData.sma168 || 0) * 100) / 100,
//         ema24: Math.round((currentData.ema24 || 0) * 100) / 100,
//         rsi14: Math.round((currentData.rsi || 0) * 100) / 100,
//         macdLine: Math.round((currentData.macdLine || 0) * 100) / 100,
//         macdSignal: Math.round((currentData.macdSignal || 0) * 100) / 100,
//       },
//       supportedCoins: {
//         total: getSupportedSymbols().length,
//         note: "Top 100 CMC coins available on Coinbase",
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error in getCurrentSignals:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error getting current signals",
//       error: error.message,
//       timeframe: "1h",
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }
