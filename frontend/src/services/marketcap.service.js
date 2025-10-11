// src/services/marketcap.service.js
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

/**
 * 📡 Fungsi util untuk memanggil API backend (DB atau Live)
 * @param {boolean} live - Jika true, ambil data live dari /marketcap/live
 */
export async function getMarketcap(live = false) {
  const endpoint = live
    ? `${API_BASE}/marketcap/live`
    : `${API_BASE}/marketcap`;

  try {
    const res = await axios.get(endpoint, { timeout: 160000 });

    if (!res.data?.success) {
      throw new Error(res.data?.message || "Gagal mengambil data marketcap");
    }

    console.info(
      `✅ [Marketcap Service] Data ${live ? "LIVE" : "DB"} berhasil diambil (${
        res.data.total || res.data.data?.length || 0
      } aset)`
    );

    return res.data.data || [];
  } catch (err) {
    // 🧩 Log detail error ke DevTools
    console.groupCollapsed("❌ [Marketcap Service] Fetch Error");
    console.error("📛 Pesan utama:", err.message);

    if (err.response) {
      console.error("📡 Status:", err.response.status);
      console.error("🧠 Response:", err.response.data);
      console.error("🔗 URL:", err.config?.url);
    } else if (err.request) {
      console.error("🚫 Tidak ada response (Network error):", err.request);
    } else {
      console.error("⚙️ Kesalahan konfigurasi Axios:", err);
    }
    console.groupEnd();

    // 🎯 Error yang dilempar ke Hook
    if (err.response) {
      throw new Error(
        err.response.data?.message ||
          `Server error (${err.response.status}) - ${err.response.statusText}`
      );
    }

    if (err.code === "ECONNABORTED") {
      throw new Error("Koneksi ke server terlalu lama (timeout).");
    }

    throw new Error("Tidak dapat terhubung ke server backend.");
  }
}
