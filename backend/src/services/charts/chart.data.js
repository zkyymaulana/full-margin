/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📈 CHART DATA - DATA RETRIEVAL & MERGING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TUJUAN MODUL:
 * ─────────────
 * Modul ini menangani pengambilan data dari database dan penggabungan
 * data candle dengan indicator untuk API response.
 * Tanggung jawab utama:
 * • Ambil coin dan timeframe dari database
 * • Ambil latest indicator weights untuk multi-signal calculation
 * • Ambil indicator data dengan auto-recalculation jika coverage kurang
 * • Gabung candle dengan indicator data
 * • Handle indicator recalculation jika diperlukan
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "../../lib/prisma.js";

/**
 * 🔍 Get coin dan timeframe records dari database
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil coin dan timeframe record dari database berdasarkan
 * symbol dan timeframe string. Digunakan di awal chart request
 * untuk mendapatkan IDs yang diperlukan untuk query selanjutnya.
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 * @param {string} timeframe - Timeframe string (e.g., "1h", "4h", "1d")
 *
 * Return:
 * @returns {object} Object dengan struktur:
 *   {
 *     coin: {
 *       id: 1,
 *       name: "Bitcoin",
 *       logo: "https://..."
 *     },
 *     timeframeRecord: {
 *       id: 1
 *     }
 *   }
 *
 * Error handling:
 * • Throw error jika coin tidak ditemukan di database
 * • Throw error jika timeframe tidak ditemukan di database
 * Errors akan di-catch di controller level
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getCoinAndTimeframe(symbol, timeframe) {
  // ✅ Query coin dari database berdasarkan symbol
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true, name: true, logo: true },
  });

  // ✅ Validasi - coin harus ada di database
  if (!coin) {
    throw new Error(`Coin ${symbol} not found in database`);
  }

  // ✅ Query timeframe dari database
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  // ✅ Validasi - timeframe harus ada di database
  if (!timeframeRecord) {
    throw new Error(`Timeframe ${timeframe} not found in database`);
  }

  return { coin, timeframeRecord };
}

/**
 * ⚖️ Get latest indicator weights untuk multi-signal calculation
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil weight terbaru untuk indicator tertentu dari database.
 * Weights ini digunakan untuk menghitung multi-signal score dengan
 * memberikan kontribusi berbeda untuk setiap indicator.
 *
 * Parameter:
 * @param {number} coinId - ID coin dari database
 * @param {number} timeframeId - ID timeframe dari database
 *
 * Return:
 * @returns {object|null} Weights object atau null jika tidak ada.
 *   Format weights:
 *   {
 *     SMA: 0.15,
 *     EMA: 0.15,
 *     RSI: 0.10,
 *     MACD: 0.15,
 *     Stochastic: 0.10,
 *     StochasticRSI: 0.10,
 *     BollingerBands: 0.10,
 *     PSAR: 0.15
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getLatestWeights(coinId, timeframeId) {
  // ✅ Query weights terbaru (ordered by updatedAt DESC)
  const weightRecord = await prisma.indicatorWeight.findFirst({
    where: { coinId, timeframeId },
    orderBy: { updatedAt: "desc" }, // Ambil yang paling update
  });

  // ✅ Return weights atau null jika tidak ada
  return weightRecord?.weights || null;
}

/**
 * 📊 Get atau recalculate indicators untuk time range
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil indicator data dari database untuk time range tertentu.
 * Jika coverage (jumlah indicator) kurang dari expected count,
 * otomatis trigger recalculation untuk memastikan data lengkap.
 * Ini penting karena tidak semua candle mungkin memiliki indicator
 * (terutama di awal dataset ketika rolling window masih pendek).
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol
 * @param {string} timeframe - Timeframe string
 * @param {number} coinId - ID coin
 * @param {number} timeframeId - ID timeframe
 * @param {number} minTime - Start time range (milliseconds)
 * @param {number} maxTime - End time range (milliseconds)
 * @param {number} expectedCount - Expected jumlah indicator
 *
 * Return:
 * @returns {Array} Array of indicator records dari database
 *
 * Logic:
 * 1. Query indicator dari database untuk time range
 * 2. Jika coverage < expected, trigger recalculation
 * 3. Query lagi untuk mendapatkan indicator yang baru
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getIndicatorsForTimeRange(
  symbol,
  timeframe,
  coinId,
  timeframeId,
  minTime,
  maxTime,
  expectedCount
) {
  // ✅ Query indicator dari database untuk time range
  let indicators = await prisma.indicator.findMany({
    where: {
      coinId,
      timeframeId,
      time: { gte: BigInt(minTime), lte: BigInt(maxTime) }, // Range time
    },
    orderBy: { time: "asc" },
  });

  const coverageBefore = indicators.length;

  // ✅ Check coverage - jika kurang dari expected count, recalculate
  if (coverageBefore < expectedCount) {
    console.log(
      `[AUTO] Indicator coverage ${coverageBefore}/${expectedCount} → recalculating...`
    );
    try {
      // ✅ Import dan trigger indicator calculation
      const { calculateAndSaveIndicators } = await import(
        "../indicators/indicator.service.js"
      );
      await calculateAndSaveIndicators(symbol, timeframe, minTime, maxTime);

      // ✅ Query lagi setelah recalculation
      indicators = await prisma.indicator.findMany({
        where: {
          coinId,
          timeframeId,
          time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
        },
        orderBy: { time: "asc" },
      });
      console.log(
        `Found ${indicators.length}/${expectedCount} indicators after recalc.`
      );
    } catch (err) {
      console.error(`Indicator calculation failed:`, err.message);
    }
  }

  return indicators;
}

/**
 * 🔗 Merge candles dengan indicators dan format untuk response
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Menggabungkan candle data dengan indicator data yang sudah
 * diformat. Setiap candle akan memiliki indicator dan multi-signal
 * yang sesuai dengan timestamp-nya.
 *
 * Parameter:
 * @param {Array} candles - Array of candle objects dari database
 * @param {Array} indicators - Array of indicator objects dari database
 * @param {object} weights - Weights untuk multi-signal calculation
 *
 * Return:
 * @returns {Array} Array of merged objects dengan struktur:
 *   [
 *     {
 *       time: "1234567890000",
 *       open: 45000.50,
 *       high: 45500.00,
 *       low: 44800.25,
 *       close: 45300.75,
 *       volume: 125000.00,
 *       multiSignal: { ... },    // Dari formatMultiSignalFromDB
 *       indicators: { ... }      // Dari formatIndicators
 *     },
 *     ...
 *   ]
 *
 * Logic:
 * 1. Create map untuk quick lookup indicator by time
 * 2. Iterate setiap candle
 * 3. Cari indicator untuk candle tersebut
 * 4. Format indicator dan multi-signal
 * 5. Return merged object
 *
 * ────────────────────────────────────────────────────────────
 */
export function mergeChartData(candles, indicators, weights) {
  // ✅ Create map untuk O(1) lookup indicator by time
  // Map key = timestamp (number), value = indicator record
  const indicatorMap = new Map(indicators.map((i) => [Number(i.time), i]));

  // ✅ Merge setiap candle dengan indicator-nya
  return candles.map((c) => {
    // ✅ Cari indicator yang sesuai dengan candle time
    const ind = indicatorMap.get(Number(c.time));

    // ✅ Format multi-signal dari indicator (atau null jika tidak ada)
    const multiSignal = formatMultiSignalFromDB(ind, weights);

    // ✅ Return merged object dengan struktur lengkap
    return {
      time: c.time.toString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      multiSignal,
      indicators: ind ? formatIndicators(ind) : null,
    };
  });
}

/**
 * 📐 Format individual indicators dari database
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengkonversi field indicator dari database menjadi struktur
 * yang user-friendly untuk API response. Database menyimpan semua
 * indicator values flat, kami reorganize menjadi struktur nested.
 *
 * Parameter:
 * @param {object} ind - Indicator record dari database
 *
 * Return:
 * @returns {object} Formatted indicators dengan struktur:
 *   {
 *     sma: { 20: 45000, 50: 44500, signal: "buy" },
 *     ema: { 20: 45100, 50: 44600, signal: "buy" },
 *     rsi: { 14: 65.5, signal: "overbought" },
 *     macd: { macd: 150, signalLine: 140, histogram: 10, signal: "buy" },
 *     bollingerBands: { upper: 46000, middle: 45000, lower: 44000, signal: "neutral" },
 *     stochastic: { "%K": 75, "%D": 70, signal: "overbought" },
 *     stochasticRsi: { "%K": 80, "%D": 75, signal: "buy" },
 *     parabolicSar: { value: 44500, signal: "uptrend" }
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
function formatIndicators(ind) {
  return {
    sma: {
      20: ind.sma20,
      50: ind.sma50,
      signal: ind.smaSignal || "neutral",
    },
    ema: {
      20: ind.ema20,
      50: ind.ema50,
      signal: ind.emaSignal || "neutral",
    },
    rsi: {
      14: ind.rsi,
      signal: ind.rsiSignal || "neutral",
    },
    macd: {
      macd: ind.macd,
      signalLine: ind.macdSignalLine,
      histogram: ind.macdHist,
      signal: ind.macdSignal || "neutral",
    },
    bollingerBands: {
      upper: ind.bbUpper,
      middle: ind.bbMiddle,
      lower: ind.bbLower,
      signal: ind.bbSignal || "neutral",
    },
    stochastic: {
      "%K": ind.stochK,
      "%D": ind.stochD,
      signal: ind.stochSignal || "neutral",
    },
    stochasticRsi: {
      "%K": ind.stochRsiK,
      "%D": ind.stochRsiD,
      signal: ind.stochRsiSignal || "neutral",
    },
    parabolicSar: {
      value: ind.psar,
      signal: ind.psarSignal || "neutral",
    },
  };
}

/**
 * 🎯 Format multi-signal dari database
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengkonversi multi-signal data dari database menjadi format
 * yang user-friendly. Multi-signal adalah agregasi dari semua
 * indicator dengan weights untuk memberikan keputusan trading
 * yang lebih akurat.
 *
 * Parameter:
 * @param {object|null} ind - Indicator record dari database (bisa null)
 * @param {object|null} weights - Weights untuk category score calculation
 *
 * Return:
 * @returns {object|null} Formatted multi-signal atau null jika ind null
 *   {
 *     signal: "buy",                  // "buy" | "sell" | "neutral"
 *     strength: 0.750,               // 0.0 - 1.0, confidence level
 *     finalScore: 0.45,              // -1.0 to 1.0, overall direction
 *     signalLabel: "STRONG BUY",     // Label untuk UI
 *     categoryScores: {
 *       trend: 0.50,                 // Combined score dari trend indicators
 *       momentum: 0.65,              // Combined score dari momentum indicators
 *       volatility: 0.40             // Combined score dari volatility indicators
 *     },
 *     source: "db"
 *   }
 *
 * Logic:
 * 1. Return null jika indicator tidak ada
 * 2. Extract finalScore dan signalStrength dari database
 * 3. Determine signal berdasarkan finalScore sign
 * 4. Calculate signalLabel berdasarkan strength
 * 5. Calculate categoryScores menggunakan weights
 * 6. Return formatted object
 *
 * ────────────────────────────────────────────────────────────
 */
function formatMultiSignalFromDB(ind, weights = null) {
  // ✅ Return null jika tidak ada indicator
  if (!ind) return null;

  // ✅ Extract values dari database
  const dbFinalScore = ind.finalScore ?? 0;
  const dbStrength = ind.signalStrength ?? 0;

  // ✅ Determine signal berdasarkan finalScore
  let signal = "neutral";
  let finalScore = dbFinalScore;
  let strength = dbStrength;

  if (finalScore > 0) {
    signal = "buy"; // finalScore positive = buy signal
  } else if (finalScore < 0) {
    signal = "sell"; // finalScore negative = sell signal
  } else {
    signal = "neutral"; // finalScore zero = neutral
    strength = 0; // No strength untuk neutral signal
  }

  // ✅ Calculate signalLabel berdasarkan strength
  // Strength >= 0.6 adalah "STRONG", di bawah itu adalah regular
  let signalLabel = "NEUTRAL";
  if (signal === "buy") {
    signalLabel = strength >= 0.6 ? "STRONG BUY" : "BUY";
  } else if (signal === "sell") {
    signalLabel = strength >= 0.6 ? "STRONG SELL" : "SELL";
  }

  // ✅ Calculate categoryScores jika weights tersedia
  // Ini mengagregasi signal dari indicators di setiap kategori
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    // ✅ Helper function: Convert signal string ke numeric score
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // ✅ Trend category: SMA, EMA, PSAR
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);

    // ✅ Momentum category: RSI, MACD, Stochastic, StochasticRSI
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);

    // ✅ Volatility category: Bollinger Bands
    const volatilityScore =
      signalToScore(ind.bbSignal) * (weights.BollingerBands || 0);

    // ✅ Set categoryScores dengan fixed decimal places
    categoryScores = {
      trend: parseFloat(trendScore.toFixed(2)),
      momentum: parseFloat(momentumScore.toFixed(2)),
      volatility: parseFloat(volatilityScore.toFixed(2)),
    };
  }

  // ✅ Return formatted multi-signal object
  return {
    signal,
    strength: parseFloat(strength.toFixed(3)),
    finalScore: parseFloat(finalScore.toFixed(2)),
    signalLabel,
    categoryScores,
    source: "db",
  };
}
