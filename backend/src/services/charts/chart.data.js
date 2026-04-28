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
import { formatMultiSignalFromDB } from "../../utils/multiSignal-formater.js";

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
 *
 * Return:
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
 *
 * Return:
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
 *
 * Return:
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
  expectedCount,
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
      `[AUTO] Indicator coverage ${coverageBefore}/${expectedCount} → recalculating...`,
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
        `Found ${indicators.length}/${expectedCount} indicators after recalc.`,
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
 *
 * Return:
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
 *
 * Return:
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
