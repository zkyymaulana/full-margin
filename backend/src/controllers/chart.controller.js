import { getChartData } from "../services/charts/chartdata.service.js";
import {
  getRecentIndicators,
  calculateAndSaveIndicators,
} from "../services/indicators/indicator.service.js";
import { getCoinLiveDetail } from "../services/market/marketcap.service.js";
import { prisma } from "../lib/prisma.js";

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(500, parseInt(req.query.limit) || 500);
    const offset = (page - 1) * pageSize;
    const timeframe = req.query.timeframe || "1h";

    const [chartData, live] = await Promise.all([
      getChartData(symbol, pageSize, offset),
      getCoinLiveDetail(symbol),
    ]);

    // ✅ DEBUGGING: Log sample candle times
    console.log(
      `🔍 Chart Debug - First 3 candle times:`,
      chartData.candles.slice(0, 3).map((c) => ({
        time: c.time.toString(),
        typeof: typeof c.time,
      }))
    );

    // ✅ Ambil indicator data
    let indicatorData = await getRecentIndicators(
      symbol,
      pageSize * 3,
      timeframe
    );

    // ✅ DEBUGGING: Log sample indicator times
    console.log(
      `🔍 Chart Debug - First 3 indicator times:`,
      indicatorData.slice(0, 3).map((i) => ({
        time: i.time.toString(),
        typeof: typeof i.time,
      }))
    );

    // ✅ DEBUGGING: Cek apakah ada exact match
    const candleTimeSet = new Set(
      chartData.candles.map((c) => c.time.toString())
    );
    const indicatorTimeSet = new Set(
      indicatorData.map((i) => i.time.toString())
    );
    const exactMatches = Array.from(candleTimeSet).filter((t) =>
      indicatorTimeSet.has(t)
    );

    console.log(
      `🔍 Chart Debug - Exact matches: ${exactMatches.length}/${chartData.candles.length}`
    );

    if (exactMatches.length === 0) {
      console.log(`🔍 Chart Debug - Sample comparison:`);
      console.log(`   Candle[0]: ${chartData.candles[0]?.time?.toString()}`);
      console.log(`   Indicator[0]: ${indicatorData[0]?.time?.toString()}`);
      console.log(
        `   Equal?: ${chartData.candles[0]?.time?.toString() === indicatorData[0]?.time?.toString()}`
      );
    }

    // ✅ Jika tidak ada exact match, coba hitung ulang indicator UNTUK RANGE YANG SAMA
    if (exactMatches.length === 0 && chartData.candles.length > 0) {
      console.log(
        `📊 Chart ${symbol}: Tidak ada exact match, menghitung ulang indicator untuk range yang sama...`
      );

      try {
        // ✅ PERBAIKAN: Hitung indicator khusus untuk range candle yang diminta
        const startTime = chartData.candles[0].time;
        const endTime = chartData.candles[chartData.candles.length - 1].time;

        console.log(
          `📊 Chart ${symbol}: Menghitung indicator untuk range ${startTime} - ${endTime}`
        );

        // Hapus indicator untuk range ini saja
        await prisma.indicator.deleteMany({
          where: {
            symbol,
            timeframe,
            time: {
              gte: startTime,
              lte: endTime,
            },
          },
        });

        // Hitung indicator dengan mode full untuk memastikan historical context
        await calculateAndSaveIndicators(symbol, timeframe, "full");

        // Ambil indicator data yang baru dihitung untuk range yang sama
        indicatorData = await prisma.indicator.findMany({
          where: {
            symbol,
            timeframe,
            time: {
              gte: startTime,
              lte: endTime,
            },
          },
          orderBy: { time: "desc" },
        });

        console.log(
          `✅ Chart ${symbol}: ${indicatorData.length} indicator berhasil dihitung untuk range`
        );

        // ✅ DEBUGGING: Cek lagi setelah recalculation
        const newIndicatorTimeSet = new Set(
          indicatorData.map((i) => i.time.toString())
        );
        const newExactMatches = Array.from(candleTimeSet).filter((t) =>
          newIndicatorTimeSet.has(t)
        );
        console.log(
          `🔍 Chart Debug - Exact matches after targeted recalc: ${newExactMatches.length}/${chartData.candles.length}`
        );
      } catch (calcError) {
        console.error(
          `❌ Chart ${symbol}: gagal hitung indicator -`,
          calcError.message
        );
      }
    }

    // ✅ Buat map dengan exact BigInt matching
    const indicatorMap = new Map();

    indicatorData.forEach((indicator) => {
      indicatorMap.set(indicator.time.toString(), indicator);
    });

    // ✅ Gabungkan dengan exact time matching
    const merged = chartData.candles.map((candle) => {
      const indicator = indicatorMap.get(candle.time.toString());

      return {
        time: candle.time.toString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        indicators: indicator
          ? {
              sma5: indicator.sma5,
              sma20: indicator.sma20,
              ema5: indicator.ema5,
              ema20: indicator.ema20,
              rsi: indicator.rsi,
              macd: indicator.macd,
              macdSignal: indicator.macdSignal,
              macdHist: indicator.macdHist,
              bbUpper: indicator.bbUpper,
              bbLower: indicator.bbLower,
              stochK: indicator.stochK,
              stochD: indicator.stochD,
              stochRsiK: indicator.stochRsiK,
              stochRsiD: indicator.stochRsiD,
              psar: indicator.psar,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(chartData.total / pageSize);

    // ✅ Log statistik final
    const indicatorCount = merged.filter((m) => m.indicators !== null).length;
    const nonNullIndicators = merged.filter(
      (m) => m.indicators && Object.values(m.indicators).some((v) => v !== null)
    ).length;

    console.log(
      `📊 Chart ${symbol}: ${merged.length} candles, ${indicatorCount} dengan indicator, ${nonNullIndicators} dengan data valid`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      pageSize,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      liveData: live.success ? live.data : null,
      data: merged,
    });
  } catch (err) {
    console.error(`❌ Chart error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
