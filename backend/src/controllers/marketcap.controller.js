// src/controllers/marketcap.controller.js
import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/marketcap.service.js";

/**
 * 📊 Marketcap (dari DB)
 */
export async function getMarketcap(req, res) {
  try {
    const result = await getMarketcapRealtime();
    if (!result.success) return res.status(500).json(result);
    res.json(result);
  } catch (err) {
    console.error("❌ Controller error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Terjadi kesalahan pada server",
    });
  }
}

/**
 * ⚡ Marketcap (live dari Coinbase)
 */
export async function getMarketcapLiveController(req, res) {
  try {
    const result = await getMarketcapLive();
    if (!result.success) return res.status(500).json(result);
    res.json(result);
  } catch (err) {
    console.error("❌ Controller error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Terjadi kesalahan pada server",
    });
  }
}
