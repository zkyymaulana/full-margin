// /**
//  * 🎮 Indicators Controller - Business Logic for Technical Indicators (Coinbase Edition)
//  * Handles HTTP requests and coordinates between routes and services
//  *
//  * @description Controller untuk mengelola logika bisnis indikator teknikal
//  * @features Data fetching, indicator calculation, response formatting
//  */

// import { getHistoricalData } from "../services/data.service.js";
// import {
//   getTop100WithCache,
//   loadCachedResults,
// } from "../services/marketcap.service.js";
// import { calculateAllIndicators } from "../services/indicators.service.js";
// import {
//   cacheWrapper,
//   getCachedIndicatorData,
//   cacheIndicatorData,
// } from "../utils/cache.js";
// import { formatTime, getCurrentTime } from "../utils/helpers.js";
// import { config } from "../config/index.js";

// /**
//  * 📊 Get calculated indicators for default parameters (Coinbase 1h only)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getIndicators(req, res) {
//   try {
//     const {
//       symbol = "BTC-USD", // Changed to Coinbase format
//       limit = 1000, // Increased default limit for more data
//     } = req.query;

//     // Force timeframe to 1h (hardcoded)
//     const timeframe = "1h";

//     console.log(`📊 Getting 1h indicators for ${symbol} (Coinbase)`);

//     // Validate symbol is supported
//     if (!isSymbolSupported(symbol)) {
//       return res.status(400).json({
//         success: false,
//         message: `❌ Symbol ${symbol} not supported`,
//         supportedSymbols: getSupportedSymbols().slice(0, 20), // Show first 20 as example
//         totalSupportedSymbols: getSupportedSymbols().length,
//         note: "Only top 100 CMC coins available on Coinbase are supported",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Try to get from cache first
//     const cacheKey = `indicators_${symbol}_${timeframe}_${limit}`;
//     const cachedData = getCachedIndicatorData(symbol, "all", {
//       timeframe,
//       limit,
//     });

//     if (cachedData) {
//       return res.json({
//         success: true,
//         message: "✅ Indicators data retrieved from cache",
//         symbol,
//         timeframe,
//         dataProvider: "Coinbase Pro API",
//         totalSupportedCoins: getSupportedSymbols().length,
//         data: cachedData,
//         cached: true,
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Use more recent start time for better 1h data coverage
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
//         timeframe,
//         dataProvider: "Coinbase Pro API",
//         note: "Make sure the symbol is available on Coinbase",
//         supportedSymbolsCount: getSupportedSymbols().length,
//       });
//     }

//     // Prepare price data for calculations
//     const priceData = {
//       opens: historicalData.map((d) => d.open),
//       highs: historicalData.map((d) => d.high),
//       lows: historicalData.map((d) => d.low),
//       closes: historicalData.map((d) => d.close),
//       volumes: historicalData.map((d) => d.volume),
//     };

//     // Calculate all indicators
//     const indicators = calculateAllIndicators(priceData);

//     // Combine historical data with indicators
//     const enrichedData = historicalData.map((candle, index) => ({
//       time: candle.time,
//       datetime: formatTime(candle.time * 1000),
//       open: candle.open,
//       high: candle.high,
//       low: candle.low,
//       close: candle.close,
//       volume: candle.volume,
//       // Moving Averages (adjusted for 1h timeframe)
//       sma12: indicators.sma12?.[index], // 12 hours
//       sma24: indicators.sma24?.[index], // 24 hours (1 day)
//       sma168: indicators.sma168?.[index], // 168 hours (1 week)
//       ema24: indicators.ema24?.[index], // 24 hours
//       // Momentum Indicators
//       rsi14: indicators.rsi14[index],
//       // Oscillators
//       stochK: indicators.stochastic?.k[index],
//       stochD: indicators.stochastic?.d[index],
//       stochRsiK: indicators.stochasticRSI?.k[index],
//       stochRsiD: indicators.stochasticRSI?.d[index],
//       // Trend Indicators
//       macdLine: indicators.macd?.macd[index],
//       macdSignal: indicators.macd?.signal[index],
//       macdHistogram: indicators.macd?.histogram[index],
//       bbUpper: indicators.bollingerBands?.upper[index],
//       bbMiddle: indicators.bollingerBands?.middle[index],
//       bbLower: indicators.bollingerBands?.lower[index],
//       psar: indicators.parabolicSAR?.[index],
//     }));

//     // Apply limit if specified
//     const limitedData = limit ? enrichedData.slice(-limit) : enrichedData;

//     // Cache the result (1 hour TTL for hourly data)
//     cacheIndicatorData(
//       symbol,
//       "all",
//       { timeframe, limit },
//       limitedData,
//       60 * 60 * 1000
//     );

//     console.log(
//       `✅ Calculated 1h indicators for ${limitedData.length} data points`
//     );

//     res.json({
//       success: true,
//       message: "✅ Indicators calculated successfully",
//       symbol,
//       timeframe: "1h", // Always 1h
//       dataProvider: "Coinbase Pro API",
//       dataPoints: limitedData.length,
//       totalDataAvailable: enrichedData.length,
//       dateRange: {
//         start: formatTime(limitedData[0].time * 1000),
//         end: formatTime(limitedData[limitedData.length - 1].time * 1000),
//       },
//       supportedCoins: {
//         total: getSupportedSymbols().length,
//         note: "Top 100 CMC coins available on Coinbase",
//         examples: getSupportedSymbols().slice(0, 10),
//       },
//       data: limitedData,
//       cached: false,
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error in getIndicators:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error calculating indicators",
//       error: error.message,
//       symbol: req.query.symbol,
//       timeframe: "1h",
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }

// /**
//  * 🧮 Calculate indicators with custom parameters (Coinbase 1h only)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function calculateIndicators(req, res) {
//   try {
//     const {
//       symbol = "BTC-USD", // Changed to Coinbase format
//       startTime,
//       endTime,
//       indicators: requestedIndicators = "all",
//     } = req.query;

//     // Force timeframe to 1h (hardcoded)
//     const timeframe = "1h";

//     console.log(`🧮 Calculating custom 1h indicators for ${symbol} (Coinbase)`);

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

//     // Validate parameters
//     if (startTime && isNaN(Number(startTime))) {
//       return res.status(400).json({
//         success: false,
//         message: "❌ Invalid startTime parameter",
//         timeframe: "1h",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Use more recent start time for better hourly data
//     const finalStartTime = startTime
//       ? Number(startTime)
//       : new Date("2024-01-01").getTime();
//     const finalEndTime = endTime ? Number(endTime) : null;

//     // Fetch historical data
//     const historicalData = await getHistoricalData(
//       symbol,
//       timeframe,
//       finalStartTime,
//       finalEndTime
//     );

//     if (!historicalData || historicalData.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `❌ No historical data found for specified parameters`,
//         symbol,
//         timeframe: "1h",
//         dataProvider: "Coinbase Pro API",
//         startTime: formatTime(finalStartTime),
//         endTime: finalEndTime ? formatTime(finalEndTime) : "latest",
//         supportedSymbolsCount: getSupportedSymbols().length,
//       });
//     }

//     // Prepare price data
//     const priceData = {
//       opens: historicalData.map((d) => d.open),
//       highs: historicalData.map((d) => d.high),
//       lows: historicalData.map((d) => d.low),
//       closes: historicalData.map((d) => d.close),
//       volumes: historicalData.map((d) => d.volume),
//     };

//     // Calculate requested indicators
//     const allIndicators = calculateAllIndicators(priceData);

//     // Filter indicators based on request
//     let responseIndicators = {};
//     if (requestedIndicators === "all") {
//       responseIndicators = allIndicators;
//     } else {
//       const requested = requestedIndicators.split(",").map((i) => i.trim());
//       for (const indicator of requested) {
//         if (allIndicators[indicator]) {
//           responseIndicators[indicator] = allIndicators[indicator];
//         }
//       }
//     }

//     // Get latest values for summary
//     const latestIndex = historicalData.length - 1;
//     const latestValues = {};

//     Object.keys(responseIndicators).forEach((key) => {
//       const indicator = responseIndicators[key];
//       if (Array.isArray(indicator)) {
//         latestValues[key] = indicator[latestIndex];
//       } else if (typeof indicator === "object" && indicator !== null) {
//         latestValues[key] = {};
//         Object.keys(indicator).forEach((subKey) => {
//           latestValues[key][subKey] = indicator[subKey][latestIndex];
//         });
//       }
//     });

//     console.log(
//       `✅ Custom 1h indicators calculated for ${historicalData.length} data points`
//     );

//     res.json({
//       success: true,
//       message: "✅ Custom indicators calculated successfully",
//       symbol,
//       timeframe: "1h", // Always 1h
//       dataProvider: "Coinbase Pro API",
//       dataPoints: historicalData.length,
//       dateRange: {
//         start: formatTime(historicalData[0].time * 1000),
//         end: formatTime(historicalData[latestIndex].time * 1000),
//       },
//       requestedIndicators: requestedIndicators.split(",").map((i) => i.trim()),
//       latestPrice: historicalData[latestIndex].close,
//       latestValues,
//       indicators: responseIndicators,
//       supportedCoins: {
//         total: getSupportedSymbols().length,
//         note: "Top 100 CMC coins available on Coinbase",
//       },
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error in calculateIndicators:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error calculating custom indicators",
//       error: error.message,
//       timeframe: "1h",
//       dataProvider: "Coinbase Pro API",
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }

// /**
//  * 📋 Get list of supported symbols (All USD pairs available on Coinbase)
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getSupportedSymbolsList(req, res) {
//   try {
//     // Fetch fresh list of available products from Coinbase
//     const availableProducts = await getAvailableProducts();

//     if (!availableProducts || availableProducts.length === 0) {
//       return res.status(503).json({
//         success: false,
//         message: "❌ Unable to fetch available symbols from Coinbase",
//         dataProvider: "Coinbase Pro API",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     const supportedSymbols = getSupportedSymbols();

//     res.json({
//       success: true,
//       message: "✅ Supported symbols retrieved",
//       dataProvider: "Coinbase Pro API",
//       timeframe: "1h",
//       totalSymbols: supportedSymbols.length,
//       description: "All USD trading pairs available on Coinbase",
//       symbols: supportedSymbols,
//       details: availableProducts.map((product) => ({
//         symbol: product.id,
//         baseCurrency: product.base_currency,
//         displayName: product.display_name,
//         status: product.status,
//       })),
//       examples: {
//         majorCoins: supportedSymbols.slice(0, 10),
//         sampleUsage: ["BTC-USD", "ETH-USD", "ADA-USD", "DOT-USD", "LINK-USD"],
//       },
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error getting supported symbols:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error retrieving supported symbols",
//       error: error.message,
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }

// /**
//  * 📊 Get detailed market cap analysis and coin matching results
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
// export async function getMarketCapAnalysis(req, res) {
//   try {
//     const { refresh = false } = req.query;
//     const forceRefresh = refresh === "true" || refresh === true;

//     console.log(`📊 Getting market cap analysis (refresh: ${forceRefresh})`);

//     // Get market cap data with optional refresh
//     const marketCapData = await getTop100WithCache(forceRefresh);

//     if (!marketCapData.success) {
//       return res.status(500).json({
//         success: false,
//         message: "❌ Failed to retrieve market cap data",
//         error: marketCapData.error || "Unknown error",
//         timestamp: getCurrentTime().iso,
//       });
//     }

//     // Get cached data info
//     const cachedInfo = await loadCachedResults();
//     const cacheAge = cachedInfo
//       ? Math.round(
//           (Date.now() - new Date(cachedInfo.timestamp).getTime()) / 1000 / 60
//         )
//       : null;

//     res.json({
//       success: true,
//       message: "✅ Market cap analysis retrieved successfully",
//       dataProvider: "CoinGecko + Coinbase Pro API",
//       analysis: {
//         totalCoinsAnalyzed: marketCapData.metadata?.coinGeckoTotal || 0,
//         totalCoinbaseUsdPairs: marketCapData.metadata?.coinbaseUsdPairs || 0,
//         matchedCoins: marketCapData.total,
//         matchRate: marketCapData.metadata?.matchRate || "0%",
//         processingTime: marketCapData.processingTime || "N/A",
//       },
//       cache: {
//         cacheAge: cacheAge ? `${cacheAge} minutes` : "No cache",
//         lastUpdated: marketCapData.timestamp,
//         forceRefreshed: forceRefresh,
//       },
//       topCoins: {
//         top10: marketCapData.details?.slice(0, 10) || [],
//         top20: marketCapData.details?.slice(0, 20) || [],
//         all: marketCapData.details || [],
//       },
//       tradingPairs: {
//         total: marketCapData.pairs?.length || 0,
//         pairs: marketCapData.pairs || [],
//         examples: marketCapData.pairs?.slice(0, 15) || [],
//       },
//       features: [
//         "Real-time market cap ranking from CoinGecko",
//         "Live Coinbase availability checking",
//         "Automatic cross-platform matching",
//         "Smart caching with 1-hour TTL",
//         "Fallback support for reliability",
//       ],
//       endpoints: {
//         refresh: "GET /api/indicators/marketcap?refresh=true",
//         symbols: "GET /api/indicators/symbols",
//         indicators: "GET /api/indicators?symbol=BTC-USD",
//       },
//       timestamp: getCurrentTime().iso,
//     });
//   } catch (error) {
//     console.error("❌ Error in getMarketCapAnalysis:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "❌ Error retrieving market cap analysis",
//       error: error.message,
//       timestamp: getCurrentTime().iso,
//     });
//   }
// }
