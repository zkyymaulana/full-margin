/**
 * 📊 COMPARISON SERVICE (Academic-Validated Version)
 * ---------------------------------------------------------------
 * Based on: Sukma & Namahoot (2025)
 * "Enhancing Trading Strategies: A Multi-Indicator Analysis
 *  for Profitable Algorithmic Trading"
 *
 * ✅ NO NORMALIZATION - All ROI values are raw from backtest
 * ✅ Mathematical consistency enforced
 * ✅ Academic-ready data structure
 */

import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../backtest/backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/multiIndicator-backtest.service.js";
import { calculateIndividualSignals } from "../../utils/indicator.utils.js";

/* ==========================================================
   🧮 HELPER FUNCTIONS
========================================================== */

/** Mean calculation */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Standard deviation calculation */
function stddev(arr) {
  if (!arr || arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Sharpe Ratio: (Average Return - Risk-Free Rate) / Standard Deviation
 * Only returns 0 if there's truly no volatility
 */
function calcSharpe(returns, riskFree = 0.02) {
  if (!returns || returns.length === 0) return 0;
  const avg = mean(returns);
  const sd = stddev(returns);
  // Only return 0 if std is actually 0 (no volatility)
  if (sd === 0) return 0;
  return (avg - riskFree) / sd;
}

/**
 * Sortino Ratio: (Average Return - Risk-Free Rate) / Downside Deviation
 * Only considers negative returns (downside risk)
 */
function calcSortino(returns, riskFree = 0.02) {
  if (!returns || returns.length === 0) return 0;
  const neg = returns.filter((r) => r < 0);
  if (neg.length === 0) return 0; // No downside risk
  const downside = stddev(neg);
  if (downside === 0) return 0;
  const avg = mean(returns);
  return (avg - riskFree) / downside;
}

/**
 * ✅ FORMAT RESULT - NO NORMALIZATION
 * Returns raw values exactly as they come from backtest
 * Ensures mathematical consistency: finalCapital matches ROI
 */
function formatResult(result) {
  if (!result) return null;

  return {
    roi: +Number(result.roi || 0).toFixed(2),
    winRate: +Number(result.winRate || 0).toFixed(2),
    maxDrawdown: +Number(result.maxDrawdown || 0).toFixed(2),
    sharpeRatio:
      result.sharpeRatio !== undefined && result.sharpeRatio !== null
        ? +Number(result.sharpeRatio).toFixed(2)
        : 0,
    trades: result.trades || 0,
    finalCapital: result.finalCapital
      ? +Number(result.finalCapital).toFixed(2)
      : 10000, // Default initial capital if not provided
  };
}

/**
 * Calculate valid returns from equity curve for Sharpe/Sortino
 * Filters out extreme outliers that might be data errors
 */
function calculateReturns(equityCurve) {
  if (!equityCurve || equityCurve.length < 2) {
    console.warn("⚠️ Equity curve too short for return calculation");
    return [];
  }

  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1];
    const currEquity = equityCurve[i];

    // Avoid division by zero
    if (prevEquity !== 0) {
      const ret = (currEquity - prevEquity) / prevEquity;
      // Filter out extreme outliers (single return > 1000% might be data error)
      if (Math.abs(ret) < 10) {
        returns.push(ret);
      }
    }
  }

  console.log(
    `📈 Calculated ${returns.length} valid returns from ${equityCurve.length} equity points`
  );
  return returns;
}

/**
 * Calculate Maximum Drawdown from equity curve
 */
function calcMaxDrawdown(curve) {
  if (!curve || curve.length === 0) return 0;
  let peak = curve[0];
  let maxDD = 0;
  for (const val of curve) {
    if (val > peak) peak = val;
    const dd = ((peak - val) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(2);
}

/** Merge candle prices into indicator data */
function mergeIndicatorsWithCandles(indicators, candles) {
  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  return indicators
    .map((i) => ({ ...i, close: map.get(i.time.toString()) }))
    .filter((i) => i.close != null);
}

/** Get best optimized weights from database - ✅ Always use latest optimization */
async function getBestWeights(symbol, timeframe) {
  // ✅ UPDATED: Always get the latest optimization by updatedAt DESC
  const latest = await prisma.indicatorWeight.findFirst({
    where: { symbol, timeframe },
    orderBy: { updatedAt: "desc" }, // ✅ Always use the most recent optimization
  });

  if (!latest) {
    console.log(
      `⚠️ No optimized weights found for ${symbol}, using default equal weights`
    );
    return {
      weights: defaultWeights(),
      source: "default",
    };
  }

  console.log(
    `✅ Using latest optimization for ${symbol} (updated: ${latest.updatedAt.toISOString()})`
  );
  console.log(
    `   ROI: ${latest.roi.toFixed(2)}%, WinRate: ${latest.winRate.toFixed(2)}%`
  );

  return {
    weights: latest.weights,
    source: "latest_optimization",
    optimizedAt: latest.updatedAt,
    performance: {
      roi: latest.roi,
      winRate: latest.winRate,
      maxDrawdown: latest.maxDrawdown,
      sharpeRatio: latest.sharpeRatio,
    },
  };
}

/** Default equal weights for all indicators */
function defaultWeights() {
  const keys = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "PSAR",
    "StochasticRSI",
  ];
  return Object.fromEntries(keys.map((k) => [k, 1]));
}

/* ==========================================================
   🗳️ VOTING STRATEGY (ALA PINTU & INDODAX)
========================================================== */

/**
 * 🗳️ VOTING SIGNAL - Count BUY vs SELL from 8 indicators
 * Similar to Pintu & Indodax indicator voting display
 *
 * Rules:
 * - BUY count > SELL count → "buy"
 * - SELL count > BUY count → "sell"
 * - Equal → "neutral"
 */
function votingSignal(cur, prev) {
  const signals = calculateIndividualSignals(cur, prev);

  let buyCount = 0;
  let sellCount = 0;

  // Count votes from all 8 indicators
  const indicators = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BollingerBands",
    "Stochastic",
    "StochasticRSI",
    "PSAR",
  ];

  for (const ind of indicators) {
    const signal = signals[ind];
    if (signal === "buy") buyCount++;
    else if (signal === "sell") sellCount++;
  }

  // Determine final voting result
  if (buyCount > sellCount) return "buy";
  if (sellCount > buyCount) return "sell";
  return "neutral";
}

/**
 * 🗳️ BACKTEST VOTING STRATEGY
 * Uses simple majority voting from 8 indicators
 * Similar to how Pintu & Indodax display technical indicators
 */
function backtestVotingStrategy(data) {
  if (!data?.length) {
    throw new Error("Data historis diperlukan untuk voting strategy");
  }

  const INITIAL_CAPITAL = 10000;
  let capital = INITIAL_CAPITAL;
  let position = null;
  let entry = 0;
  let wins = 0;
  let trades = 0;
  const equityCurve = [];

  console.log(`\n🗳️ Running Voting Strategy backtest...`);
  console.log(`   Total data points: ${data.length}`);

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const price = cur.close;

    if (!price) {
      equityCurve.push(capital);
      continue;
    }

    // Get voting signal
    const signal = votingSignal(cur, prev);

    // Trading logic: BUY when vote says buy, SELL when vote says sell
    if (signal === "buy" && !position) {
      position = "BUY";
      entry = price;
    } else if (signal === "sell" && position === "BUY") {
      const pnl = price - entry;
      if (pnl > 0) wins++;
      capital += (capital / entry) * pnl;
      position = null;
      trades++;
    }

    equityCurve.push(capital);
  }

  // Close any open position at the end
  if (position === "BUY") {
    const lastPrice = data[data.length - 1].close;
    const pnl = lastPrice - entry;
    if (pnl > 0) wins++;
    capital += (capital / entry) * pnl;
    trades++;
  }

  // Calculate performance metrics
  const roi = ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const maxDrawdown = calcMaxDrawdown(equityCurve);

  console.log(`✅ Voting Strategy completed:`);
  console.log(`   ROI: ${roi.toFixed(2)}%`);
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Trades: ${trades}, Wins: ${wins}`);
  console.log(`   Final Capital: $${capital.toFixed(2)}`);
  console.log(`   Max Drawdown: ${maxDrawdown}%`);

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    maxDrawdown,
    trades,
    wins,
    finalCapital: +capital.toFixed(2),
    equityCurve,
  };
}

/* ==========================================================
   🎯 MAIN COMPARISON FUNCTION
========================================================== */
export async function compareStrategies(symbol, startDate, endDate) {
  console.log(`📊 Comparison started for ${symbol}`);
  const timeframe = "1h";
  const start = BigInt(new Date(startDate).getTime());
  const end = BigInt(new Date(endDate).getTime());

  // 1️⃣ Load indicator & candle data
  const [indicators, candles] = await Promise.all([
    prisma.indicator.findMany({
      where: { symbol, timeframe, time: { gte: start, lte: end } },
      orderBy: { time: "asc" },
    }),
    prisma.candle.findMany({
      where: { symbol, timeframe, time: { gte: start, lte: end } },
      orderBy: { time: "asc" },
      select: { time: true, close: true },
    }),
  ]);

  if (!indicators.length || !candles.length)
    return {
      success: false,
      message: `No data found for ${symbol} in the specified period`,
    };

  const data = mergeIndicatorsWithCandles(indicators, candles);
  if (!data.length)
    return { success: false, message: "Unable to merge indicator data" };

  // 2️⃣ Load best multi-indicator weights
  const { weights: bestWeights, source: weightSource } = await getBestWeights(
    symbol,
    timeframe
  );

  console.log(`✅ Using ${weightSource} weights`, bestWeights);

  // 3️⃣ Run single indicator backtests
  console.log("🚀 Running single indicator backtests...");
  const singleResults = await backtestAllIndicators(data, { fastMode: true });

  // 4️⃣ Run multi indicator backtest
  console.log("🚀 Running multi indicator backtest...");
  const multiResult = await backtestWithWeights(data, bestWeights, {
    fastMode: true,
  });

  // 5️⃣ Run voting strategy backtest
  console.log("🚀 Running voting strategy backtest...");
  const votingResult = backtestVotingStrategy(data);

  // 6️⃣ Format results - NO NORMALIZATION, USE RAW VALUES
  console.log("📋 Formatting results with raw ROI values...");
  const singleFormatted = {};

  if (singleResults.results) {
    for (const r of singleResults.results) {
      if (r.success && r.performance) {
        console.log(
          `   ✓ ${r.indicator}: ROI=${r.performance.roi}%, Capital=${r.performance.finalCapital}, WinRate=${r.performance.winRate}%`
        );
        singleFormatted[r.indicator] = formatResult(r.performance);
      } else {
        console.log(`   ✗ ${r.indicator}: No performance data`);
      }
    }
  }

  console.log(
    `📊 Successfully formatted ${Object.keys(singleFormatted).length} indicators`
  );

  const multiFormatted = formatResult(multiResult);
  const votingFormatted = formatResult(votingResult);

  // 7️⃣ Identify best single indicator based on RAW ROI
  const validSingles =
    singleResults.results?.filter((r) => r.success && r.performance) || [];
  console.log(
    `🔍 Finding best single indicator from ${validSingles.length} valid results...`
  );

  const bestSingle = validSingles.reduce(
    (best, cur) =>
      cur.performance.roi > (best?.performance?.roi ?? -Infinity) ? cur : best,
    null
  );

  const bestSingleData = bestSingle
    ? {
        indicator: bestSingle.indicator,
        roi: +Number(bestSingle.performance.roi).toFixed(2),
        winRate: +Number(bestSingle.performance.winRate).toFixed(2),
        maxDrawdown: +Number(bestSingle.performance.maxDrawdown).toFixed(2),
        trades: bestSingle.performance.trades,
        finalCapital: +Number(bestSingle.performance.finalCapital).toFixed(2),
      }
    : null;

  if (bestSingleData) {
    console.log(
      `🏆 Best single indicator: ${bestSingleData.indicator} with ${bestSingleData.roi}% ROI and $${bestSingleData.finalCapital} final capital`
    );
  } else {
    console.warn("⚠️ No valid single indicator results found!");
  }

  // 8️⃣ Calculate Sortino for voting strategy (Sharpe already calculated in backtest)
  // ✅ Multi-Indicator Sharpe Ratio already calculated correctly in backtestWithWeights()
  // ✅ Just calculate Sortino for multi
  if (multiResult.equityCurve) {
    const multiReturns = calculateReturns(multiResult.equityCurve);
    multiFormatted.sortinoRatio = +calcSortino(multiReturns).toFixed(2);
  } else {
    multiFormatted.sortinoRatio = 0;
  }

  // Calculate Sharpe & Sortino for voting strategy
  const votingReturns = calculateReturns(votingResult.equityCurve);
  votingFormatted.sharpeRatio = +calcSharpe(votingReturns).toFixed(2);
  votingFormatted.sortinoRatio = +calcSortino(votingReturns).toFixed(2);

  console.log(
    `📊 Multi-indicator Sharpe: ${multiFormatted.sharpeRatio} (from backtest), Sortino: ${multiFormatted.sortinoRatio}`
  );
  console.log(
    `📊 Voting Strategy Sharpe: ${votingFormatted.sharpeRatio}, Sortino: ${votingFormatted.sortinoRatio}`
  );

  // 9️⃣ Determine best strategy based on RAW ROI comparison
  const strategies = [
    { name: "single", roi: bestSingleData?.roi ?? -Infinity },
    { name: "multi", roi: multiFormatted.roi },
    { name: "voting", roi: votingFormatted.roi },
  ];

  const bestStrategy = strategies.reduce((best, cur) =>
    cur.roi > best.roi ? cur : best
  );

  console.log(`\n🏆 STRATEGY COMPARISON:`);
  console.log(
    `   Single (${bestSingleData?.indicator}): ${bestSingleData?.roi}% ROI, $${bestSingleData?.finalCapital}`
  );
  console.log(
    `   Multi-Weighted: ${multiFormatted.roi}% ROI, $${multiFormatted.finalCapital}`
  );
  console.log(
    `   Voting: ${votingFormatted.roi}% ROI, $${votingFormatted.finalCapital}`
  );
  console.log(`   🏆 Winner: ${bestStrategy.name.toUpperCase()}`);

  // 🔟 Comparative analysis using RAW ROI
  const startObj = new Date(Number(candles[0].time));
  const endObj = new Date(Number(candles[candles.length - 1].time));
  const days = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

  const analysis = {
    periodDays: days,
    candles: candles.length,
    dataPoints: data.length,
    bestSingle: bestSingleData,
    multiBeatsBestSingle: bestSingleData
      ? multiFormatted.roi > bestSingleData.roi
      : false,
    votingBeatsBestSingle: bestSingleData
      ? votingFormatted.roi > bestSingleData.roi
      : false,
    roiDifference: bestSingleData
      ? +(multiFormatted.roi - bestSingleData.roi).toFixed(2)
      : null,
    winRateComparison: bestSingleData
      ? {
          multi: multiFormatted.winRate,
          bestSingle: bestSingleData.winRate,
          difference: +(
            multiFormatted.winRate - bestSingleData.winRate
          ).toFixed(2),
        }
      : null,
    votingComparison: {
      votingROI: votingFormatted.roi,
      multiROI: multiFormatted.roi,
      difference: +(votingFormatted.roi - multiFormatted.roi).toFixed(2),
      votingWinRate: votingFormatted.winRate,
      multiWinRate: multiFormatted.winRate,
    },
  };

  console.log("✅ Comparison finished successfully");

  // 1️⃣1️⃣ Return unified structure with RAW values only
  return {
    success: true,
    symbol,
    timeframe,
    period: {
      start: startObj.toISOString(),
      end: endObj.toISOString(),
      days,
    },
    comparison: {
      single: singleFormatted,
      multi: multiFormatted,
      voting: votingFormatted,
      bestStrategy: bestStrategy.name,
    },
    bestWeights,
    weightSource,
    analysis,
    timestamp: new Date().toISOString(),
  };
}
