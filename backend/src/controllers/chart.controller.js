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

// Ambil data chart lengkap (candlestick, indikator, metadata, dan data live market).
export async function getChart(req, res) {
  try {
    // Parsing parameter dasar dari request.
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      1000,
      Math.max(100, parseInt(req.query.limit) || 500),
    );
    const offset = (page - 1) * limit;

    // Validasi coin dan timeframe dari database.
    const { coin, timeframeRecord } = await getCoinAndTimeframe(
      symbol,
      timeframe,
    );

    // Ambil candle terbaru berdasarkan halaman yang diminta.
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

    // Hitung rentang waktu data untuk query indikator.
    const times = chartData.candles.map((c) => Number(c.time));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Ambil bobot indikator terbaru untuk hitung multi-signal.
    const weights = await getLatestWeights(coin.id, timeframeRecord.id);

    // Ambil indikator pada rentang waktu yang sama dengan candle.
    const indicators = await getIndicatorsForTimeRange(
      symbol,
      timeframe,
      coin.id,
      timeframeRecord.id,
      minTime,
      maxTime,
      chartData.candles.length,
    );

    // Gabungkan candle dan indikator agar mudah dipakai frontend.
    const merged = mergeChartData(chartData.candles, indicators, weights);

    // Bentuk metadata ringkas untuk kebutuhan info tambahan.
    const metadata = calculateMetadata(merged, minTime, maxTime);

    // Bentuk pagination response.
    const totalPages = Math.ceil(chartData.total / limit);
    const pagination = buildPagination(req, page, totalPages, limit, timeframe);

    // Tambahkan data live market terbaru.
    const live = await getCoinLiveDetail(symbol);

    // Kirim response final ke client.
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
