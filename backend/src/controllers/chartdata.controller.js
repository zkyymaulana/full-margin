// src/controllers/chart.controller.js
// Mengambil candle yang sudah ada di DB untuk visualisasi chart frontend.
import {
  getChartData,
  triggerCoinSync,
} from "../services/chartdata.service.js";
import { getCoinLiveDetail } from "../services/marketcap.service.js";

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const limit = Math.max(50, Math.min(2000, Number(req.query.limit) || 500));

    // Trigger heavy synchronization for this specific coin
    console.log(`🔄 Triggering sync for ${symbol} chart data...`);
    await triggerCoinSync(symbol);

    const data = await getChartData(symbol, limit);
    if (data.total === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Belum ada data candle." });
    }

    // Get live detail for current price
    const liveDetail = await getCoinLiveDetail(symbol);

    res.json({
      success: true,
      symbol,
      totalCandles: data.total,
      returned: data.candles.length,
      candles: data.candles,
      liveData: liveDetail.success ? liveDetail.data : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
