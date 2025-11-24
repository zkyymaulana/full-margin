import { prisma } from "../lib/prisma.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

/* 🕒 Formatter tanggal lokal Indonesia (Asia/Jakarta) */
function formatReadableDate(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

/**
 * 🎯 Helper: Calculate Category Scores from Latest Indicators
 * Digunakan untuk menghitung skor per kategori (trend, momentum, volatility)
 * @param {Object} indicators - Latest indicators object
 * @param {Object} weights - Optimized weights from database
 * @returns {Object} { trend, momentum, volatility }
 */
function calculateCategoryScores(indicators, weights) {
  // Helper untuk convert signal string ke numeric value
  const toSignalValue = (signal) => {
    if (!signal) return 0;
    const normalized = signal.toLowerCase();
    if (normalized === "buy" || normalized === "strong_buy") return 1;
    if (normalized === "sell" || normalized === "strong_sell") return -1;
    return 0;
  };

  // Safe weight extraction dengan default 0
  const w = {
    SMA: weights?.SMA || 0,
    EMA: weights?.EMA || 0,
    PSAR: weights?.PSAR || 0,
    RSI: weights?.RSI || 0,
    MACD: weights?.MACD || 0,
    Stochastic: weights?.Stochastic || 0,
    StochasticRSI: weights?.StochasticRSI || 0,
    BollingerBands: weights?.BollingerBands || 0,
  };

  // Extract signals dari indicators
  const signals = {
    sma: toSignalValue(indicators?.sma?.signal),
    ema: toSignalValue(indicators?.ema?.signal),
    psar: toSignalValue(indicators?.parabolicSar?.signal),
    rsi: toSignalValue(indicators?.rsi?.signal),
    macd: toSignalValue(indicators?.macd?.signal),
    stochastic: toSignalValue(indicators?.stochastic?.signal),
    stochasticRsi: toSignalValue(indicators?.stochasticRsi?.signal),
    bb: toSignalValue(indicators?.bollingerBands?.signal),
  };

  // 1️⃣ TREND CATEGORY (SMA + EMA + PSAR)
  const trendWeightSum = w.SMA + w.EMA + w.PSAR;
  const trendScore =
    trendWeightSum > 0
      ? (signals.sma * w.SMA + signals.ema * w.EMA + signals.psar * w.PSAR) /
        trendWeightSum
      : 0;

  // 2️⃣ MOMENTUM CATEGORY (RSI + MACD + Stochastic + StochasticRSI)
  const momentumWeightSum = w.RSI + w.MACD + w.Stochastic + w.StochasticRSI;
  const momentumScore =
    momentumWeightSum > 0
      ? (signals.rsi * w.RSI +
          signals.macd * w.MACD +
          signals.stochastic * w.Stochastic +
          signals.stochasticRsi * w.StochasticRSI) /
        momentumWeightSum
      : 0;

  // 3️⃣ VOLATILITY CATEGORY (BollingerBands only)
  const volatilityWeightSum = w.BollingerBands;
  const volatilityScore =
    volatilityWeightSum > 0
      ? (signals.bb * w.BollingerBands) / volatilityWeightSum
      : 0;

  return {
    trend: parseFloat(trendScore.toFixed(2)),
    momentum: parseFloat(momentumScore.toFixed(2)),
    volatility: parseFloat(volatilityScore.toFixed(2)),
  };
}

/**
 * 🎯 Helper: Map Final Signal from Score (NO THRESHOLD)
 * Arah sinyal HANYA dari score tanpa threshold tambahan
 *
 * @param {number} score - Weighted score (-1 to 1)
 * @returns {string} "buy" | "sell" | "neutral"
 *
 * Rules:
 * - score > 0   → BUY
 * - score < 0   → SELL
 * - score == 0  → NEUTRAL
 */
function mapFinalSignal(score) {
  if (score > 0) return "buy";
  if (score < 0) return "sell";
  return "neutral";
}

/**
 * 🎯 Helper: Map Signal Label (STRONG based on strength threshold)
 * Threshold 0.6 HANYA untuk label STRONG, bukan untuk arah sinyal
 *
 * @param {string} signal - "buy" | "sell" | "neutral"
 * @param {number} strength - Absolute value of score (0 to 1)
 * @returns {object} { signalLabel, signalEmoji }
 */
function mapSignalLabel(signal, strength) {
  let signalLabel = "NEUTRAL";
  let signalEmoji = "⚪";

  if (signal === "buy") {
    signalLabel = strength >= 0.6 ? "STRONG BUY" : "BUY";
    signalEmoji = strength >= 0.6 ? "🟢🟢" : "🟢";
  } else if (signal === "sell") {
    signalLabel = strength >= 0.6 ? "STRONG SELL" : "SELL";
    signalEmoji = strength >= 0.6 ? "🔴🔴" : "🔴";
  }

  return { signalLabel, signalEmoji };
}

/**
 * 🆕 Calculate Final Multi-Signal using Weighted Category Scores
 * FULLY SCORE-BASED (No Voting, No Arbitrary Threshold)
 *
 * Sesuai jurnal: "Enhancing Trading Strategies: A Multi-Indicator Analysis
 * for Profitable Algorithmic Trading (2025)"
 *
 * @param {Object} categoryScores - { trend, momentum, volatility }
 * @param {Object} weights - Optimized weights { SMA, EMA, RSI, ... }
 * @returns {Object} { signal, strength, finalScore, signalLabel, signalEmoji }
 *
 * Formula:
 * FinalScore = (trend * Wtrend + momentum * Wmomentum + volatility * Wvolatility)
 *              / (Wtrend + Wmomentum + Wvolatility)
 *
 * Signal Determination:
 * - score > 0  → BUY
 * - score < 0  → SELL
 * - score == 0 → NEUTRAL
 *
 * Strength:
 * - strength = |score|  (0 to 1)
 * - strength >= 0.6 → STRONG label
 */
function calculateFinalMultiSignal(categoryScores, weights) {
  // Default values jika null/undefined
  const scores = {
    trend: categoryScores?.trend || 0,
    momentum: categoryScores?.momentum || 0,
    volatility: categoryScores?.volatility || 0,
  };

  // Calculate category weights dari individual indicator weights
  const w = {
    SMA: weights?.SMA || 0,
    EMA: weights?.EMA || 0,
    PSAR: weights?.PSAR || 0,
    RSI: weights?.RSI || 0,
    MACD: weights?.MACD || 0,
    Stochastic: weights?.Stochastic || 0,
    StochasticRSI: weights?.StochasticRSI || 0,
    BollingerBands: weights?.BollingerBands || 0,
  };

  // Aggregate weights per category
  const categoryWeights = {
    trend: w.SMA + w.EMA + w.PSAR,
    momentum: w.RSI + w.MACD + w.Stochastic + w.StochasticRSI,
    volatility: w.BollingerBands,
  };

  // Calculate total weight
  const totalWeight =
    categoryWeights.trend +
    categoryWeights.momentum +
    categoryWeights.volatility;

  // Calculate weighted final score
  let finalScore = 0;

  if (totalWeight > 0) {
    finalScore =
      (scores.trend * categoryWeights.trend +
        scores.momentum * categoryWeights.momentum +
        scores.volatility * categoryWeights.volatility) /
      totalWeight;
  }

  // Round to 2 decimal places
  finalScore = parseFloat(finalScore.toFixed(2));

  // ✅ Determine signal HANYA dari score (NO THRESHOLD)
  const signal = mapFinalSignal(finalScore);

  // ✅ Calculate strength sebagai absolute value
  const strength = Math.abs(finalScore);

  // ✅ Get label dan emoji berdasarkan strength threshold (0.6)
  const { signalLabel, signalEmoji } = mapSignalLabel(signal, strength);

  // 🐛 Debug logging
  console.log("🎯 Multi-Signal Calculation:", {
    categoryScores: scores,
    categoryWeights,
    totalWeight,
    finalScore,
    signal,
    strength: parseFloat(strength.toFixed(2)),
    signalLabel,
  });

  return {
    signal, // "buy" | "sell" | "neutral"
    strength: parseFloat(strength.toFixed(2)), // 0 to 1
    finalScore, // -1 to 1
    signalLabel, // "BUY" | "STRONG BUY" | etc
    signalEmoji, // "🟢" | "🟢🟢" | etc
  };
}

/* ===========================================================
   ✅ GET INDICATORS API — Support mode=latest & mode=paginated
   🆕 REFACTORED: Dual mode untuk single indicator & chart
=========================================================== */
export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const mode = req.query.mode || "paginated"; // "latest" or "paginated"

    console.log(`📊 Fetching indicators for ${symbol} (mode: ${mode})`);
    const startTime = Date.now();

    // ========================================
    // MODE 1: LATEST - Return only latest signal
    // ========================================
    if (mode === "latest") {
      const [latestIndicator, latestWeight] = await Promise.all([
        prisma.indicator.findFirst({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
        }),
        prisma.indicatorWeight.findFirst({
          where: { symbol, timeframe },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      // Early return jika tidak ada data
      if (!latestIndicator) {
        return res.status(404).json({
          success: false,
          message: `Tidak ada data indikator untuk ${symbol}.`,
        });
      }

      // Get latest price
      const latestCandle = await prisma.candle.findFirst({
        where: { symbol, timeframe, time: latestIndicator.time },
        select: { close: true },
      });

      const latestPrice = latestCandle?.close ?? null;

      // Build indicators structure
      const indicators = {
        sma: {
          20: latestIndicator.sma20 ?? null,
          50: latestIndicator.sma50 ?? null,
          signal: latestIndicator.smaSignal ?? "neutral",
        },
        ema: {
          20: latestIndicator.ema20 ?? null,
          50: latestIndicator.ema50 ?? null,
          signal: latestIndicator.emaSignal ?? "neutral",
        },
        rsi: {
          14: latestIndicator.rsi ?? null,
          signal: latestIndicator.rsiSignal ?? "neutral",
        },
        macd: {
          macd: latestIndicator.macd ?? null,
          signalLine: latestIndicator.macdSignalLine ?? null,
          histogram: latestIndicator.macdHist ?? null,
          signal: latestIndicator.macdSignal ?? "neutral",
        },
        bollingerBands: {
          upper: latestIndicator.bbUpper ?? null,
          middle: latestIndicator.bbMiddle ?? null,
          lower: latestIndicator.bbLower ?? null,
          signal: latestIndicator.bbSignal ?? "neutral",
        },
        stochastic: {
          "%K": latestIndicator.stochK ?? null,
          "%D": latestIndicator.stochD ?? null,
          signal: latestIndicator.stochSignal ?? "neutral",
        },
        stochasticRsi: {
          "%K": latestIndicator.stochRsiK ?? null,
          "%D": latestIndicator.stochRsiD ?? null,
          signal: latestIndicator.stochRsiSignal ?? "neutral",
        },
        parabolicSar: {
          value: latestIndicator.psar ?? null,
          signal: latestIndicator.psarSignal ?? "neutral",
        },
      };

      // Calculate category scores
      const categoryScores = latestWeight
        ? calculateCategoryScores(indicators, latestWeight.weights)
        : { trend: 0, momentum: 0, volatility: 0 };

      // Calculate final multi-signal
      const finalMultiSignal = latestWeight
        ? calculateFinalMultiSignal(categoryScores, latestWeight.weights)
        : { signal: "neutral", finalScore: 0, normalizedScore: 0 };

      // Build response
      const processingTime = Date.now() - startTime;

      return res.json({
        success: true,
        symbol,
        timeframe,
        mode: "latest",
        processingTime: `${processingTime}ms`,
        latestSignal: {
          time: Number(latestIndicator.time),
          price: latestPrice,
          multiSignal: finalMultiSignal,
          categoryScores,
          weights: latestWeight?.weights ?? null,
          performance: latestWeight
            ? {
                roi: latestWeight.roi,
                winRate: latestWeight.winRate,
                maxDrawdown: latestWeight.maxDrawdown,
                sharpeRatio: latestWeight.sharpeRatio,
              }
            : null,
          indicators,
        },
      });
    }

    // ========================================
    // MODE 2: PAGINATED - Return paginated data for charts
    // ========================================
    const showAll = req.query.all === "true";
    const limit = 1000;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;

    console.log(
      `📊 Fetching indicators for ${symbol} ${showAll ? "(ALL DATA)" : `(page ${page}, limit ${limit})`}`
    );

    // Hitung total indikator
    const totalIndicators = await prisma.indicator.count({
      where: { symbol, timeframe },
    });

    if (totalIndicators === 0) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada data indikator untuk ${symbol}.`,
      });
    }

    // Query options
    const queryOptions = {
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      select: {
        time: true,
        sma20: true,
        sma50: true,
        ema20: true,
        ema50: true,
        rsi: true,
        macd: true,
        macdSignalLine: true,
        macdHist: true,
        bbUpper: true,
        bbMiddle: true,
        bbLower: true,
        stochK: true,
        stochD: true,
        stochRsiK: true,
        stochRsiD: true,
        psar: true,
        smaSignal: true,
        emaSignal: true,
        rsiSignal: true,
        macdSignal: true,
        bbSignal: true,
        stochSignal: true,
        stochRsiSignal: true,
        psarSignal: true,
        overallSignal: true,
        signalStrength: true,
      },
    };

    if (!showAll) {
      queryOptions.skip = skip;
      queryOptions.take = limit;
    }

    // Fetch data dengan latestSignal
    const [data, candlePrices, latestIndicator, latestWeight] =
      await Promise.all([
        prisma.indicator.findMany(queryOptions),
        prisma.candle.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
          ...(showAll ? {} : { skip, take: limit }),
          select: { time: true, close: true },
        }),
        prisma.indicator.findFirst({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
        }),
        prisma.indicatorWeight.findFirst({
          where: { symbol, timeframe },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

    // Gabungkan harga dan indikator
    const priceMap = new Map(
      candlePrices.map((c) => [Number(c.time), c.close])
    );

    const organized = data.map((d) => {
      const bbMiddle =
        d.bbMiddle ??
        (d.bbUpper && d.bbLower
          ? (d.bbUpper + d.bbLower) / 2
          : (d.sma20 ?? null));

      return {
        time: Number(d.time),
        price: priceMap.get(Number(d.time)) ?? null,
        indicators: {
          sma: {
            20: d.sma20 ?? null,
            50: d.sma50 ?? null,
            signal: d.smaSignal ?? "neutral",
          },
          ema: {
            20: d.ema20 ?? null,
            50: d.ema50 ?? null,
            signal: d.emaSignal ?? "neutral",
          },
          rsi: {
            14: d.rsi ?? null,
            signal: d.rsiSignal ?? "neutral",
          },
          macd: {
            macd: d.macd ?? null,
            signalLine: d.macdSignalLine ?? null,
            histogram: d.macdHist ?? null,
            signal: d.macdSignal ?? "neutral",
          },
          bollingerBands: {
            upper: d.bbUpper ?? null,
            middle: bbMiddle,
            lower: d.bbLower ?? null,
            signal: d.bbSignal ?? "neutral",
          },
          stochastic: {
            "%K": d.stochK ?? null,
            "%D": d.stochD ?? null,
            signal: d.stochSignal ?? "neutral",
          },
          stochasticRsi: {
            "%K": d.stochRsiK ?? null,
            "%D": d.stochRsiD ?? null,
            signal: d.stochRsiSignal ?? "neutral",
          },
          parabolicSar: {
            value: d.psar ?? null,
            signal: d.psarSignal ?? "neutral",
          },
        },
        overallSignal: d.overallSignal ?? "neutral",
        signalStrength: d.signalStrength ?? 0.5,
      };
    });

    // Build latestSignal
    let latestSignal = null;

    if (latestIndicator) {
      const latestPrice = priceMap.get(Number(latestIndicator.time)) ?? null;

      const latestIndicatorStructure = {
        sma: {
          20: latestIndicator.sma20 ?? null,
          50: latestIndicator.sma50 ?? null,
          signal: latestIndicator.smaSignal ?? "neutral",
        },
        ema: {
          20: latestIndicator.ema20 ?? null,
          50: latestIndicator.ema50 ?? null,
          signal: latestIndicator.emaSignal ?? "neutral",
        },
        rsi: {
          14: latestIndicator.rsi ?? null,
          signal: latestIndicator.rsiSignal ?? "neutral",
        },
        macd: {
          macd: latestIndicator.macd ?? null,
          signalLine: latestIndicator.macdSignalLine ?? null,
          histogram: latestIndicator.macdHist ?? null,
          signal: latestIndicator.macdSignal ?? "neutral",
        },
        bollingerBands: {
          upper: latestIndicator.bbUpper ?? null,
          middle: latestIndicator.bbMiddle ?? null,
          lower: latestIndicator.bbLower ?? null,
          signal: latestIndicator.bbSignal ?? "neutral",
        },
        stochastic: {
          "%K": latestIndicator.stochK ?? null,
          "%D": latestIndicator.stochD ?? null,
          signal: latestIndicator.stochSignal ?? "neutral",
        },
        stochasticRsi: {
          "%K": latestIndicator.stochRsiK ?? null,
          "%D": latestIndicator.stochRsiD ?? null,
          signal: latestIndicator.stochRsiSignal ?? "neutral",
        },
        parabolicSar: {
          value: latestIndicator.psar ?? null,
          signal: latestIndicator.psarSignal ?? "neutral",
        },
      };

      const categoryScores = latestWeight
        ? calculateCategoryScores(
            latestIndicatorStructure,
            latestWeight.weights
          )
        : { trend: 0, momentum: 0, volatility: 0 };

      const finalMultiSignal = latestWeight
        ? calculateFinalMultiSignal(categoryScores, latestWeight.weights)
        : { signal: "neutral", finalScore: 0, normalizedScore: 0 };

      latestSignal = {
        time: Number(latestIndicator.time),
        price: latestPrice,
        multiSignal: finalMultiSignal,
        categoryScores,
        weights: latestWeight?.weights ?? null,
        performance: latestWeight
          ? {
              roi: latestWeight.roi,
              winRate: latestWeight.winRate,
              maxDrawdown: latestWeight.maxDrawdown,
              sharpeRatio: latestWeight.sharpeRatio,
            }
          : null,
        indicators: latestIndicatorStructure,
      };
    }

    const processingTime = Date.now() - startTime;
    const rangeStart = formatReadableDate(
      Number(organized[organized.length - 1]?.time)
    );
    const rangeEnd = formatReadableDate(Number(organized[0]?.time));

    // Pagination info
    const totalPages = showAll ? 1 : Math.ceil(totalIndicators / limit);
    const hasNext = !showAll && page < totalPages;
    const hasPrev = !showAll && page > 1;

    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
    const pagination = showAll
      ? null
      : {
          next: hasNext
            ? { page: page + 1, url: `${baseUrl}?page=${page + 1}` }
            : null,
          prev: hasPrev
            ? { page: page - 1, url: `${baseUrl}?page=${page - 1}` }
            : null,
        };

    const coveragePercent = (
      (organized.length / totalIndicators) *
      100
    ).toFixed(1);

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: organized.length,
      totalIndicators,
      processingTime: `${processingTime}ms`,
      ...(showAll
        ? { mode: "all" }
        : { mode: "paginated", totalPages, page, limit, pagination }),
      metadata: {
        coverage: `${organized.length}/${totalIndicators}`,
        coveragePercent: showAll ? "100%" : `${coveragePercent}%`,
        range: { start: rangeStart, end: rangeEnd },
      },
      latestSignal,
      data: organized,
    });
  } catch (err) {
    console.error("❌ getIndicators error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

/* ===========================================================
   ✅ CALCULATE INDICATORS API (Force Recalculation)
=========================================================== */
export async function calculateIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const force = req.query.force === "true";

    console.log(
      `🔄 ${force ? "Force " : ""}Calculating indicators for ${symbol}...`
    );
    const startTime = Date.now();

    if (force) {
      await prisma.indicator.deleteMany({ where: { symbol, timeframe } });
      console.log(`🗑️ Deleted existing indicators for ${symbol}`);
    }

    await calculateAndSaveIndicators(symbol, timeframe);

    const count = await prisma.indicator.count({
      where: { symbol, timeframe },
    });
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      symbol,
      timeframe,
      indicatorsCalculated: count,
      processingTime: `${processingTime}ms`,
      message: `Successfully calculated ${count} indicators for ${symbol}`,
    });
  } catch (err) {
    console.error("❌ calculateIndicators error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to calculate indicators",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
