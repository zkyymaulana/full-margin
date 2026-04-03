/**
 * 📦 Barrel File - Domain Multi-Indicator
 * ================================================================
 * File ini mengumpulkan semua export dari service di folder multiIndicator
 * agar file lain cukup melakukan import dari folder saja.
 *
 * Manfaat:
 * ✓ Struktur import lebih bersih dan konsisten
 * ✓ Menghindari import path yang panjang dan berbelit
 * ✓ Mempermudah refactoring (perubahan struktur internal tidak mempengaruhi consumer)
 * ✓ Dokumentasi yang jelas tentang public API
 *
 * Contoh penggunaan:
 * import { runOptimization, createJob, setupSSE } from "@/services/multiIndicator";
 *
 * Alih-alih:
 * import * as optimizationService from "../services/multiIndicator/optimization.service.js";
 * ================================================================
 */

// 🎯 Export dari optimization.service.js
// Service untuk orkestrasi workflow optimization end-to-end
export {
  getOptimizationEstimate, // Hitung estimasi durasi optimasi
  runOptimization, // Jalankan proses optimasi utama
  runBacktestWithOptimizedWeights, // Backtest dengan bobot hasil optimasi
  optimizeAllCoins, // Optimasi massal untuk semua top coin
} from "./optimization.service.js";

// 📋 Export dari optimization-job.service.js
// Service untuk manajemen state jobs yang sedang berjalan
export {
  createJob, // Buat job optimasi baru
  getJob, // Ambil data job berdasarkan simbol
  updateJob, // Perbarui status/progress job
  addSSEClient, // Tambah client SSE ke job
  removeSSEClient, // Lepas client SSE dari job
  cancelJob, // Tandai job untuk dibatalkan
  isCancelRequested, // Cek apakah cancel diminta
  removeJob, // Hapus job dari memori
  getSSEClients, // Ambil semua client SSE pada job
  getRunningJobs, // Ambil daftar job yang sedang berjalan
  clearAllJobs, // Hapus semua job dari memori
} from "./optimization-job.service.js";

// 📡 Export dari sse.service.js
// Service untuk handling Server-Sent Events streaming
export {
  setupSSE, // Siapkan header koneksi SSE
  sendEvent, // Kirim satu event SSE ke client
  broadcastEvent, // Broadcast event SSE ke banyak client
  setupHeartbeat, // Kirim heartbeat agar koneksi SSE tetap hidup
  closeSSE, // Tutup satu koneksi SSE
  closeAllSSE, // Tutup seluruh koneksi SSE
} from "./sse.service.js";

// 🎯 Export dari multi-indicator.service.js
// Service untuk core algorithm optimization dan backtesting
// ⚠️ CATATAN: computeAllIndicators, getWeightCombination, dan backtestWithWeightsCached
// adalah internal utility functions dan tidak di-export karena hanya digunakan internally
export {
  optimizeIndicatorWeights, // Cari bobot indikator terbaik
  backtestWithWeights, // Uji performa dengan bobot tertentu
} from "./multi-indicator.service.js";
