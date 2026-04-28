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
import { fetchLastCandleByTimeframe } from "../clients/index.js";

// Endpoint untuk mengambil data ticker (harga live) berdasarkan symbol
export async function getChartLiveTicker(req, res) {
  try {
    // Ambil symbol dari parameter URL, default ke BTC-USD jika tidak ada
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    // Ambil data live dari service (misalnya Coinbase / API lain)
    const live = await getCoinLiveDetail(symbol);

    // Jika data tidak ditemukan atau response tidak valid
    if (!live?.success || !live?.data) {
      return res.status(404).json({
        success: false,
        symbol,
        message: live?.message || "Live ticker tidak ditemukan",
      });
    }

    // Jika berhasil, kirim response ke client
    return res.json({
      success: true,
      symbol,
      timestamp: Date.now(), // waktu response dikirim
      data: live.data, // data harga live
    });
  } catch (err) {
    // Handle error server
    console.error("Chart live ticker error:", err.message);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil OHLCV live per timeframe langsung dari candle Coinbase terbaru.
export async function getChartLiveOHLCV(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = String(req.query.timeframe || "1h").toLowerCase();

    const liveCandle = await fetchLastCandleByTimeframe(symbol, timeframe);
    if (!liveCandle) {
      return res.status(404).json({
        success: false,
        symbol,
        timeframe,
        message: "Live OHLCV tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      symbol,
      timeframe,
      timestamp: Date.now(),
      data: {
        time: liveCandle.bucketStartMs,
        open: Number(liveCandle.open),
        high: Number(liveCandle.high),
        low: Number(liveCandle.low),
        close: Number(liveCandle.close),
        volume: Number(liveCandle.volume),
      },
    });
  } catch (err) {
    console.error("Chart live OHLCV error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

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
