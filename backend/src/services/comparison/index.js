/**
 * 📦 BARREL EXPORT - Module Comparison
 * ================================================================
 * File ini adalah entry point untuk modul comparison.
 * Menyediakan akses terpusat ke semua functions dari sub-modules.
 *
 * MENGAPA EXPLICIT EXPORTS?
 * ────────────────────────
 * ✅ API yang jelas dan terdokumentasi
 * ✅ Hanya export public functions yang intended
 * ✅ Mudah untuk tree-shaking dan optimization
 * ✅ Refactoring lebih aman
 *
 * PENGGUNAAN:
 * ──────────
 * import {
 *   compareStrategies,
 *   validateComparisonParams,
 *   handleComparisonError
 * } from "@/services/comparison";
 * ================================================================
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 MAIN ORCHESTRATION SERVICE
// ═══════════════════════════════════════════════════════════════

import { compareStrategies } from "./comparison.service.js";

// ═══════════════════════════════════════════════════════════════
// ✅ VALIDATION & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

import {
  validateComparisonParams,
  handleComparisonError,
} from "./comparison.validation.js";

// ═══════════════════════════════════════════════════════════════
// 📊 METRICS & FINANCIAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════

import {
  mean,
  stddev,
  calcSharpe,
  calcSortino,
  calculateReturns,
  calcMaxDrawdown,
  formatResult,
} from "./comparison.metrics.js";

// ═══════════════════════════════════════════════════════════════
// 🗳️ VOTING STRATEGY
// ═══════════════════════════════════════════════════════════════

import { votingSignal, backtestVotingStrategy } from "./comparison.backtest.js";

// ═══════════════════════════════════════════════════════════════
// 📥 DATA LOADING & MERGING
// ═══════════════════════════════════════════════════════════════

import {
  mergeIndicatorsWithCandles,
  getBestWeights,
  defaultWeights,
} from "./comparison.data.js";

// ═══════════════════════════════════════════════════════════════
// 📤 EXPLICIT EXPORTS
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 🎯 Main Orchestration
// ─────────────────────────────────────────────────────────────
export {
  compareStrategies, // Fungsi utama untuk membandingkan 3 strategi
};

// ─────────────────────────────────────────────────────────────
// ✅ Validation & Error Handling
// ─────────────────────────────────────────────────────────────
export {
  validateComparisonParams, // Validasi parameter request perbandingan
  handleComparisonError, // Handler error terpusat untuk comparison
};

// ─────────────────────────────────────────────────────────────
// 📊 Metrics & Financial Calculations
// ─────────────────────────────────────────────────────────────
export {
  mean, // Hitung rata-rata aritmatika
  stddev, // Hitung standar deviasi
  calcSharpe, // Hitung rasio Sharpe
  calcSortino, // Hitung rasio Sortino
  calculateReturns, // Hitung return dari equity curve
  calcMaxDrawdown, // Hitung drawdown maksimum
  formatResult, // Format hasil backtest agar rapi
};

// ─────────────────────────────────────────────────────────────
// 🗳️ Voting Strategy
// ─────────────────────────────────────────────────────────────
export {
  votingSignal, // Buat sinyal voting dari banyak indikator
  backtestVotingStrategy, // Backtest strategi voting indikator
};

// ─────────────────────────────────────────────────────────────
// 📥 Data Loading & Merging
// ─────────────────────────────────────────────────────────────
export {
  mergeIndicatorsWithCandles, // Gabungkan data indikator dan candle
  getBestWeights, // Ambil bobot terbaik dari DB atau default
  defaultWeights, // Konstanta bobot default
};
