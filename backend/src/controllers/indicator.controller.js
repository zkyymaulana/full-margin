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
 * 🎯 Helper: Format multiSignal dari database (NO RECALCULATION)
 * ✅ 100% menggunakan data dari tabel Indicator
 * ✅ Sesuai metodologi penelitian: threshold = 0, no voting
 * ✅ UPDATED: Gunakan finalScore yang sudah tersimpan di DB
 * ✅ NEW: categoryScores = WEIGHTED CONTRIBUTION (bukan average)
 *
 * @param {Object} ind - Indicator dari database
 * @param {Object} weights - Weights dari database (untuk calculate categoryScores)
 * @returns {Object|null} multiSignal object atau null
 */
function formatMultiSignalFromDB(ind, weights = null) {
  if (!ind) return null;

  // ✅ Ambil langsung dari database - NO CALCULATION
  const dbFinalScore = ind.finalScore ?? 0;
  const dbStrength = ind.signalStrength ?? 0;

  // ✅ Map signal dari finalScore (threshold = 0)
  let signal = "neutral";
  let signalLabel = "NEUTRAL";
  let signalEmoji = "⚪";
  let finalScore = dbFinalScore;
  let strength = dbStrength;

  if (finalScore > 0) {
    signal = "buy";
    signalLabel = strength >= 0.6 ? "STRONG BUY" : "BUY";
    signalEmoji = strength >= 0.6 ? "🟢🟢" : "🟢";
  } else if (finalScore < 0) {
    signal = "sell";
    signalLabel = strength >= 0.6 ? "STRONG SELL" : "SELL";
    signalEmoji = strength >= 0.6 ? "🔴🔴" : "🔴";
  } else {
    signal = "neutral";
    strength = 0;
    signalLabel = "NEUTRAL";
    signalEmoji = "⚪";
  }

  // ✅ NEW: Calculate WEIGHTED categoryScores (contribution to final score)
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // ✅ WEIGHTED Trend category: (signal × weight) for each indicator
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);

    // ✅ WEIGHTED Momentum category
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);

    // ✅ WEIGHTED Volatility category
    const volatilityScore =
      signalToScore(ind.bbSignal) * (weights.BollingerBands || 0);

    categoryScores = {
      trend: parseFloat(trendScore.toFixed(2)),
      momentum: parseFloat(momentumScore.toFixed(2)),
      volatility: parseFloat(volatilityScore.toFixed(2)),
    };
  }

  return {
    signal,
    strength: parseFloat(strength.toFixed(3)),
    finalScore: parseFloat(finalScore.toFixed(2)),
    signalLabel,
    signalEmoji,
    categoryScores, // ✅ Now shows WEIGHTED contribution
    source: "db",
  };
}

/* ===========================================================
   ✅ GET INDICATORS API — Support mode=latest & mode=paginated
   ✅ REFACTORED: 100% database signals (no calculation)
=========================================================== */
export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const mode = req.query.mode || "paginated";

    console.log(`📊 Fetching indicators for ${symbol} (mode: ${mode})`);
    const startTime = Date.now();

    // ========================================
    // MODE 1: LATEST - Return only latest signal
    // ✅ 100% DATABASE - NO CALCULATION
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

      // ✅ Format multiSignal dari database (NO CALCULATION)
      const multiSignal = formatMultiSignalFromDB(
        latestIndicator,
        latestWeight?.weights
      );

      // ✅ Build indicators structure dengan signal dari DB
      const indicators = {
        sma: {
          20: latestIndicator.sma20 ?? null,
          50: latestIndicator.sma50 ?? null,
          signal: latestIndicator.smaSignal || "neutral",
        },
        ema: {
          20: latestIndicator.ema20 ?? null,
          50: latestIndicator.ema50 ?? null,
          signal: latestIndicator.emaSignal || "neutral",
        },
        rsi: {
          14: latestIndicator.rsi ?? null,
          signal: latestIndicator.rsiSignal || "neutral",
        },
        macd: {
          macd: latestIndicator.macd ?? null,
          signalLine: latestIndicator.macdSignalLine ?? null,
          histogram: latestIndicator.macdHist ?? null,
          signal: latestIndicator.macdSignal || "neutral",
        },
        bollingerBands: {
          upper: latestIndicator.bbUpper ?? null,
          middle: latestIndicator.bbMiddle ?? null,
          lower: latestIndicator.bbLower ?? null,
          signal: latestIndicator.bbSignal || "neutral",
        },
        stochastic: {
          "%K": latestIndicator.stochK ?? null,
          "%D": latestIndicator.stochD ?? null,
          signal: latestIndicator.stochSignal || "neutral",
        },
        stochasticRsi: {
          "%K": latestIndicator.stochRsiK ?? null,
          "%D": latestIndicator.stochRsiD ?? null,
          signal: latestIndicator.stochRsiSignal || "neutral",
        },
        parabolicSar: {
          value: latestIndicator.psar ?? null,
          signal: latestIndicator.psarSignal || "neutral",
        },
      };

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
          multiSignal: multiSignal || {
            signal: "neutral",
            strength: 0,
            finalScore: 0,
            signalLabel: "NEUTRAL",
            signalEmoji: "⚪",
            source: "db",
          },
          weights: latestWeight?.weights ?? null,
          performance: latestWeight
            ? {
                roi: latestWeight.roi,
                winRate: latestWeight.winRate,
                maxDrawdown: latestWeight.maxDrawdown,
                sharpeRatio: latestWeight.sharpeRatio,
                trades: latestWeight.trades,
                finalCapital: latestWeight.finalCapital,
                trainingPeriod: {
                  startDate: Number(latestWeight.startTrain),
                  endDate: Number(latestWeight.endTrain),
                  startDateReadable: formatReadableDate(
                    Number(latestWeight.startTrain)
                  ),
                  endDateReadable: formatReadableDate(
                    Number(latestWeight.endTrain)
                  ),
                },
              }
            : null,
          indicators,
        },
      });
    }

    // ========================================
    // MODE 2: PAGINATED - Return paginated data
    // ✅ 100% DATABASE - NO CALCULATION
    // ========================================
    const showAll = req.query.all === "true";
    const limit = 1000;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const totalIndicators = await prisma.indicator.count({
      where: { symbol, timeframe },
    });

    if (totalIndicators === 0) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada data indikator untuk ${symbol}.`,
      });
    }

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
        finalScore: true,
      },
    };

    if (!showAll) {
      queryOptions.skip = skip;
      queryOptions.take = limit;
    }

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

      const multiSignal = formatMultiSignalFromDB(
        latestIndicator,
        latestWeight?.weights
      );

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

      latestSignal = {
        time: Number(latestIndicator.time),
        price: latestPrice,
        multiSignal,
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
        source: "database",
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
