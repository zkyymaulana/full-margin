import { syncCoinbaseCandles } from "../services/data.service.js";
import {
  getRecentCandlesFromDB,
  getCandleCount,
} from "../services/candle.service.js";

/**
 * 🕒 GET /api/chart/:symbol?
 * - Lakukan incremental sync (jika ada candle baru, simpan)
 * - Selalu kirim balik N candle terakhir dari DB (siap pakai untuk chart)
 * Query param:
 *   - ?limit=500  (opsional, default 500)
 */
export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const limit = Math.max(50, Math.min(2000, Number(req.query.limit) || 500));

    console.log(`📊 Mengambil data chart untuk ${symbol}...`);

    // 1) Up-to-date-kan DB (incremental, tidak fetch candle yang belum close)
    await syncCoinbaseCandles(symbol);

    // 2) Ambil data terbaru dari DB untuk response
    const [totalCandles, candles] = await Promise.all([
      getCandleCount(symbol),
      getRecentCandlesFromDB(symbol, limit),
    ]);

    if (totalCandles === 0) {
      return res.status(404).json({
        success: false,
        symbol,
        message: "Belum ada data candle di database.",
      });
    }

    // 3) Beri response yang selalu menyertakan data candle
    res.json({
      success: true,
      symbol,
      totalCandles,
      returned: candles.length,
      candles, // <-- array OHLC siap chart
    });
  } catch (err) {
    console.error("❌ Error di getChart:", err.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil chart data",
      error: err.message,
    });
  }
}
