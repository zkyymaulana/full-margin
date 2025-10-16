import { prisma } from "../lib/prisma.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js"; // ✅ Import indicator service

// Signal analysis functions
function analyzeMovingAverages(ma5, ma20, currentPrice) {
  if (!ma5 || !ma20 || !currentPrice) return "neutral";

  // Price above both MAs and MA5 > MA20 = bullish
  if (currentPrice > ma5 && currentPrice > ma20 && ma5 > ma20) return "buy";
  // Price below both MAs and MA5 < MA20 = bearish
  if (currentPrice < ma5 && currentPrice < ma20 && ma5 < ma20) return "sell";

  return "neutral";
}

function analyzeEMA(ema5, ema20, currentPrice) {
  if (!ema5 || !ema20 || !currentPrice) return "neutral";

  // Price above both EMAs and EMA5 > EMA20 = bullish
  if (currentPrice > ema5 && currentPrice > ema20 && ema5 > ema20) return "buy";
  // Price below both EMAs and EMA5 < EMA20 = bearish
  if (currentPrice < ema5 && currentPrice < ema20 && ema5 < ema20)
    return "sell";

  return "neutral";
}

function analyzeRSI(rsi) {
  if (!rsi) return "neutral";

  if (rsi > 70) return "sell"; // Overbought
  if (rsi < 30) return "buy"; // Oversold

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

function analyzeMACD(macd, signal, histogram) {
  if (!macd || !signal || histogram === null) return "neutral";

  // MACD above signal line = bullish
  if (macd > signal && histogram > 0) return "buy";
  // MACD below signal line = bearish
  if (macd < signal && histogram < 0) return "sell";

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
    const limit = Math.min(10000, parseInt(req.query.limit) || 2000); // ✅ Increase default to 2000

    // ✅ Cek apakah ada indicator data, jika tidak ada maka hitung otomatis
    let data = await prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "desc" }, // ✅ DESC untuk data terbaru dulu
      take: limit,
    });

    // Jika indicator kosong atau sedikit, coba hitung otomatis
    if (data.length === 0) {
      console.log(`📊 Indicator ${symbol} kosong, menghitung otomatis...`);

      // Cek apakah ada candle data
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
        // Hitung indicator secara otomatis
        await calculateAndSaveIndicators(symbol, timeframe, "full");

        // Ambil data indicator yang baru dihitung
        data = await prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" }, // ✅ DESC untuk data terbaru dulu
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
      orderBy: { time: "desc" }, // ✅ DESC untuk konsistensi
    });

    // Create a map for quick candle lookup
    const candleMap = new Map(
      candleData.map((c) => [c.time.toString(), c.close])
    );

    // Transform data to organize by indicator categories with signals
    const organizedData = data.map((item) => {
      const currentPrice = candleMap.get(item.time.toString()) || null;

      return {
        time: Number(item.time), // ✅ PERBAIKAN: Convert ke number (milidetik) untuk konsistensi
        movingAverages: {
          ma5: item.sma5,
          ma20: item.sma20,
          signal: analyzeMovingAverages(item.sma5, item.sma20, currentPrice),
        },
        ema: {
          ema5: item.ema5,
          ema20: item.ema20,
          signal: analyzeEMA(item.ema5, item.ema20, currentPrice),
        },
        rsi: {
          value: item.rsi,
          signal: analyzeRSI(item.rsi),
        },
        stochastic: {
          k: item.stochK,
          d: item.stochD,
          signal: analyzeStochastic(item.stochK, item.stochD),
        },
        stochasticRsi: {
          k: item.stochRsiK,
          d: item.stochRsiD,
          signal: analyzeStochasticRSI(item.stochRsiK, item.stochRsiD),
        },
        macd: {
          macd: item.macd,
          signal: item.macdSignal,
          histogram: item.macdHist,
          tradeSignal: analyzeMACD(item.macd, item.macdSignal, item.macdHist),
        },
        bollingerBands: {
          upper: item.bbUpper,
          lower: item.bbLower,
          signal: analyzeBollingerBands(
            currentPrice,
            item.bbUpper,
            item.bbLower
          ),
        },
        parabolicSar: {
          value: item.psar,
          signal: analyzeParabolicSAR(currentPrice, item.psar),
        },
      };
    });

    res.json({
      success: true,
      symbol,
      timeframe,
      total: organizedData.length,
      data: organizedData, // ✅ Data sudah dalam urutan terbaru dulu
    });
  } catch (err) {
    console.error(`❌ getIndicators error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
