import { syncCoinbaseCandles } from "../services/data.service.js";

/**
 * 🕒 Controller: Ambil & tampilkan candle terakhir (chart endpoint)
 */
export async function getChart(req, res) {
  try {
    const symbol = req.params.symbol?.toUpperCase() || "BTC-USD";
    console.log(`📊 Mengambil data chart untuk ${symbol}...`);

    const result = await syncCoinbaseCandles(symbol);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `❌ Gagal mengambil data chart untuk ${symbol}`,
      });
    }

    res.json({
      success: true,
      symbol,
      totalCandles: result.total,
      lastFiveCandles: result.lastFive,
      message: `✅ Chart ${symbol} berhasil diperbarui`,
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
