import { prisma } from "../lib/prisma.js";
import { getChartDataNewest } from "../services/charts/chartdata.service.js";
import { getCoinLiveDetail } from "../services/market/index.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

/**
 * Format sinyal multi-indikator dari database.
 * TIDAK menghitung ulang indikator, hanya mapping data yang sudah tersimpan.
 * Digunakan untuk keperluan chart & monitoring real-time.
 */
function formatMultiSignalFromDB(ind, weights = null) {
  if (!ind) return null; // Jika tidak ada data indikator, return null

  // Ambil nilai finalScore & strength langsung dari DB
  const dbFinalScore = ind.finalScore ?? 0;
  const dbStrength = ind.signalStrength ?? 0;

  // Mapping sinyal berdasarkan finalScore (threshold = 0)
  let signal = "neutral";
  let finalScore = dbFinalScore;
  let strength = dbStrength;

  if (finalScore > 0) {
    signal = "buy";
  } else if (finalScore < 0) {
    signal = "sell";
  } else {
    signal = "neutral";
    strength = 0;
  }

  // label & emoji berdasarkan strength threshold (0.6)
  let signalLabel = "NEUTRAL";

  if (signal === "buy") {
    signalLabel = strength >= 0.6 ? "STRONG BUY" : "BUY";
  } else if (signal === "sell") {
    signalLabel = strength >= 0.6 ? "STRONG SELL" : "SELL";
  }

  // Default category score
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  // Jika bobot tersedia, hitung kontribusi per kategori
  if (weights) {
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // Kontribusi tren (SMA + EMA + PSAR)
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);

    // Kontribusi momentum (RSI + MACD + Stochastic + StochRSI)
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);

    // Kontribusi volatilitas (Bollinger Bands)
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
    categoryScores,
    source: "db", // Source ditandai dari database
  };
}

// Controller utama untuk endpoint chart
// Mengembalikan data candlestick + indikator + multi-signal dari database
export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, parseInt(req.query.limit) || 1000);
    const offset = (page - 1) * limit;

    console.log(`📊 [Chart] ${symbol} | Page ${page} | Limit ${limit}`);

    // Ambil info coin (name + logo) dari tabel Coin
    const coinInfo = await prisma.coin.findUnique({
      where: { symbol },
      select: { name: true, logo: true },
    });

    // Ambil candle dari service
    const chartData = await getChartDataNewest(symbol, limit, offset);
    if (!chartData.candles.length) {
      return res.json({
        success: true,
        symbol,
        name: coinInfo?.name || null,
        logo: coinInfo?.logo || null,
        timeframe,
        total: 0,
        page,
        totalPages: 0,
        limit,
        pagination: { next: null, prev: null },
        liveData: null,
        data: [],
      });
    }

    // Hitung waktu minimum dan maksimum
    const times = chartData.candles.map((c) => Number(c.time));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    //  Get weights for categoryScores calculation
    const weightRecord = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });
    const weights = weightRecord?.weights || null;

    // Cek apakah indikator sudah lengkap untuk rentang waktu ini
    let indicators = await prisma.indicator.findMany({
      where: {
        symbol,
        timeframe,
        time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
      },
      orderBy: { time: "asc" },
    });

    const coverageBefore = indicators.length;
    const expected = chartData.candles.length;

    if (coverageBefore < expected) {
      console.log(
        `⚙️ [AUTO] Indicator coverage ${coverageBefore}/${expected} → recalculating...`
      );
      try {
        await calculateAndSaveIndicators(symbol, timeframe, minTime, maxTime);
        indicators = await prisma.indicator.findMany({
          where: {
            symbol,
            timeframe,
            time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
          },
          orderBy: { time: "asc" },
        });
        console.log(
          ` [AUTO] Found ${indicators.length}/${expected} indicators after recalc.`
        );
      } catch (err) {
        console.error(`❌ [AUTO] Indicator calculation failed:`, err.message);
      }
    }

    //  Gabungkan candle + indikator (PURE DATABASE - NO CALCULATION)
    const indicatorMap = new Map(indicators.map((i) => [Number(i.time), i]));
    const merged = chartData.candles.map((c) => {
      const ind = indicatorMap.get(Number(c.time));

      //  Format multiSignal dari database (NO RECALCULATION)
      const multiSignal = formatMultiSignalFromDB(ind, weights);

      return {
        time: c.time.toString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        multiSignal, //  database
        indicators: ind
          ? {
              sma: {
                20: ind.sma20,
                50: ind.sma50,
                signal: ind.smaSignal || "neutral", //  From DB
              },
              ema: {
                20: ind.ema20,
                50: ind.ema50,
                signal: ind.emaSignal || "neutral", //  From DB
              },
              rsi: {
                14: ind.rsi,
                signal: ind.rsiSignal || "neutral", //  From DB
              },
              macd: {
                macd: ind.macd,
                signalLine: ind.macdSignalLine,
                histogram: ind.macdHist,
                signal: ind.macdSignal || "neutral", //  From DB
              },
              bollingerBands: {
                upper: ind.bbUpper,
                middle: ind.bbMiddle,
                lower: ind.bbLower,
                signal: ind.bbSignal || "neutral", //  From DB
              },
              stochastic: {
                "%K": ind.stochK,
                "%D": ind.stochD,
                signal: ind.stochSignal || "neutral", //  From DB
              },
              stochasticRsi: {
                "%K": ind.stochRsiK,
                "%D": ind.stochRsiD,
                signal: ind.stochRsiSignal || "neutral", //  From DB
              },
              parabolicSar: {
                value: ind.psar,
                signal: ind.psarSignal || "neutral", //  From DB
              },
            }
          : null,
      };
    });

    // Hitung coverage setelah merge
    const withIndicators = merged.filter((m) => m.indicators).length;
    const coverage = (withIndicators / merged.length) * 100;

    // Log multiSignal stats untuk debugging
    const signalStats = {
      buy: merged.filter((m) => m.multiSignal?.signal === "buy").length,
      sell: merged.filter((m) => m.multiSignal?.signal === "sell").length,
      neutral: merged.filter((m) => m.multiSignal?.signal === "neutral").length,
      missing: merged.filter((m) => !m.multiSignal).length,
    };
    console.log(
      `📍 [Signal] BUY: ${signalStats.buy} | SELL: ${signalStats.sell} | NEUTRAL: ${signalStats.neutral} | MISSING: ${signalStats.missing}`
    );

    // Pagination setup
    const totalPages = Math.ceil(chartData.total / limit);
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
    const next =
      page < totalPages
        ? {
            page: page + 1,
            url: `${baseUrl}?page=${page + 1}&limit=${limit}&timeframe=${timeframe}`,
          }
        : null;
    const prev =
      page > 1
        ? {
            page: page - 1,
            url: `${baseUrl}?page=${page - 1}&limit=${limit}&timeframe=${timeframe}`,
          }
        : null;

    const live = await getCoinLiveDetail(symbol);

    // Kirim response
    return res.json({
      success: true,
      symbol,
      name: coinInfo?.name || null,
      logo: coinInfo?.logo || null,
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      limit,
      pagination: { next, prev },
      metadata: {
        coverage: `${withIndicators}/${merged.length}`,
        coveragePercent: `${coverage.toFixed(1)}%`,
        signalDistribution: signalStats,
        source: "database", //  Mark as pure database
        range: {
          start: new Date(minTime).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          end: new Date(maxTime).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      },
      liveData: live?.data || null,
      data: merged,
    });
  } catch (err) {
    console.error("Chart Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
