import { prisma } from "../lib/prisma.js";
import { getChartDataNewest } from "../services/charts/chartdata.service.js";
import { getCoinLiveDetail } from "../services/market/index.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, parseInt(req.query.limit) || 1000);
    const offset = (page - 1) * limit;

    console.log(`📊 [Chart] ${symbol} | Page ${page} | Limit ${limit}`);

    // Ambil candle dari service
    const chartData = await getChartDataNewest(symbol, limit, offset);
    if (!chartData.candles.length) {
      return res.json({
        success: true,
        symbol,
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
    const coveragePercentBefore = ((coverageBefore / expected) * 100).toFixed(
      1
    );

    if (coverageBefore < expected) {
      console.log(
        `⚙️ [AUTO] Indicator coverage ${coverageBefore}/${expected} (${coveragePercentBefore}%) → recalculating...`
      );
      try {
        await calculateAndSaveIndicators(symbol, timeframe, minTime, maxTime);
        console.log(
          `✅ [AUTO] Recalculated indicators for ${symbol} (${timeframe})`
        );
        indicators = await prisma.indicator.findMany({
          where: {
            symbol,
            timeframe,
            time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
          },
          orderBy: { time: "asc" },
        });
        console.log(
          `📈 [AUTO] Found ${indicators.length}/${expected} indicators after recalc.`
        );
      } catch (err) {
        console.error(`❌ [AUTO] Indicator calculation failed:`, err.message);
      }
    }

    // Gabungkan candle + indikator
    const indicatorMap = new Map(indicators.map((i) => [Number(i.time), i]));
    const merged = chartData.candles.map((c) => {
      const ind = indicatorMap.get(Number(c.time));
      return {
        time: c.time.toString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        indicators: ind
          ? {
              sma: { 20: ind.sma20, 50: ind.sma50 },
              ema: { 20: ind.ema20, 50: ind.ema50 },
              rsi: { 14: ind.rsi },
              macd: {
                macd: ind.macd,
                signalLine: ind.macdSignal,
                histogram: ind.macdHist,
              },
              bollingerBands: {
                upper: ind.bbUpper,
                lower: ind.bbLower,
              },
              stochastic: {
                "%K": ind.stochK,
                "%D": ind.stochD,
              },
              stochasticRsi: {
                "%K": ind.stochRsiK,
                "%D": ind.stochRsiD,
              },
              parabolicSar: {
                value: ind.psar,
              },
            }
          : null,
      };
    });

    // Hitung coverage setelah merge
    const withIndicators = merged.filter((m) => m.indicators).length;
    const coverage = (withIndicators / merged.length) * 100;

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
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      limit,
      pagination: { next, prev },
      metadata: {
        coverage: `${withIndicators}/${merged.length}`,
        coveragePercent: `${coverage.toFixed(1)}%`,
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
    console.error("❌ Chart Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
