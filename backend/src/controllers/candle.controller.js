// src/controllers/candle.controller.js
// Mengambil data candle dari Coinbase API dan menyimpannya ke DB (sinkronisasi).
import { syncCoinbaseCandles } from "../services/data.service.js";

export async function syncCandles(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const result = await syncCoinbaseCandles(symbol);
    res.json({ success: true, symbol, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
