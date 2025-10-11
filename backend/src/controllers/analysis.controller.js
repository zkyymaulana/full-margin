import { getRecentCandlesFromDB } from "../services/candle.service.js";
import { saveIndicator } from "../services/indicator.service.js";
import { saveSignal } from "../services/signal.service.js";
import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  StochasticOscillator,
  StochasticRSI,
  ParabolicSAR,
  performMultiIndicatorAnalysis,
} from "../../../code/indicators.js";

/**
 * 📊 Complete Analysis Pipeline for Cryptocurrency Indicators and Trading Signals
 * GET /api/analysis/:symbol
 */
export async function analyzeSymbol(req, res) {
  try {
    const { symbol } = req.params;
    const userId = req.user?.id || 1; // Default user for testing, should come from auth

    console.log(`🔍 Starting analysis pipeline for ${symbol}`);

    // Step 1: Fetch latest 200 candles from database
    const candles = await getRecentCandlesFromDB(symbol, 200);

    if (!candles || candles.length < 50) {
      return res.status(400).json({
        success: false,
        message: `Insufficient candle data for ${symbol}. Need at least 50 candles, got ${candles?.length || 0}`,
      });
    }

    console.log(`📈 Retrieved ${candles.length} candles for ${symbol}`);

    // Extract OHLCV arrays for indicator calculations
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const times = candles.map((c) => c.time);

    // Step 2: Calculate all indicators
    console.log(`🧮 Computing indicators for ${symbol}`);

    const sma20 = SMA(closes, 20);
    const ema20 = EMA(closes, 20);
    const rsi = RSI(closes, 14);
    const macd = MACD(closes, 12, 26, 9);
    const bb = BollingerBands(closes, 20, 2);
    const stoch = StochasticOscillator(highs, lows, closes, 14, 3);
    const stochRsi = StochasticRSI(closes, 14, 14, 3, 3);
    const psar = ParabolicSAR(highs, lows, closes, 0.02, 0.2);

    // Get latest candle data
    const latestIndex = candles.length - 1;
    const latestCandle = candles[latestIndex];
    const latestTime = BigInt(latestCandle.time * 1000); // Convert to milliseconds for database

    // Step 3: Perform multi-indicator analysis
    console.log(`🎯 Performing multi-indicator analysis for ${symbol}`);

    const analysis = performMultiIndicatorAnalysis(
      highs,
      lows,
      closes,
      volumes
    );

    // Step 4: Prepare indicator data for database storage
    const indicatorData = {
      time: latestTime,
      sma20: sma20[latestIndex],
      ema20: ema20[latestIndex],
      rsi: rsi[latestIndex],
      macd: macd.macd[latestIndex],
      macdSignal: macd.signal[latestIndex],
      macdHist: macd.histogram[latestIndex],
      bbUpper: bb.upper[latestIndex],
      bbLower: bb.lower[latestIndex],
      stochK: stoch.k[latestIndex],
      stochD: stoch.d[latestIndex],
      stochRsiK: stochRsi.k[latestIndex],
      stochRsiD: stochRsi.d[latestIndex],
      psar: psar[latestIndex],
    };

    // Step 5: Save indicator data to database
    console.log(`💾 Saving indicator data for ${symbol}`);
    await saveIndicator(symbol, indicatorData);

    // Step 6: Save signal if action is not HOLD
    let savedSignal = null;
    if (analysis.finalSignal !== "HOLD") {
      console.log(
        `📊 Saving ${analysis.finalSignal} signal for ${symbol} (confidence: ${analysis.confidence})`
      );
      savedSignal = await saveSignal(
        userId,
        symbol,
        analysis.finalSignal,
        analysis.confidence
      );
    }

    // Step 7: Format response data
    const responseData = {
      success: true,
      symbol,
      timestamp: new Date().toISOString(),
      indicators: {
        sma20: indicatorData.sma20,
        ema20: indicatorData.ema20,
        rsi: indicatorData.rsi,
        macd: {
          line: indicatorData.macd,
          signal: indicatorData.macdSignal,
          hist: indicatorData.macdHist,
        },
        bollinger: {
          upper: indicatorData.bbUpper,
          lower: indicatorData.bbLower,
        },
        stochastic: {
          k: indicatorData.stochK,
          d: indicatorData.stochD,
        },
        stochRsi: {
          k: indicatorData.stochRsiK,
          d: indicatorData.stochRsiD,
        },
        psar: indicatorData.psar,
      },
      combinedSignal: {
        finalSignal: analysis.finalSignal,
        combinedScore: analysis.combinedScore,
        confidence: analysis.confidence,
        timestamp: analysis.timestamp,
      },
      signalSaved: savedSignal !== null,
      candleCount: candles.length,
    };

    console.log(
      `✅ ${symbol}: ${analysis.finalSignal} (${analysis.combinedScore})`
    );

    res.json(responseData);
  } catch (error) {
    console.error(`❌ Error analyzing ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      message: "Internal server error during analysis",
      error: error.message,
    });
  }
}

/**
 * 📊 Batch Analysis for Multiple Symbols
 * POST /api/analysis/batch
 * Body: { symbols: ["BTC-USD", "ETH-USD", ...] }
 */
export async function analyzeBatch(req, res) {
  try {
    const { symbols } = req.body;
    const userId = req.user?.id || 1;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of symbols",
      });
    }

    console.log(`🔄 Starting batch analysis for ${symbols.length} symbols`);

    const results = [];
    const errors = [];

    // Process each symbol
    for (const symbol of symbols) {
      try {
        // Fetch candles
        const candles = await getRecentCandlesFromDB(symbol, 200);

        if (!candles || candles.length < 50) {
          errors.push({
            symbol,
            error: `Insufficient data: ${candles?.length || 0} candles`,
          });
          continue;
        }

        // Extract arrays
        const highs = candles.map((c) => c.high);
        const lows = candles.map((c) => c.low);
        const closes = candles.map((c) => c.close);
        const volumes = candles.map((c) => c.volume);

        // Perform analysis
        const analysis = performMultiIndicatorAnalysis(
          highs,
          lows,
          closes,
          volumes
        );

        // Prepare and save indicator data
        const latestIndex = candles.length - 1;
        const latestTime = BigInt(candles[latestIndex].time * 1000);

        const indicatorData = {
          time: latestTime,
          sma20: SMA(closes, 20)[latestIndex],
          ema20: EMA(closes, 20)[latestIndex],
          rsi: RSI(closes, 14)[latestIndex],
          macd: MACD(closes, 12, 26, 9).macd[latestIndex],
          macdSignal: MACD(closes, 12, 26, 9).signal[latestIndex],
          macdHist: MACD(closes, 12, 26, 9).histogram[latestIndex],
          bbUpper: BollingerBands(closes, 20, 2).upper[latestIndex],
          bbLower: BollingerBands(closes, 20, 2).lower[latestIndex],
          stochK: StochasticOscillator(highs, lows, closes, 14, 3).k[
            latestIndex
          ],
          stochD: StochasticOscillator(highs, lows, closes, 14, 3).d[
            latestIndex
          ],
          stochRsiK: StochasticRSI(closes, 14, 14, 3, 3).k[latestIndex],
          stochRsiD: StochasticRSI(closes, 14, 14, 3, 3).d[latestIndex],
          psar: ParabolicSAR(highs, lows, closes, 0.02, 0.2)[latestIndex],
        };

        await saveIndicator(symbol, indicatorData);

        // Save signal if not HOLD
        let signalSaved = false;
        if (analysis.finalSignal !== "HOLD") {
          await saveSignal(
            userId,
            symbol,
            analysis.finalSignal,
            analysis.confidence
          );
          signalSaved = true;
        }

        results.push({
          symbol,
          signal: analysis.finalSignal,
          confidence: analysis.confidence,
          score: analysis.combinedScore,
          signalSaved,
        });

        console.log(
          `✅ ${symbol}: ${analysis.finalSignal} (${analysis.combinedScore})`
        );
      } catch (symbolError) {
        console.error(`❌ Error processing ${symbol}:`, symbolError);
        errors.push({
          symbol,
          error: symbolError.message,
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in batch analysis:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during batch analysis",
      error: error.message,
    });
  }
}
