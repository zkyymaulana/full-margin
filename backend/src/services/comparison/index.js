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
  compareStrategies, // Main function: Compare 3 strategies (single, multi, voting)
};

// ─────────────────────────────────────────────────────────────
// ✅ Validation & Error Handling
// ─────────────────────────────────────────────────────────────
export {
  validateComparisonParams, // Validate request parameters
  handleComparisonError, // Centralized error handler
};

// ─────────────────────────────────────────────────────────────
// 📊 Metrics & Financial Calculations
// ─────────────────────────────────────────────────────────────
export {
  mean, // Calculate arithmetic mean
  stddev, // Calculate standard deviation
  calcSharpe, // Calculate Sharpe Ratio
  calcSortino, // Calculate Sortino Ratio
  calculateReturns, // Calculate returns from equity curve
  calcMaxDrawdown, // Calculate maximum drawdown
  formatResult, // Format backtest results
};

// ─────────────────────────────────────────────────────────────
// 🗳️ Voting Strategy
// ─────────────────────────────────────────────────────────────
export {
  votingSignal, // Generate voting signal from indicators
  backtestVotingStrategy, // Backtest voting strategy
};

// ─────────────────────────────────────────────────────────────
// 📥 Data Loading & Merging
// ─────────────────────────────────────────────────────────────
export {
  mergeIndicatorsWithCandles, // Merge indicator and candle data
  getBestWeights, // Get optimal weights from database or default
  defaultWeights, // Default weights constant
};
