/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 CHART SERVICE - BARREL EXPORT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TUJUAN MODUL:
 * ─────────────
 * File ini mengeksport semua fungsi dari sub-modules chart service
 * untuk memudahkan import dari file lain.
 *
 * Struktur:
 * • chart.service.js    → Candle data access & persistence
 * • chart.data.js       → Database retrieval & indicator merging
 * • chart.indicator.js  → Indicator formatting & signal calculation
 * • chart.metadata.js   → Statistics & pagination utilities
 *
 * Catatan: Menggunakan named exports (BUKAN wildcard export)
 * untuk explicit dan tree-shakeable imports.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ✅ Export dari chart.service.js
// Fungsi-fungsi untuk query dan simpan candle data
export {
  getLastCandleTime, // Ambil waktu candle terakhir
  getCandleCount, // Hitung total candle
  getChartData, // Query candle (oldest first)
  getChartDataNewest, // Query candle (newest first)
  saveCandlesToDB, // Simpan candle baru ke database
} from "./chart.service.js";

// ✅ Export dari chart.data.js
// Fungsi-fungsi untuk database retrieval dan data merging
export {
  getCoinAndTimeframe, // Ambil coin & timeframe records
  getLatestWeights, // Ambil bobot indikator optimal
  getIndicatorsForTimeRange, // Ambil/recalculate indicator
  mergeChartData, // Merge candle dengan indicator
} from "./chart.data.js";

// ✅ Export dari chart.indicator.js
// Fungsi-fungsi untuk formatting dan signal calculation
export {
  formatIndicators, // Format individual indicators
  formatMultiSignalFromDB, // Format multi-signal dengan weights
} from "./chart.indicator.js";

// ✅ Export dari chart.metadata.js
// Fungsi-fungsi untuk statistics dan pagination
export {
  calculateMetadata, // Hitung metadata statistik
  buildPagination, // Build pagination URLs
} from "./chart.metadata.js";
