// src/controllers/chart.controller.js
// Mengambil candle yang sudah ada di DB untuk visualisasi chart frontend.
import { getChartData } from "../services/chartdata.service.js";

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const limit = Math.max(50, Math.min(2000, Number(req.query.limit) || 500));

    const data = await getChartData(symbol, limit);
    if (data.total === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Belum ada data candle." });
    }

    res.json({
      success: true,
      symbol,
      totalCandles: data.total,
      returned: data.candles.length,
      candles: data.candles,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
