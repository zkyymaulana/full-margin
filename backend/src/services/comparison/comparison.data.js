/**
 * ═══════════════════════════════════════════════════════════════
 * 💾 COMPARISON DATA MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Modul ini bertanggung jawab untuk:
 * • Pengambilan data indicator dan candle dari database
 * • Penggabungan data candle dengan indicator values
 * • Pengambilan bobot optimal dari database (hasil optimasi sebelumnya)
 * • Fallback ke default weights jika tidak ada hasil optimasi
 *
 * Tujuan:
 * - Menyediakan data yang sudah clean dan merged untuk backtesting
 * - Management bobot indicator dari database/default
 * - Abstraksi database query logic
 * ═══════════════════════════════════════════════════════════════
 */

import { prisma } from "../../lib/prisma.js";

/**
 * Penggabungan data indicator dengan candle prices
 *
 * Tujuan:
 * - Merge indicator values dengan closing price dari candle
 * - Filter data yang tidak memiliki closing price
 * - Prepare data untuk backtesting
 *
 * Proses:
 * 1. Create Map dari candles (time → close price)
 * 2. Map semua indicator records dengan matching close price
 * 3. Filter records yang tidak ada close price-nya
 *
 * @param {Object[]} indicators - Array indicator records dari database
 * @param {number} indicators[].time - Timestamp indicator
 * @param {Object} indicators[].sma - SMA values (20, 50, etc)
 * @param {Object} indicators[].ema - EMA values (20, 50, etc)
 * @param {number} indicators[].rsi - RSI value
 * @param {Object} indicators[].macd - MACD values (line, signal, histogram)
 * @param {Object} indicators[].bollingerBands - BB values (upper, middle, lower)
 * @param {Object} indicators[].stochastic - Stochastic values (%K, %D)
 * @param {Object} indicators[].stochasticRsi - Stochastic RSI values
 * @param {number} indicators[].psar - PSAR value
 *
 * @param {Object[]} candles - Array candle records dari database
 * @param {number} candles[].time - Timestamp candle (BigInt)
 * @param {number} candles[].close - Close price untuk periode
 *
 * @returns {Object[]} Merged data dengan format: {...indicator, close: price}
 */
function mergeIndicatorsWithCandles(indicators, candles) {
  // ✅ Create map untuk O(1) lookup: time → close price
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));

  // ✅ Merge indicators dengan close price, filter yang tidak ada close-nya
  return indicators
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }))
    .filter((i) => i.close != null);
}

/**
 * Pengambilan bobot optimal dari database
 *
 * Tujuan:
 * - Get bobot indicator yang sudah dioptimasi sebelumnya
 * - Use latest optimization jika ada multiple results
 * - Fallback ke default equal weights jika tidak ada hasil optimasi
 *
 * Proses:
 * 1. Get coin ID dari database berdasarkan symbol
 * 2. Get timeframe ID dari database
 * 3. Query IndicatorWeight dengan filter coinId & timeframeId
 * 4. Sort by updatedAt DESC untuk get latest optimization
 * 5. Return bobot + metadata tentang optimization
 *
 * ✅ UPDATED: Always use latest optimization by updatedAt DESC
 * Ini memastikan kita selalu menggunakan hasil optimasi terbaru
 *
 * @param {string} symbol - Symbol cryptocurrency (e.g., "BTC-USD")
 * @param {string} timeframe - Timeframe (e.g., "1h")
 *
 * @returns {Object} Object dengan weights dan metadata
 * @returns {Object} weights - Bobot untuk setiap indicator (SMA, EMA, RSI, etc)
 * @returns {string} source - Sumber bobot ("latest_optimization" atau "default")
 * @returns {Date} optimizedAt - Waktu optimization (jika ada)
 * @returns {Object} performance - Performa dari optimization (jika ada)
 */
async function getBestWeights(symbol, timeframe) {
  // ✅ Get coin ID dari database
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    console.log(`⚠️ ${symbol}: Coin not found in database`);
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // ✅ Get timeframe ID dari database
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.log(`⚠️ Timeframe ${timeframe} not found in database`);
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // ✅ UPDATED: Always get the latest optimization by updatedAt DESC
  // Ini memastikan kita menggunakan hasil optimasi yang PALING BARU
  // Berguna jika ada multiple optimization attempts untuk coin yang sama
  const latest = await prisma.indicatorWeight.findFirst({
    where: {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    },
    orderBy: { updatedAt: "desc" }, // ✅ Sort by latest update
  });

  if (!latest) {
    console.log(
      `⚠️ No optimized weights found for ${symbol}, using default equal weights`
    );
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  // ✅ Log optimization details
  console.log(
    `✅ Using latest optimization for ${symbol} (updated: ${latest.updatedAt.toISOString()})`
  );
  console.log(
    `   ROI: ${latest.roi.toFixed(2)}%, WinRate: ${latest.winRate.toFixed(2)}%`
  );

  return {
    weights: latest.weights,
    source: "latest_optimization",
    optimizedAt: latest.updatedAt,
    performance: {
      roi: latest.roi,
      winRate: latest.winRate,
      maxDrawdown: latest.maxDrawdown,
      sharpeRatio: latest.sharpeRatio,
    },
  };
}

/**
 * Default equal weights untuk semua 8 indicators
 *
 * Tujuan:
 * - Provide fallback weights ketika tidak ada optimization results
 * - Equal weight (1.0) berarti semua indicator dianggap sama penting
 * - Digunakan sebagai baseline jika optimization belum pernah dilakukan
 *
 * Indicators:
 * 1. SMA (Simple Moving Average)
 * 2. EMA (Exponential Moving Average)
 * 3. RSI (Relative Strength Index)
 * 4. MACD (Moving Average Convergence Divergence)
 * 5. BollingerBands (Volatility indicator)
 * 6. Stochastic (Momentum oscillator)
 * 7. StochasticRSI (Combination RSI + Stochastic)
 * 8. PSAR (Parabolic SAR)
 *
 * @returns {Object} Object dengan semua indicators set ke weight 1.0
 */
function defaultWeights() {
  const keys = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];
  // ✅ Create object dengan semua keys set ke weight 1 (equal weights)
  return Object.fromEntries(keys.map((k) => [k, 1]));
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════

export { mergeIndicatorsWithCandles, getBestWeights, defaultWeights };
