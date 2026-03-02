import { prisma } from "../lib/prisma.js";
import {
  getChartDataNewest,
  getCoinAndTimeframe,
  getLatestWeights,
  getIndicatorsForTimeRange,
  mergeChartData,
  calculateMetadata,
  buildPagination,
} from "../services/charts/chartdata.service.js";
import { getCoinLiveDetail } from "../services/market/index.js";

// Controller utama untuk endpoint chart
// Mengembalikan data candlestick + indikator + multi-signal dari database
export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, parseInt(req.query.limit) || 1000);
    const offset = (page - 1) * limit;

    // Get coin and timeframe from database
    const { coin, timeframeRecord } = await getCoinAndTimeframe(
      symbol,
      timeframe
    );

    // Fetch candles
    const chartData = await getChartDataNewest(symbol, limit, offset);
    if (!chartData.candles.length) {
      return res.json({
        success: true,
        symbol,
        name: coin.name || null,
        logo: coin.logo || null,
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

    // Get time range
    const times = chartData.candles.map((c) => Number(c.time));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Get latest weights for multi-signal calculation
    const weights = await getLatestWeights(coin.id, timeframeRecord.id);

    // Get or recalculate indicators
    const indicators = await getIndicatorsForTimeRange(
      symbol,
      timeframe,
      coin.id,
      timeframeRecord.id,
      minTime,
      maxTime,
      chartData.candles.length
    );

    // Merge candles with indicators
    const merged = mergeChartData(chartData.candles, indicators, weights);

    // Calculate metadata
    const metadata = calculateMetadata(merged, minTime, maxTime);

    // Build pagination
    const totalPages = Math.ceil(chartData.total / limit);
    const pagination = buildPagination(req, page, totalPages, limit, timeframe);

    // Get live market data
    const live = await getCoinLiveDetail(symbol);

    // Send response
    return res.json({
      success: true,
      symbol,
      name: coin.name || null,
      logo: coin.logo || null,
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      limit,
      pagination,
      metadata,
      liveData: live?.data || null,
      data: merged,
    });
  } catch (err) {
    console.error("Chart Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
