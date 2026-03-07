import {
  calculateIndividualSignals,
  scoreSignal,
  calcMaxDrawdown,
} from "../../utils/indicator.utils.js";
import { calcRiskMetrics } from "../backtest/backtest.utils.js";

/**
 * 📊 RULE-BASED DECISION SUPPORT SYSTEM (DSS) BACKTEST
 * ========================================================================
 * Academic Approach: Pure Rule-Based Multi-Indicator Trading Strategy
 *
 * 🎯 METHODOLOGY (Sesuai Standar Akademik):
 *
 * 1. Signal Extraction:
 *    - Each indicator produces discrete signal: +1 (BUY), -1 (SELL), 0 (NEUTRAL)
 *    - Total 8 technical indicators: SMA, EMA, RSI, MACD, BB, Stochastic, StochRSI, PSAR
 *
 * 2. Weighted Aggregation:
 *    weightedScore = Σ(weight_i × signal_i)
 *    where:
 *    - weight_i: optimized weight for indicator i (range: 0-4)
 *    - signal_i: discrete signal from indicator i (+1, -1, or 0)
 *
 * 3. Score Normalization:
 *    finalScore = weightedScore / Σ(|weight_i|)
 *
 *    This ensures finalScore ∈ [-1, +1]:
 *    - Best case (all BUY):  finalScore = Σ(weight_i × 1) / Σ(weight_i) = 1
 *    - Worst case (all SELL): finalScore = Σ(weight_i × -1) / Σ(weight_i) = -1
 *    - Neutral: finalScore = 0
 *
 * 4. Decision Boundary (Threshold = 0):
 *    - finalScore > 0  → BUY  (Bullish consensus)
 *    - finalScore < 0  → SELL (Bearish consensus)
 *    - finalScore = 0  → NEUTRAL (No consensus)
 *
 *    🔑 Rationale:
 *    - Zero is the natural boundary between bullish and bearish sentiment
 *    - Deterministic and transparent (no arbitrary threshold tuning)
 *    - Suitable for academic research and reproducibility
 *
 * 5. Trading Logic (Simple Long-Only):
 *    - Entry: finalScore crosses above 0 (bullish consensus emerges)
 *    - Exit: finalScore crosses below 0 (bearish consensus emerges)
 *    - Hold: Maintain position while finalScore remains same side of 0
 *
 * 6. Evaluation Metrics:
 *    - ROI (Return on Investment) - Primary profitability metric
 *    - Win Rate - Quality of trading signals
 *    - Maximum Drawdown - Risk exposure
 *    - Sharpe Ratio - Risk-adjusted return
 *    - Number of Trades - Strategy activity level
 *
 * ⚠️ IMPORTANT NOTES:
 * - This is a PURE RULE-BASED system (no ML, no adaptive thresholds)
 * - All decisions are deterministic and explainable
 * - Suitable for academic thesis and research papers
 * - Transparent enough for regulatory compliance
 * ========================================================================
 */
export async function backtestWithWeights(
  data,
  weights = {},
  { fastMode = false, threshold = 0 } = {} // ✅ NEW: Accept threshold parameter
) {
  if (!data?.length) throw new Error("Data historis kosong");

  // ✅ VALIDATION: Ensure all required indicators have weights
  const requiredIndicators = [
    "SMA",
    "EMA",
    "PSAR",
    "RSI",
    "MACD",
    "Stochastic",
    "StochasticRSI",
    "BollingerBands",
  ];

  const missingIndicators = requiredIndicators.filter(
    (ind) => !weights.hasOwnProperty(ind)
  );

  if (missingIndicators.length > 0) {
    throw new Error(
      `❌ WEIGHTS NOT FOUND: Missing weights for indicators: ${missingIndicators.join(", ")}. ` +
        `Please run optimization first via /api/multi-indicator/:symbol/optimize-weights`
    );
  }

  // ✅ Calculate sum of absolute weights for normalization
  const sumAbsWeights = Object.values(weights).reduce(
    (sum, w) => sum + Math.abs(w || 0),
    0
  );

  if (sumAbsWeights === 0) {
    throw new Error(
      "❌ INVALID WEIGHTS: All weights are zero. Please run optimization to get valid weights."
    );
  }

  // ✅ Validate weights are within acceptable range (0-4 for grid search)
  const invalidWeights = Object.entries(weights).filter(
    ([_, w]) => w < 0 || w > 4
  );

  if (invalidWeights.length > 0) {
    throw new Error(
      `❌ INVALID WEIGHTS: Weights must be in range [0-4]. Invalid: ${invalidWeights.map(([k, v]) => `${k}=${v}`).join(", ")}`
    );
  }

  console.log(
    `\n🎯 [DSS Backtest] Starting Rule-Based Decision Support System`
  );
  console.log(`📊 [DSS] Optimized Weights:`, weights);
  console.log(`📐 [DSS] Sum of Absolute Weights: ${sumAbsWeights}`);
  console.log(`🎲 [DSS] Decision Boundary: ${threshold} (custom threshold)`); // ✅ Show custom threshold
  console.log(`📏 [DSS] Expected Final Score Range: [-1, +1]\n`);

  const INITIAL_CAPITAL = 10_000;

  // 🎯 DSS DECISION BOUNDARY (CONFIGURABLE THRESHOLD)
  const DECISION_THRESHOLD = threshold; // ✅ Use parameter instead of hardcoded 0

  let capital = INITIAL_CAPITAL;
  let position = null; // null | "BUY"
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const price = cur.close;

    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    // 1️⃣ EXTRACT DISCRETE SIGNALS FROM EACH INDICATOR
    const signals = calculateIndividualSignals(cur, prev);

    // 2️⃣ WEIGHTED AGGREGATION
    let weightedSum = 0;
    for (const [indicator, weight] of Object.entries(weights)) {
      const signal = signals[indicator] || "neutral";
      const signalScore = scoreSignal(signal); // +1, -1, or 0
      weightedSum += weight * signalScore;
    }

    // 3️⃣ NORMALIZATION (Critical: ensures finalScore ∈ [-1, +1])
    const finalScore = sumAbsWeights > 0 ? weightedSum / sumAbsWeights : 0;

    // 🔍 DEBUG: Log first few iterations and periodic samples
    if (i < 3 || i % 2000 === 0) {
      console.log(
        `[Candle ${i}] weightedSum=${weightedSum.toFixed(3)}, ` +
          `sumAbsWeights=${sumAbsWeights}, finalScore=${finalScore.toFixed(3)}`
      );
    }

    // 4️⃣ RULE-BASED DECISION LOGIC WITH CUSTOM THRESHOLD
    //
    // ✅ ENTRY RULE: finalScore crosses above threshold
    if (finalScore > DECISION_THRESHOLD && !position) {
      position = "BUY";
      entry = price;
      console.log(
        `🟢 [BUY] Candle ${i}: finalScore=${finalScore.toFixed(3)} > ${DECISION_THRESHOLD}, ` +
          `price=$${price.toFixed(2)}`
      );
    }

    // ✅ EXIT RULE: finalScore crosses below -threshold (symmetric)
    else if (finalScore < -DECISION_THRESHOLD && position === "BUY") {
      const pnl = price - entry;
      const pnlPercent = ((pnl / entry) * 100).toFixed(2);

      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;

      console.log(
        `🔴 [SELL] Candle ${i}: finalScore=${finalScore.toFixed(3)} < ${-DECISION_THRESHOLD}, ` +
          `price=$${price.toFixed(2)}, PnL=$${pnl.toFixed(2)} (${pnlPercent}%)`
      );

      position = null;
      trades++;
    }

    // ⏸️ HOLD: finalScore hasn't crossed threshold
    // → Maintain current position (or stay out of market)

    equityCurve.push(capital);
  }

  // 🔚 CLOSE POSITION AT END (if still open)
  if (position === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    const pnlPercent = ((pnl / entry) * 100).toFixed(2);

    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;

    console.log(
      `🔴 [FORCE CLOSE] End of data: price=$${lastPrice.toFixed(2)}, ` +
        `PnL=$${pnl.toFixed(2)} (${pnlPercent}%)`
    );
  }

  // 📊 CALCULATE PERFORMANCE METRICS
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const maxDrawdown = calcMaxDrawdown(equityCurve);
  const riskMetrics = calcRiskMetrics(equityCurve);
  const sharpeRatio = riskMetrics?.sharpeRatio ?? 0; // ✅ FIXED: Handle null/undefined

  console.log(`\n✅ [DSS Backtest Complete]`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   💰 ROI: ${roi.toFixed(2)}%`);
  console.log(`   📈 Final Capital: $${capital.toFixed(2)}`);
  console.log(`   🎯 Win Rate: ${winRate.toFixed(2)}% (${wins}/${trades})`);
  console.log(`   📉 Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
  console.log(`   📊 Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
  console.log(`   🔢 Total Trades: ${trades}`);
  console.log(`   🎲 Threshold Used: ±${threshold}`);
  console.log(`   📅 Data Points: ${data.length}`);

  // ⚠️ Warning if no trades occurred
  if (trades === 0) {
    console.log(
      `   ⚠️  WARNING: No trades executed with threshold ±${threshold}`
    );
    console.log(
      `   💡 Try using a lower threshold (e.g., 0 or 0.2) for more trades`
    );
  }

  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return {
    success: true,
    methodology: `Rule-Based DSS with Threshold ±${threshold}`,
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    maxDrawdown: +maxDrawdown.toFixed(2),
    sharpeRatio: +sharpeRatio.toFixed(2),
    threshold, // ✅ Include threshold in result
    dataPoints: data.length,
    equityCurve, // For Sortino ratio calculation in comparison
  };
}
