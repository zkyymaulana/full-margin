// src/services/marketcap.service.js
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

/**
 * Ambil data marketcap dari backend
 * Response: { success, total, data: [ {symbol, name, candles: [...]}, ... ] }
 */
export async function fetchMarketcapData() {
  const res = await axios.get(`${API_BASE}/marketcap`, { timeout: 15000 });
  if (!res.data?.success) {
    throw new Error(res.data?.message || "Gagal mengambil data marketcap");
  }

  return res.data.data || [];
}
