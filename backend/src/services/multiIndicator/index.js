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
  getOptimizationEstimate,
  runOptimization,
  runBacktestWithOptimizedWeights,
  optimizeAllCoins,
} from "./optimization.service.js";

// 📋 Export dari optimization-job.service.js
// Service untuk manajemen state jobs yang sedang berjalan
export {
  createJob,
  getJob,
  updateJob,
  addSSEClient,
  removeSSEClient,
  cancelJob,
  isCancelRequested,
  removeJob,
  getSSEClients,
  getRunningJobs,
  clearAllJobs,
} from "./optimization-job.service.js";

// 📡 Export dari sse.service.js
// Service untuk handling Server-Sent Events streaming
export {
  setupSSE,
  sendEvent,
  broadcastEvent,
  setupHeartbeat,
  closeSSE,
  closeAllSSE,
} from "./sse.service.js";

// 🎯 Export dari multi-indicator.service.js
// Service untuk core algorithm optimization dan backtesting
// ⚠️ CATATAN: computeAllIndicators, getWeightCombination, dan backtestWithWeightsCached
// adalah internal utility functions dan tidak di-export karena hanya digunakan internally
export {
  optimizeIndicatorWeights,
  backtestWithWeights,
} from "./multi-indicator.service.js";
