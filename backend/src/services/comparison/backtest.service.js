/* ===========================================================
   🎯 ENHANCED BACKTESTING SERVICE (Academic Standards)
   =========================================================== */

/** 🔹 Helper function to get price at index */
function priceAt(i, map, data) {
  return map.get(data[i]?.time?.toString()) || 0;
}

/** 🔹 Signal confirmation helper - check for N consecutive signals */
function isSignalConfirmed(signals, index, targetSignal, confirmN = 2) {
  if (index < confirmN - 1) return false;

  for (let i = 0; i < confirmN; i++) {
    if (signals[index - i] !== targetSignal) return false;
  }
  return true;
}

/** 🔹 Calculate Profit Factor */
function calculateProfitFactor(trades) {
  if (!trades || trades.length === 0) return 0;

  const grossProfit = trades
    .filter((t) => t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0);

  const grossLoss = Math.abs(
    trades.filter((t) => t.profit < 0).reduce((sum, t) => sum + t.profit, 0)
  );

  return grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : 0;
}

/** 🔹 Calculate Maximum Consecutive Losses */
function calculateMaxConsecutiveLosses(trades) {
  if (!trades || trades.length === 0) return 0;

  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (const trade of trades) {
    if (!trade.isWin) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return maxConsecutive;
}

/** 🔹 Calculate Sortino Ratio */
function calculateSortinoRatio(returns, riskFreeRate = 0.02) {
  if (!returns || returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter((r) => r < 0);

  if (downside.length === 0) return 0;

  const downsideStd = Math.sqrt(
    downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length
  );

  const periodRiskFreeRate = riskFreeRate / (365 * 24);
  return downsideStd > 0 ? (avgReturn - periodRiskFreeRate) / downsideStd : 0;
}

// Enhanced Trading Configuration for 1H Timeframe - Based on Academic Research
export const TRADING_CONFIG_1H = {
  // Transaction costs optimized for high-frequency trading
  fee: 0.0005, // 0.05% - lower for 1H timeframe

  // Risk management parameters - more conservative for 1H
  stopLoss: -0.025, // -2.5% stop loss
  takeProfit: 0.035, // +3.5% take profit
  positionSize: 0.1, // 10% position size

  // Time-based parameters for 1H timeframe
  minHoldPeriod: 6, // 6 hours minimum
  maxHoldPeriod: 72, // 72 hours maximum (3 days)
  cooldownPeriod: 12, // 12 hours between trades

  // Signal confirmation - stricter for noisy 1H data
  confirmationCandles: 3, // Require 3 consecutive signals
  confidenceThreshold: 0.4, // 40% minimum confidence

  // Market condition filters
  volatilityThreshold: 0.05, // Skip trading if volatility > 5%
  trendAlignment: true, // Only trade with trend
  maxDailyTrades: 2, // Maximum 2 trades per day

  // Academic metrics configuration
  riskFreeRate: 0.02, // 2% annual
  benchmarkReturn: 0.08, // 8% annual benchmark
};

// Parameter optimization for different market conditions
export const MARKET_ADAPTIVE_CONFIG = {
  // Low volatility market (VIX-like < 20)
  lowVolatility: {
    ...TRADING_CONFIG_1H,
    stopLoss: -0.02, // Tighter stop loss
    takeProfit: 0.03, // Lower target
    positionSize: 0.12, // Slightly larger position
    confirmationCandles: 2, // Less confirmation needed
  },

  // High volatility market (VIX-like > 30)
  highVolatility: {
    ...TRADING_CONFIG_1H,
    stopLoss: -0.03, // Wider stop loss
    takeProfit: 0.045, // Higher target
    positionSize: 0.08, // Smaller position
    confirmationCandles: 4, // More confirmation needed
    cooldownPeriod: 18, // Longer cooldown
  },

  // Trending market
  trending: {
    ...TRADING_CONFIG_1H,
    stopLoss: -0.035, // Wider stops for trends
    takeProfit: 0.05, // Higher targets
    minHoldPeriod: 12, // Hold longer in trends
    maxDailyTrades: 3, // More trades allowed
  },

  // Sideways market
  sideways: {
    ...TRADING_CONFIG_1H,
    stopLoss: -0.015, // Tight stops for range
    takeProfit: 0.025, // Quick profits
    maxDailyTrades: 1, // Fewer trades
    confirmationCandles: 4, // High confirmation
  },
};

/** 🔹 Enhanced Optimized Backtest Implementation - ULTRA CONSERVATIVE FOR 1H */
export function calculateBacktest(signals, map, data, options = {}) {
  if (!signals?.length || signals.length < 10 || !data?.length)
    return { roi: 0, winRate: 0, maxDrawdown: 0, trades: 0, sharpeRatio: 0 };

  // ULTRA CONSERVATIVE Configuration for 1H timeframe
  const config = {
    fee: options.fee || 0.0002, // 0.02% transaction fee
    sl: options.sl || -0.012, // -1.2% Stop Loss
    tp: options.tp || 0.02, // +2% Take Profit
    positionSize: options.positionSize || 0.03, // 3% position size
    minHold: options.minHold || 12, // 12 hours minimum hold
    coolDown: options.coolDown || 24, // 24 hours cooldown
    confirmN: options.confirmN || 5, // 5 signal confirmation
    execNext: options.execNext !== false,
    longOnly: options.longOnly !== false,
    initialBalance: options.initialBalance || 1000,
    riskFreeRate: options.riskFreeRate || 0.02,

    // ULTRA CONSERVATIVE filters
    volatilityFilter: options.volatilityFilter !== false,
    trendFilter: options.trendFilter !== false,
    maxDailyTrades: options.maxDailyTrades || 1,
    minPriceMove: options.minPriceMove || 0.008, // 0.8% minimum move
    maxVolatility: options.maxVolatility || 0.025, // 2.5% max volatility
    trendStrength: options.trendStrength || 0.015, // 1.5% trend strength

    // Risk limits
    maxConsecutiveLosses: 2, // Stop after 2 losses
    pauseAfterLosses: 48, // 48 hours pause
    maxPositionsPerWeek: 3, // Max 3 positions per week
  };

  let balance = config.initialBalance;
  let position = null;
  let entryPrice = 0;
  let entryIndex = 0;
  let cooldownUntil = 0;
  let dailyTradeCount = 0;
  let lastTradeDay = null;
  let consecutiveLosses = 0;
  let pauseUntil = 0;
  let weeklyTrades = 0;
  let lastWeek = null;

  const trades = [];
  const balanceHistory = [balance];
  const returns = [];
  let peakBalance = balance;
  let maxDrawdown = 0;

  // Enhanced signal processing with ultra-strict confirmation
  for (let i = Math.max(config.confirmN, 48); i < signals.length - 1; i++) {
    const signal = signals[i];
    const currentPrice = priceAt(i, map, data);
    const nextPrice = priceAt(i + 1, map, data);

    if (!currentPrice || !nextPrice || currentPrice <= 0 || nextPrice <= 0) {
      balanceHistory.push(balance);
      returns.push(0);
      continue;
    }

    // Reset daily/weekly counters
    const currentDay = new Date(Number(data[i]?.time)).toDateString();
    const currentWeek = Math.floor(
      new Date(Number(data[i]?.time)).getTime() / (7 * 24 * 60 * 60 * 1000)
    );

    if (currentDay !== lastTradeDay) {
      dailyTradeCount = 0;
      lastTradeDay = currentDay;
    }

    if (currentWeek !== lastWeek) {
      weeklyTrades = 0;
      lastWeek = currentWeek;
    }

    // Skip if in pause, cooldown, or limits reached
    if (
      i < cooldownUntil ||
      i < pauseUntil ||
      dailyTradeCount >= config.maxDailyTrades ||
      weeklyTrades >= config.maxPositionsPerWeek
    ) {
      balanceHistory.push(balance);
      returns.push(0);
      continue;
    }

    // ULTRA STRICT VOLATILITY FILTER
    if (config.volatilityFilter && i >= 48) {
      const recentPrices = [];
      for (let j = i - 47; j <= i; j++) {
        const price = priceAt(j, map, data);
        if (price > 0) recentPrices.push(price);
      }

      if (recentPrices.length >= 40) {
        const returns48h = [];
        for (let k = 1; k < recentPrices.length; k++) {
          returns48h.push(
            (recentPrices[k] - recentPrices[k - 1]) / recentPrices[k - 1]
          );
        }
        const volatility = Math.sqrt(
          returns48h.reduce((sum, r) => sum + r * r, 0) / returns48h.length
        );

        // Skip trading if volatility > 2.5%
        if (volatility > config.maxVolatility) {
          balanceHistory.push(balance);
          returns.push(0);
          continue;
        }
      }
    }

    // ULTRA STRICT TREND FILTER
    if (config.trendFilter && i >= 72) {
      const price72h = priceAt(i - 72, map, data);
      const price48h = priceAt(i - 48, map, data);
      const price24h = priceAt(i - 24, map, data);

      if (price72h > 0 && price48h > 0 && price24h > 0) {
        const longTrend = (currentPrice - price72h) / price72h;
        const midTrend = (currentPrice - price48h) / price48h;
        const shortTrend = (currentPrice - price24h) / price24h;

        // Only trade if all trends align and are strong enough
        if (signal === "BUY") {
          if (
            longTrend < config.trendStrength ||
            midTrend < config.trendStrength ||
            shortTrend < 0
          ) {
            balanceHistory.push(balance);
            returns.push(0);
            continue;
          }
        }
        if (signal === "SELL" && !config.longOnly) {
          if (
            longTrend > -config.trendStrength ||
            midTrend > -config.trendStrength ||
            shortTrend > 0
          ) {
            balanceHistory.push(balance);
            returns.push(0);
            continue;
          }
        }
      }
    }

    // Enhanced position monitoring with trailing stop
    if (position) {
      const holdingPeriod = i - entryIndex;
      const currentReturn =
        position === "BUY"
          ? (currentPrice - entryPrice) / entryPrice
          : (entryPrice - currentPrice) / entryPrice;

      // Adaptive trailing stop loss
      let dynamicSL = config.sl;
      if (holdingPeriod >= 24 && currentReturn > 0.01) {
        // After 24 hours with 1% profit
        dynamicSL = Math.max(config.sl, currentReturn * 0.3); // Trail at 30% of profit
      }

      // Enhanced exit conditions
      const hitSL = currentReturn <= dynamicSL;
      const hitTP = currentReturn >= config.tp;
      const minHoldMet = holdingPeriod >= config.minHold;
      const maxHoldExceeded = holdingPeriod >= 168; // 7 days max hold

      // Confirmed opposite signal with ultra-strict confirmation
      const oppositeSignal =
        minHoldMet &&
        isSignalConfirmed(
          signals,
          i,
          position === "BUY" ? "SELL" : "BUY",
          config.confirmN
        );

      if (hitSL || hitTP || oppositeSignal || maxHoldExceeded) {
        const exitPrice = currentPrice;
        const finalReturn =
          position === "BUY"
            ? (exitPrice - entryPrice) / entryPrice
            : (entryPrice - exitPrice) / entryPrice;

        // Apply transaction costs
        const netReturn = finalReturn - config.fee * 2; // Entry + exit fees

        // Calculate position value and profit with strict risk limits
        const positionValue = balance * config.positionSize;
        const profit = positionValue * netReturn;

        // Ultra-strict risk limits
        const maxLoss = -positionValue * 0.015; // Max 1.5% loss per trade
        const maxGain = positionValue * 0.025; // Max 2.5% gain per trade
        const limitedProfit = Math.max(maxLoss, Math.min(maxGain, profit));

        balance += limitedProfit;

        trades.push({
          entryPrice,
          exitPrice,
          position,
          return: netReturn,
          profit: limitedProfit,
          isWin: limitedProfit > 0,
          holdingPeriod,
          reason: hitSL
            ? "SL"
            : hitTP
              ? "TP"
              : maxHoldExceeded
                ? "MaxHold"
                : "Signal",
          entryTime: data[entryIndex]?.time,
          exitTime: data[i]?.time,
        });

        // Track consecutive losses for circuit breaker
        if (limitedProfit < 0) {
          consecutiveLosses++;
          if (consecutiveLosses >= config.maxConsecutiveLosses) {
            pauseUntil = i + config.pauseAfterLosses;
            consecutiveLosses = 0;
          }
        } else {
          consecutiveLosses = 0;
        }

        position = null;
        cooldownUntil = i + config.coolDown;
        dailyTradeCount++;
        weeklyTrades++;
      }
    }

    // ULTRA STRICT position opening
    if (!position && isSignalConfirmed(signals, i, signal, config.confirmN)) {
      if (config.longOnly && signal === "SELL") {
        balanceHistory.push(balance);
        returns.push(0);
        continue;
      }

      // Check minimum price movement
      const priceChange =
        Math.abs(currentPrice - priceAt(i - 1, map, data)) / currentPrice;
      if (priceChange < config.minPriceMove) {
        balanceHistory.push(balance);
        returns.push(0);
        continue;
      }

      const executionPrice = config.execNext ? nextPrice : currentPrice;

      // Ultra-strict entry validation
      if (executionPrice > 0 && balance > config.initialBalance * 0.5) {
        // Keep 50% reserve
        const entryFee = balance * config.positionSize * config.fee;
        balance -= entryFee;

        position = signal;
        entryPrice = executionPrice;
        entryIndex = i;
        dailyTradeCount++;
        weeklyTrades++;
      }
    }

    // Calculate period return for Sharpe ratio
    const periodReturn =
      balanceHistory.length > 1
        ? (balance - balanceHistory[balanceHistory.length - 1]) /
          balanceHistory[balanceHistory.length - 1]
        : 0;

    returns.push(periodReturn);
    balanceHistory.push(balance);

    // Update drawdown
    peakBalance = Math.max(peakBalance, balance);
    const drawdown = (peakBalance - balance) / peakBalance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Close final position with same logic
  if (position && data.length > 1) {
    const finalPrice = priceAt(data.length - 1, map, data);
    if (finalPrice > 0) {
      const finalReturn =
        position === "BUY"
          ? (finalPrice - entryPrice) / entryPrice
          : (entryPrice - finalPrice) / entryPrice;

      const netReturn = finalReturn - config.fee * 2;
      const positionValue = balance * config.positionSize;
      const profit = positionValue * netReturn;

      const maxLoss = -positionValue * 0.015;
      const maxGain = positionValue * 0.025;
      const limitedProfit = Math.max(maxLoss, Math.min(maxGain, profit));

      balance += limitedProfit;

      trades.push({
        entryPrice,
        exitPrice: finalPrice,
        position,
        return: netReturn,
        profit: limitedProfit,
        isWin: limitedProfit > 0,
        holdingPeriod: data.length - 1 - entryIndex,
        reason: "Final",
      });
    }
  }

  // Enhanced metrics calculation
  const roi = ((balance - config.initialBalance) / config.initialBalance) * 100;
  const winningTrades = trades.filter((t) => t.isWin).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  // Sharpe Ratio calculation
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const returnStd =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            (returns.length - 1)
        )
      : 0;

  const periodRiskFreeRate = config.riskFreeRate / (365 * 24);
  const sharpeRatio =
    returnStd > 0 ? (avgReturn - periodRiskFreeRate) / returnStd : 0;

  // Additional metrics
  const totalReturn = roi / 100;
  const annualizedReturn =
    Math.pow(1 + totalReturn, (365 * 24) / data.length) - 1;
  const annualizedSharpe = sharpeRatio * Math.sqrt(365 * 24);

  return {
    roi: Math.max(-50, Math.min(100, +roi.toFixed(2))), // Cap at reasonable limits
    winRate: +winRate.toFixed(2),
    maxDrawdown: +(maxDrawdown * 100).toFixed(2),
    trades: trades.length,
    sharpeRatio: +annualizedSharpe.toFixed(3),
    annualizedReturn: +(annualizedReturn * 100).toFixed(2),
    avgHoldingPeriod:
      trades.length > 0
        ? +(
            trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
          ).toFixed(1)
        : 0,
    profitFactor: calculateProfitFactor(trades),
    maxConsecutiveLosses: calculateMaxConsecutiveLosses(trades),
    // Additional info
    totalCandles: data.length,
    tradingDays: Math.ceil(data.length / 24),
    config: config,
  };
}
