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

/* ===========================================================
   ✅ GET INDICATORS API — Support Pagination & All Data
=========================================================== */
export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const showAll = req.query.all === "true"; // mode ambil semua data

    const limit = 1000;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;

    console.log(
      `📊 Fetching indicators for ${symbol} ${showAll ? "(ALL DATA)" : `(page ${page}, limit ${limit})`}`
    );
    const startTime = Date.now();

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

    // Tentukan apakah pakai pagination atau ambil semua
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

    // Ambil data indikator dan harga candle
    const [data, candlePrices] = await Promise.all([
      prisma.indicator.findMany(queryOptions),
      prisma.candle.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        ...(showAll ? {} : { skip, take: limit }),
        select: { time: true, close: true },
      }),
    ]);

    // Gabungkan harga dan indikator dengan struktur lengkap
    const priceMap = new Map(
      candlePrices.map((c) => [Number(c.time), c.close])
    );

    const organized = data.map((d) => {
      // 🔧 Calculate Bollinger Middle if not in DB
      const bbMiddle =
        d.bbUpper && d.bbLower
          ? (d.bbUpper + d.bbLower) / 2
          : (d.sma20 ?? null);

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
            middle: bbMiddle, // ✅ Now includes calculated middle value
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

    const processingTime = Date.now() - startTime;
    const rangeStart = formatReadableDate(
      Number(organized[organized.length - 1]?.time)
    );
    const rangeEnd = formatReadableDate(Number(organized[0]?.time));

    // Pagination info (kalau tidak pakai all=true)
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

    // ✅ Response JSON
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

/* ===========================================================
   ✅ GET SIGNAL SUMMARY API
=========================================================== */
export async function getSignalSummary(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";

    console.log(`📊 Fetching signal summary for ${symbol}...`);
    const startTime = Date.now();

    const [latestIndicator, recentSignals, totalIndicators] = await Promise.all(
      [
        prisma.indicator.findFirst({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
        }),
        prisma.indicator.findMany({
          where: { symbol, timeframe },
          orderBy: { time: "desc" },
          take: 100,
          select: { overallSignal: true, signalStrength: true, time: true },
        }),
        prisma.indicator.count({ where: { symbol, timeframe } }),
      ]
    );

    if (!latestIndicator) {
      return res.status(404).json({
        success: false,
        message: `No signal data found for ${symbol}`,
      });
    }

    const oldest = recentSignals[recentSignals.length - 1];
    const newest = recentSignals[0];
    const rangeStart = formatReadableDate(Number(oldest?.time));
    const rangeEnd = formatReadableDate(Number(newest?.time));

    const signalDistribution = {
      strong_buy: 0,
      buy: 0,
      neutral: 0,
      sell: 0,
      strong_sell: 0,
    };

    recentSignals.forEach((s) => {
      if (signalDistribution.hasOwnProperty(s.overallSignal)) {
        signalDistribution[s.overallSignal]++;
      }
    });

    const avgSignalStrength =
      recentSignals.reduce((sum, s) => sum + (s.signalStrength || 0), 0) /
      recentSignals.length;

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      symbol,
      timeframe,
      current: {
        timestamp: formatReadableDate(Number(latestIndicator.time)),
        overall: latestIndicator.overallSignal,
        strength: latestIndicator.signalStrength,
      },
      analysis: {
        signalDistribution,
        averageStrength: Math.round(avgSignalStrength * 100) / 100,
        sampleSize: recentSignals.length,
      },
      metadata: {
        coverage: `${recentSignals.length}/${totalIndicators}`,
        coveragePercent: `${((recentSignals.length / totalIndicators) * 100).toFixed(1)}%`,
        range: { start: rangeStart, end: rangeEnd },
      },
      processingTime: `${processingTime}ms`,
    });
  } catch (err) {
    console.error("❌ getSignalSummary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get signal summary",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
