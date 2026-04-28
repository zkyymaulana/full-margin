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

// Export dari chart.service.js untuk query dan simpan candle data.
export {
  getLastCandleTime, // Ambil waktu candle terakhir
  getCandleCount, // Hitung total candle
  getChartData, // Query candle (oldest first)
  getChartDataNewest, // Query candle (newest first)
  saveCandlesToDB, // Simpan candle baru ke database
} from "./chart.service.js";

// Export dari chart.data.js untuk data retrieval dan proses merge.
export {
  getCoinAndTimeframe, // Ambil coin & timeframe records
  getLatestWeights, // Ambil bobot indikator optimal
  getIndicatorsForTimeRange, // Ambil/recalculate indicator
  mergeChartData, // Merge candle dengan indicator
} from "./chart.data.js";

// Export dari chart.indicator.js untuk formatting indikator dan sinyal.
export {
  formatIndicators, // Format individual indicators
} from "./chart.indicator.js";

// Export dari chart.metadata.js untuk metadata statistik dan pagination.
export {
  calculateMetadata, // Hitung metadata statistik
  buildPagination, // Build pagination URLs
} from "./chart.metadata.js";
