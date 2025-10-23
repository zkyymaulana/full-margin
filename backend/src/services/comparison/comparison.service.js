import { prisma } from "../../lib/prisma.js";

/**
 * 🔹 Convert Date String → BigInt Timestamp
 */
const toBigInt = (date) => BigInt(new Date(date).getTime());

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

/** 🔹 Enhanced Backtest Implementation - FIXED VERSION */
function calculateBacktest(signals, map, data, options = {}) {
  if (!signals?.length || signals.length < 10 || !data?.length)
    return { roi: 0, winRate: 0, maxDrawdown: 0, trades: 0, sharpeRatio: 0 };

  // USE THE CONFIGURATION PASSED FROM compareStrategies
  const config = {
    fee: options.fee || 0.002,
    sl: options.sl || -0.025,
    tp: options.tp || 0.05,
    positionSize: options.positionSize || 0.12,
    minHold: options.minHold || 2,
    coolDown: options.coolDown || 1,
    // cap confirmation candles to at most 3 to avoid over-strict entries
    confirmN: Math.min(options.confirmN || 1, 3),
    execNext: options.execNext !== false,
    longOnly: options.longOnly !== false,
    initialBalance: options.initialBalance || 1000,
    riskFreeRate: options.riskFreeRate || 0.02,
    maxDailyTrades: options.maxDailyTrades || 6,
    maxConsecutiveLosses: options.maxConsecutiveLosses || 3,
    pauseAfterLosses: options.pauseAfterLosses || 4,
    maxDrawdownLimit: options.maxDrawdownLimit || 0.2,
    compounding: options.compounding !== false,
    // dynamic risk controls (ATR/volatility proxy)
    dynamicRiskEnabled: options.dynamicRiskEnabled !== false,
    dynLookback: options.dynLookback || 14,
    dynSLMult: options.dynSLMult || 1.2, // ~1.2 * vol
    dynTPMult: options.dynTPMult || 2.5, // ~2.5 * vol
    // clamps for dynamic tp/sl
    dynSLClamp: options.dynSLClamp || { min: -0.03, max: -0.006 },
    dynTPClamp: options.dynTPClamp || { min: 0.015, max: 0.05 },
    ...options, // Include all other options
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

  const trades = [];
  const balanceHistory = [balance];
  const returns = [];
  let peakBalance = balance;
  let maxDrawdown = 0;

  // helper: recent volatility (stddev of pct returns)
  function recentVolatility(idx, lookback = 14) {
    const start = Math.max(1, idx - lookback + 1);
    const changes = [];
    for (let k = start; k <= idx; k++) {
      const p = priceAt(k, map, data);
      const pp = priceAt(k - 1, map, data);
      if (p > 0 && pp > 0) {
        changes.push((p - pp) / pp);
      }
    }
    if (changes.length < 2) return 0;
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance =
      changes.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
      (changes.length - 1);
    return Math.sqrt(variance);
  }

  // Enhanced signal processing
  for (let i = Math.max(config.confirmN, 12); i < signals.length - 1; i++) {
    const signal = signals[i];
    const currentPrice = priceAt(i, map, data);
    const nextPrice = priceAt(i + 1, map, data);

    if (!currentPrice || !nextPrice || currentPrice <= 0 || nextPrice <= 0) {
      balanceHistory.push(balance);
      returns.push(0);
      continue;
    }

    // Reset daily counter
    const currentDay = new Date(Number(data[i]?.time)).toDateString();
    if (currentDay !== lastTradeDay) {
      dailyTradeCount = 0;
      lastTradeDay = currentDay;
    }

    // Skip if in pause or cooldown
    if (
      i < cooldownUntil ||
      i < pauseUntil ||
      dailyTradeCount >= config.maxDailyTrades
    ) {
      balanceHistory.push(balance);
      returns.push(0);
      continue;
    }

    // Drawdown protection
    const currentDrawdown = (peakBalance - balance) / peakBalance;
    if (currentDrawdown > config.maxDrawdownLimit) {
      balanceHistory.push(balance);
      returns.push(0);
      continue;
    }

    // compute dynamic risk thresholds (volatility proxy)
    let effSL = config.sl;
    let effTP = config.tp;
    if (config.dynamicRiskEnabled) {
      const vol = recentVolatility(i, config.dynLookback);
      const targetSL = -config.dynSLMult * (vol || Math.abs(config.sl));
      const targetTP = config.dynTPMult * (vol || config.tp);
      // clamp into safe ranges
      const clampedSL = Math.max(
        config.dynSLClamp.min,
        Math.min(config.dynSLClamp.max, targetSL)
      );
      const clampedTP = Math.max(
        config.dynTPClamp.min,
        Math.min(config.dynTPClamp.max, targetTP)
      );
      // combine with base so we don't get overly tight in low-vol and allow wider in high-vol
      effSL = clampedSL; // dynamic stop dominates
      effTP = Math.max(config.tp, clampedTP); // ensure tp not below base
    }

    // Position monitoring with enhanced exit logic
    if (position) {
      const holdingPeriod = i - entryIndex;
      const currentReturn =
        position === "BUY"
          ? (currentPrice - entryPrice) / entryPrice
          : (entryPrice - currentPrice) / entryPrice;

      const hitSL = currentReturn <= effSL;
      const hitTP = currentReturn >= effTP;
      const minHoldMet = holdingPeriod >= config.minHold;
      const maxHoldExceeded = holdingPeriod >= 72; // 3 days max hold

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

        const netReturn = finalReturn - config.fee * 2; // Entry + exit fees

        // Calculate position value with compounding
        const positionValue = balance * config.positionSize;
        const profit = positionValue * netReturn;

        balance += profit;

        // Update peak balance for compounding effect
        if (config.compounding && balance > peakBalance) {
          peakBalance = balance;
        }

        trades.push({
          entryPrice,
          exitPrice,
          position,
          return: netReturn,
          profit,
          isWin: profit > 0,
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
          balanceAfter: balance,
        });

        // Track consecutive losses for circuit breaker
        if (profit < 0) {
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
      }
    }

    // Position opening with enhanced entry logic
    if (!position && isSignalConfirmed(signals, i, signal, config.confirmN)) {
      if (config.longOnly && signal === "SELL") {
        balanceHistory.push(balance);
        returns.push(0);
        continue;
      }

      const executionPrice = config.execNext ? nextPrice : currentPrice;

      if (executionPrice > 0 && balance > 100) {
        // Minimum balance requirement
        const entryFee = balance * config.positionSize * config.fee;
        balance -= entryFee;

        position = signal;
        entryPrice = executionPrice;
        entryIndex = i;
        dailyTradeCount++;
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

    // Update peak and drawdown
    if (!config.compounding) {
      peakBalance = Math.max(peakBalance, balance);
    }
    const drawdown = (peakBalance - balance) / peakBalance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Close final position
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

      balance += profit;

      trades.push({
        entryPrice,
        exitPrice: finalPrice,
        position,
        return: netReturn,
        profit,
        isWin: profit > 0,
        holdingPeriod: data.length - 1 - entryIndex,
        reason: "Final",
        balanceAfter: balance,
      });
    }
  }

  // Enhanced metrics calculation
  const totalReturn = (balance - config.initialBalance) / config.initialBalance;
  const roi = totalReturn * 100;

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
  const annualizedSharpe = sharpeRatio * Math.sqrt(365 * 24);

  // Additional academic metrics
  const annualizedReturn =
    Math.pow(1 + totalReturn, (365 * 24) / data.length) - 1;
  const avgHoldingPeriod =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
      : 0;

  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(2),
    maxDrawdown: +(maxDrawdown * 100).toFixed(2),
    trades: trades.length,
    sharpeRatio: +annualizedSharpe.toFixed(3),
    profitFactor: calculateProfitFactor(trades),
    maxConsecutiveLosses: calculateMaxConsecutiveLosses(trades),
    annualizedReturn: +(annualizedReturn * 100).toFixed(2),
    avgHoldingPeriod: +avgHoldingPeriod.toFixed(1),
    finalBalance: +balance.toFixed(2),
    totalCandles: data.length,
    tradingDays: Math.ceil(data.length / 24),
    config: {
      positionSize: config.positionSize * 100,
      stopLoss: config.sl * 100,
      takeProfit: config.tp * 100,
      fee: config.fee * 100,
      compounding: config.compounding,
    },
  };
}

/** 🔹 Signal Generation for Single Indicators - FIXED VERSION */
function genSingleSignals(d, map, ind, config = {}) {
  const signals = ["HOLD"];

  // USE SAME CONFIGURATION as passed from compareStrategies
  const rsiOversold = config.rsiOversold || 30;
  const rsiOverbought = config.rsiOverbought || 70;
  const macdThreshold = config.macdThreshold || 0.0003;
  const trendFilter = config.trendFilter !== false;
  const trendPeriod = config.trendPeriod || 20;
  const maxVolatility = config.maxVolatility || 0.15;
  const minVolatility = config.minVolatility || 0.002;
  const strongTrendOnly = config.strongTrendOnly || false;
  const trendStrengthMinimum = config.trendStrengthMinimum || 0.005;

  for (let i = Math.max(trendPeriod + 5, 25); i < d.length; i++) {
    const current = d[i];
    const previous = d[i - 1];
    const previous2 = d[i - 2];
    const price = map.get(current.time.toString());

    if (!price) {
      signals.push("HOLD");
      continue;
    }

    const safe = (v, def = 0) => (v == null || isNaN(v) ? def : v);

    // RELAXED VOLATILITY FILTER - Allow more trading
    if (config.volatilityFilter) {
      const priceChange =
        (price - map.get(previous.time.toString())) /
          map.get(previous.time.toString()) || 0;
      const volatility = Math.abs(priceChange);

      // Only skip extreme cases
      if (volatility > maxVolatility) {
        signals.push("HOLD");
        continue;
      }
    }

    // OPTIONAL TREND FILTER - Only if enabled
    let trendDirection = "NEUTRAL";
    let trendStrength = 0;

    if (trendFilter && i >= trendPeriod) {
      const currentSma = safe(current.sma20) || safe(current.sma50);
      const currentEma = safe(current.ema20) || safe(current.ema50);
      const pastSma = d[i - 5]
        ? safe(d[i - 5].sma20) || safe(d[i - 5].sma50)
        : currentSma;
      const pastEma = d[i - 5]
        ? safe(d[i - 5].ema20) || safe(d[i - 5].ema50)
        : currentEma;

      if (currentSma && pastSma && currentEma && pastEma) {
        const smaTrend = (currentSma - pastSma) / pastSma;
        const emaTrend = (currentEma - pastEma) / pastEma;
        trendStrength = (smaTrend + emaTrend) / 2;

        if (trendStrength > 0.005) {
          trendDirection = "UP";
        } else if (trendStrength < -0.005) {
          trendDirection = "DOWN";
        }

        // Only filter if strongTrendOnly is enabled
        if (strongTrendOnly && Math.abs(trendStrength) < trendStrengthMinimum) {
          signals.push("HOLD");
          continue;
        }
      }
    }

    let signal = "HOLD";

    switch (ind) {
      case "RSI":
        const rsi = safe(current.rsi, 50);
        const prevRsi = safe(previous.rsi, 50);
        const rsiMomentum = rsi - prevRsi;

        // SIMPLIFIED RSI strategy - more signals
        if (
          rsi < rsiOversold &&
          rsiMomentum > 0 &&
          (!trendFilter || trendDirection !== "DOWN")
        ) {
          signal = "BUY";
        } else if (
          rsi > rsiOverbought &&
          rsiMomentum < 0 &&
          (!trendFilter || trendDirection !== "UP")
        ) {
          signal = "SELL";
        }
        break;

      case "MACD":
        const macd = safe(current.macd);
        const macdSignal = safe(current.macdSignal);
        const macdHist = safe(current.macdHist);
        const prevMacdHist = safe(previous.macdHist);

        // SIMPLIFIED MACD - focus on main crossovers
        if (
          macd > macdSignal &&
          macdHist > 0 &&
          macdHist > prevMacdHist &&
          Math.abs(macdHist) > macdThreshold &&
          (!trendFilter || trendDirection !== "DOWN")
        ) {
          signal = "BUY";
        } else if (
          macd < macdSignal &&
          macdHist < 0 &&
          macdHist < prevMacdHist &&
          Math.abs(macdHist) > macdThreshold &&
          (!trendFilter || trendDirection !== "UP")
        ) {
          signal = "SELL";
        }
        break;

      case "SMA":
        const sma20 = safe(current.sma20);
        const sma50 = safe(current.sma50);
        const prevSma20 = safe(previous.sma20);
        const prevSma50 = safe(previous.sma50);

        // SIMPLIFIED Golden/Death Cross
        if (sma20 && sma50 && prevSma20 && prevSma50) {
          const goldenCross = sma20 > sma50 && prevSma20 <= prevSma50;
          const deathCross = sma20 < sma50 && prevSma20 >= prevSma50;
          const smaGap = Math.abs(sma20 - sma50) / sma50;

          if (
            goldenCross &&
            price > sma20 &&
            smaGap > 0.005 &&
            (!trendFilter || trendDirection !== "DOWN")
          ) {
            signal = "BUY";
          } else if (
            deathCross &&
            price < sma20 &&
            smaGap > 0.005 &&
            (!trendFilter || trendDirection !== "UP")
          ) {
            signal = "SELL";
          }
        }
        break;

      case "EMA":
        const ema20 = safe(current.ema20);
        const ema50 = safe(current.ema50);
        const prevEma20 = safe(previous.ema20);
        const prevEma50 = safe(previous.ema50);

        // SIMPLIFIED EMA crossover
        if (ema20 && ema50 && prevEma20 && prevEma50) {
          const emaCrossUp = ema20 > ema50 && prevEma20 <= prevEma50;
          const emaCrossDown = ema20 < ema50 && prevEma20 >= prevEma50;
          const emaGap = Math.abs(ema20 - ema50) / ema50;

          if (
            emaCrossUp &&
            price > ema20 &&
            emaGap > 0.003 &&
            (!trendFilter || trendDirection !== "DOWN")
          ) {
            signal = "BUY";
          } else if (
            emaCrossDown &&
            price < ema20 &&
            emaGap > 0.003 &&
            (!trendFilter || trendDirection !== "UP")
          ) {
            signal = "SELL";
          }
        }
        break;

      case "BollingerBands":
        const bbUpper = safe(current.bbUpper);
        const bbLower = safe(current.bbLower);
        const bbMiddle = safe(current.bbMiddle);
        const prevPrice = map.get(previous.time.toString()) || 0;

        if (bbUpper > 0 && bbLower > 0 && bbMiddle > 0) {
          const bandWidth = (bbUpper - bbLower) / bbMiddle;
          const bbPosition = (price - bbLower) / (bbUpper - bbLower);
          const priceDirection = price > prevPrice;

          // SIMPLIFIED Bollinger Bands
          if (
            bandWidth > 0.03 &&
            bbPosition <= 0.2 &&
            priceDirection &&
            (!trendFilter || trendDirection !== "DOWN")
          ) {
            signal = "BUY";
          } else if (
            bandWidth > 0.03 &&
            bbPosition >= 0.8 &&
            !priceDirection &&
            (!trendFilter || trendDirection !== "UP")
          ) {
            signal = "SELL";
          }
        }
        break;

      case "ParabolicSAR":
        const psar = safe(current.psar);
        const prevPsar = safe(previous.psar);
        const prevPrice2 = map.get(previous.time.toString()) || 0;

        if (psar > 0 && prevPsar > 0) {
          // SIMPLIFIED PSAR
          const psarFlip = price > psar && prevPrice2 <= prevPsar;
          const psarFlipDown = price < psar && prevPrice2 >= prevPsar;
          const psarGap = Math.abs(price - psar) / psar;

          if (
            psarFlip &&
            psarGap > 0.01 &&
            (!trendFilter || trendDirection !== "DOWN")
          ) {
            signal = "BUY";
          } else if (
            psarFlipDown &&
            psarGap > 0.01 &&
            (!trendFilter || trendDirection !== "UP")
          ) {
            signal = "SELL";
          }
        }
        break;

      case "StochasticRSI":
        const stochRsi = safe(current.stochRsi, 50);
        const prevStochRsi = safe(previous.stochRsi, 50);
        const stochRsiK = safe(current.stochRsiK, 50);
        const stochRsiD = safe(current.stochRsiD, 50);

        // SIMPLIFIED Stochastic RSI
        if (
          stochRsi < 20 &&
          prevStochRsi >= 25 &&
          stochRsiK > stochRsiD &&
          (!trendFilter || trendDirection !== "DOWN")
        ) {
          signal = "BUY";
        } else if (
          stochRsi > 80 &&
          prevStochRsi <= 75 &&
          stochRsiK < stochRsiD &&
          (!trendFilter || trendDirection !== "UP")
        ) {
          signal = "SELL";
        }
        break;

      default:
        signal = "HOLD";
    }

    signals.push(signal);
  }

  // Pad the beginning with HOLD signals
  while (signals.length < d.length) {
    signals.unshift("HOLD");
  }

  return signals;
}

/** 🔹 Multi-Indicator Signal Generation - OPTIMIZED FOR HIGH ROI */
function genMultiSignals(d, map, config = {}) {
  const signals = ["HOLD"];

  // OPTIMIZED configuration defaults - same as single signals for consistency
  const trendFilter = config.trendFilter !== false;
  const trendPeriod = config.trendPeriod || 50;
  const maxVolatility = config.maxVolatility || 0.06;
  const minVolatility = config.minVolatility || 0.008;
  const rsiOversold = config.rsiOversold || 20;
  const rsiOverbought = config.rsiOverbought || 80;
  const macdThreshold = config.macdThreshold || 0.0008;
  const strongTrendOnly = config.strongTrendOnly || false;
  const trendStrengthMinimum = config.trendStrengthMinimum || 0.015;

  for (let i = Math.max(trendPeriod + 5, 55); i < d.length; i++) {
    const current = d[i];
    const previous = d[i - 1];
    const previous2 = d[i - 2];
    const price = map.get(current.time.toString());

    if (!price) {
      signals.push("HOLD");
      continue;
    }

    const safe = (v, def = 0) => (v == null || isNaN(v) ? def : v);

    // ENHANCED VOLATILITY FILTER - Same as single signals
    const priceChange =
      (price - map.get(previous.time.toString())) /
        map.get(previous.time.toString()) || 0;
    const volatility = Math.abs(priceChange);

    // Skip if volatility is too high or too low
    if (
      config.volatilityFilter &&
      (volatility > maxVolatility || volatility < minVolatility)
    ) {
      signals.push("HOLD");
      continue;
    }

    // ENHANCED TREND FILTER - Critical for eliminating losses
    let trendDirection = "NEUTRAL";
    let trendStrength = 0;
    let emaBull = false;
    let emaBear = false;

    if (i >= Math.max(50, trendPeriod)) {
      // Calculate trend using both SMA50 and EMA50 for better accuracy
      const currentSma50 = safe(current.sma50);
      const currentEma50 = safe(current.ema50);
      const pastSma50 = d[i - 10] ? safe(d[i - 10].sma50) : currentSma50;
      const pastEma50 = d[i - 10] ? safe(d[i - 10].ema50) : currentEma50;

      const smaTrend =
        currentSma50 && pastSma50 ? (currentSma50 - pastSma50) / pastSma50 : 0;
      const emaTrend =
        currentEma50 && pastEma50 ? (currentEma50 - pastEma50) / pastEma50 : 0;
      trendStrength = (smaTrend + emaTrend) / 2;

      // EMA20/EMA50 validation
      const ema20 = safe(current.ema20);
      const ema50 = safe(current.ema50);
      const prevEma20 = safe(previous.ema20);
      const prevEma50 = safe(previous.ema50);
      emaBull = ema20 && ema50 ? ema20 > ema50 : false;
      emaBear = ema20 && ema50 ? ema20 < ema50 : false;

      if (trendFilter) {
        if (trendStrength > 0.01 && emaBull) {
          trendDirection = "UP";
        } else if (trendStrength < -0.01 && emaBear) {
          trendDirection = "DOWN";
        } else {
          trendDirection = "NEUTRAL";
        }

        if (strongTrendOnly && Math.abs(trendStrength) < trendStrengthMinimum) {
          signals.push("HOLD");
          continue;
        }
      }
    }

    let buyScore = 0;
    let sellScore = 0;
    let confidence = 0;

    // Enhanced RSI Analysis with acceleration
    const rsi = safe(current.rsi, 50);
    const prevRsi = safe(previous.rsi, 50);
    const prevRsi2 = safe(previous2.rsi, 50);
    const rsiMomentum = rsi - prevRsi;
    const rsiAcceleration = rsi - prevRsi - (prevRsi - prevRsi2);

    let rsiBuy = false;
    let rsiSell = false;
    if (rsi < rsiOversold && rsiMomentum > 0.5 && rsiAcceleration > 0) {
      rsiBuy = true;
      buyScore += 0.35;
      confidence += 0.3;
    } else if (
      rsi > rsiOverbought &&
      rsiMomentum < -0.5 &&
      rsiAcceleration < 0
    ) {
      rsiSell = true;
      sellScore += 0.35;
      confidence += 0.3;
    }

    // Enhanced MACD Analysis with histogram acceleration
    const macd = safe(current.macd);
    const macdSignal = safe(current.macdSignal);
    const macdHist = safe(current.macdHist);
    const prevMacdHist = safe(previous.macdHist);
    const prevMacdHist2 = safe(previous2.macdHist);

    const macdMomentum = macdHist - prevMacdHist;
    const histAcceleration = macdMomentum - (prevMacdHist - prevMacdHist2);
    const strongMacdSignal = Math.abs(macdHist) > macdThreshold;

    let macdBuy = false;
    let macdSell = false;
    if (
      macd > macdSignal &&
      macdHist > 0 &&
      macdMomentum > 0 &&
      histAcceleration > 0 &&
      strongMacdSignal
    ) {
      macdBuy = true;
      buyScore += 0.4;
      confidence += 0.35;
    } else if (
      macd < macdSignal &&
      macdHist < 0 &&
      macdMomentum < 0 &&
      histAcceleration < 0 &&
      strongMacdSignal
    ) {
      macdSell = true;
      sellScore += 0.4;
      confidence += 0.35;
    }

    // Synergy boost when RSI and MACD align in same direction
    if (rsiBuy && macdBuy) {
      buyScore += 0.35; // extra weight for confluence
      confidence += 0.25;
    }
    if (rsiSell && macdSell) {
      sellScore += 0.35;
      confidence += 0.25;
    }

    // Enhanced SMA/EMA Analysis with momentum
    const sma20 = safe(current.sma20);
    const sma50 = safe(current.sma50);
    const ema20c = safe(current.ema20);
    const ema50c = safe(current.ema50);

    if (sma20 && sma50 && ema20c && ema50c) {
      const smaGap = Math.abs(sma20 - sma50) / sma50;
      const emaGap = Math.abs(ema20c - ema50c) / ema50c;
      const pricePositionSma = (price - sma20) / sma20;
      const pricePositionEma = (price - ema20c) / ema20c;
      const priceMomentum =
        (price - map.get(previous.time.toString())) /
        map.get(previous.time.toString());

      // Golden Cross confirmation with both SMA and EMA
      if (
        sma20 > sma50 &&
        ema20c > ema50c &&
        price > sma20 &&
        smaGap > 0.012 &&
        emaGap > 0.01 &&
        pricePositionSma > 0.008 &&
        pricePositionEma > 0.005 &&
        priceMomentum > 0.002
      ) {
        buyScore += 0.3;
        confidence += 0.25;
      } else if (
        sma20 < sma50 &&
        ema20c < ema50c &&
        price < sma20 &&
        smaGap > 0.012 &&
        emaGap > 0.01 &&
        pricePositionSma < -0.008 &&
        pricePositionEma < -0.005 &&
        priceMomentum < -0.002
      ) {
        sellScore += 0.3;
        confidence += 0.25;
      }
    }

    // Enhanced Bollinger Bands Analysis with momentum
    const bbUpper = safe(current.bbUpper);
    const bbLower = safe(current.bbLower);
    const bbMiddle = safe(current.bbMiddle);

    if (bbUpper > 0 && bbLower > 0 && bbMiddle > 0) {
      const bandWidth = (bbUpper - bbLower) / bbMiddle;
      const bbPosition = (price - bbLower) / (bbUpper - bbLower);
      const priceDirection = price > map.get(previous.time.toString());
      const bbMomentum =
        (bbMiddle - (d[i - 5] ? safe(d[i - 5].bbMiddle) : bbMiddle)) / bbMiddle;

      // Enhanced BB strategy with momentum confirmation
      if (
        bandWidth > 0.05 &&
        bbPosition <= 0.12 &&
        priceDirection &&
        Math.abs(bbMomentum) > 0.005
      ) {
        buyScore += 0.2;
        confidence += 0.2;
      } else if (
        bandWidth > 0.05 &&
        bbPosition >= 0.88 &&
        !priceDirection &&
        Math.abs(bbMomentum) > 0.005
      ) {
        sellScore += 0.2;
        confidence += 0.2;
      }
    }

    // ParabolicSAR Analysis - Enhanced
    const psar = safe(current.psar);
    const prevPsar = safe(previous.psar);
    const prevPrice2 = map.get(previous.time.toString()) || 0;
    const prevPrice3 = d[i - 2]
      ? map.get(d[i - 2].time.toString())
      : prevPrice2;

    if (psar > 0 && prevPsar > 0) {
      // Enhanced PSAR with price momentum confirmation
      const psarFlip = price > psar && prevPrice2 <= prevPsar;
      const psarFlipDown = price < psar && prevPrice2 >= prevPsar;
      const psarGap = Math.abs(price - psar) / psar;
      const priceTrend = (price - prevPrice3) / prevPrice3;

      if (psarFlip && psarGap > 0.015 && priceTrend > 0.005) {
        buyScore += 0.15;
        confidence += 0.15;
      } else if (psarFlipDown && psarGap > 0.015 && priceTrend < -0.005) {
        sellScore += 0.15;
        confidence += 0.15;
      }
    }

    // ENHANCED TREND-ALIGNED ENTRIES ONLY
    if (trendFilter) {
      if (trendDirection === "DOWN" && buyScore >= sellScore) {
        // block buys in downtrend
        buyScore *= 0;
      }
      if (trendDirection === "UP" && sellScore >= buyScore) {
        // block sells in uptrend
        sellScore *= 0;
      }
    }

    // Enhanced decision logic with stricter thresholds (but trend-validated by EMA20/EMA50)
    const netScore = buyScore - sellScore;
    const minConfidence = 0.6; // Higher threshold for better quality
    const strongSignalThreshold = 0.8; // Higher threshold for stronger signals

    if (confidence >= minConfidence) {
      if (
        netScore >= strongSignalThreshold &&
        trendDirection === "UP" &&
        emaBull
      ) {
        signals.push("BUY");
      } else if (
        netScore <= -strongSignalThreshold &&
        trendDirection === "DOWN" &&
        emaBear
      ) {
        signals.push("SELL");
      } else {
        signals.push("HOLD");
      }
    } else {
      signals.push("HOLD");
    }
  }

  // Pad the beginning with HOLD signals
  while (signals.length < d.length) {
    signals.unshift("HOLD");
  }

  return signals;
}

/**
 * 🎯 Compare Multi vs Single Indicator (Academic Research Based)
 * FIXED VERSION - Optimized for crypto trading with realistic parameters
 */
export async function compareStrategies(symbol, start, end) {
  const s = toBigInt(start),
    e = toBigInt(end);

  const data = await prisma.indicator.findMany({
    where: { symbol, time: { gte: s, lte: e } },
    orderBy: { time: "asc" },
  });

  const candles = await prisma.candle.findMany({
    where: { symbol, time: { gte: s, lte: e } },
    orderBy: { time: "asc" },
  });

  if (!data.length || !candles.length)
    return { success: false, message: "No data found" };

  console.log(
    `📊 Data Analysis: ${candles.length} candles, ${data.length} indicators for ${symbol}`
  );

  const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
  const indicators = [
    "RSI",
    "MACD",
    "SMA",
    "EMA",
    "BollingerBands",
    "ParabolicSAR",
    "StochasticRSI",
  ];

  // FIXED OPTIMIZED CONFIGURATION - Balanced for crypto trading
  const optimizedConfig = {
    // Basic trading parameters
    fee: 0.002, // 0.2% realistic fee
    sl: -0.025, // -2.5% stop loss
    tp: 0.05, // +5% take profit
    positionSize: 0.12, // 12% position size
    minHold: 2, // 2 hours minimum hold
    coolDown: 1, // 1 hour cooldown
    confirmN: 1, // 1 signal confirmation
    execNext: true,
    longOnly: true,
    initialBalance: 1000,
    riskFreeRate: 0.02,

    // RELAXED FILTERS - Allow more trading opportunities
    trendFilter: false, // Disable trend filter initially
    trendPeriod: 20, // Shorter trend period
    strongTrendOnly: false, // Allow weaker trends
    trendStrengthMinimum: 0.005, // Lower threshold (0.5%)

    // EXPANDED VOLATILITY RANGE - More suitable for crypto
    volatilityFilter: true,
    maxVolatility: 0.15, // 15% max volatility (crypto can be very volatile)
    minVolatility: 0.002, // 0.2% min volatility (allow calmer periods)

    // MODERATE RISK MANAGEMENT
    maxDailyTrades: 6, // More opportunities
    maxConsecutiveLosses: 3, // Allow more attempts
    pauseAfterLosses: 4, // Shorter pause
    maxDrawdownLimit: 0.2, // 20% max drawdown

    // RELAXED SIGNAL QUALITY - Generate more signals
    rsiOversold: 30, // Less extreme RSI levels
    rsiOverbought: 70,
    macdThreshold: 0.0003, // Lower threshold
    volumeFilter: false,

    // Additional optimizations
    adaptivePositioning: false, // Keep it simple
    trailingStopEnabled: false, // Disable for now
    partialTakeProfitEnabled: false,
    compounding: true, // Enable compounding
  };

  // NEW: High-ROI optimized configuration for 1H timeframe
  const optimizedConfigHighROI = {
    fee: 0.002,
    sl: -0.012,
    tp: 0.025,
    positionSize: 0.1,
    minHold: 2,
    coolDown: 1,
    confirmN: 2,
    execNext: true,
    longOnly: true,
    initialBalance: 1000,
    riskFreeRate: 0.02,

    // Filters per requirement
    trendFilter: true,
    trendPeriod: 50,
    strongTrendOnly: true,
    trendStrengthMinimum: 0.01,

    volatilityFilter: true,
    maxVolatility: 0.08,
    minVolatility: 0.002,

    // Risk management
    maxDailyTrades: 3,
    maxConsecutiveLosses: 3,
    pauseAfterLosses: 4,
    maxDrawdownLimit: 0.25,

    // Signal thresholds
    rsiOversold: 28,
    rsiOverbought: 72,
    macdThreshold: 0.00025,

    // Dynamic risk enabled
    dynamicRiskEnabled: true,
    dynLookback: 14,
    dynSLMult: 1.2,
    dynTPMult: 2.5,
    dynSLClamp: { min: -0.03, max: -0.006 },
    dynTPClamp: { min: 0.015, max: 0.05 },

    // Other
    compounding: true,
  };

  // === SINGLE STRATEGIES ===
  console.log("🔍 Testing single indicators with optimized settings...");
  const single = Object.fromEntries(
    indicators.map((ind) => {
      console.log(`  Testing ${ind}...`);
      const sig = genSingleSignals(data, map, ind, optimizedConfig);
      const res = calculateBacktest(sig, map, data, optimizedConfig);
      console.log(
        `    ${ind}: ROI=${res.roi}%, WinRate=${res.winRate}%, Trades=${res.trades}`
      );
      return [ind, res];
    })
  );

  // === MULTI STRATEGY ===
  console.log("🔍 Testing multi-indicator strategy...");
  const multiSig = genMultiSignals(data, map, optimizedConfig);
  const multi = calculateBacktest(multiSig, map, data, optimizedConfig);
  console.log(
    `    Multi: ROI=${multi.roi}%, WinRate=${multi.winRate}%, Trades=${multi.trades}`
  );

  // === RUN WITH HIGH-ROI CONFIG ===
  console.log("🔍 Testing single indicators with optimizedConfigHighROI...");
  const singleHighROI = Object.fromEntries(
    indicators.map((ind) => {
      const sig = genSingleSignals(data, map, ind, optimizedConfigHighROI);
      const res = calculateBacktest(sig, map, data, optimizedConfigHighROI);
      return [ind, res];
    })
  );
  console.log("🔍 Testing multi-indicator strategy (HighROI)...");
  const multiSigHigh = genMultiSignals(data, map, optimizedConfigHighROI);
  const multiHigh = calculateBacktest(
    multiSigHigh,
    map,
    data,
    optimizedConfigHighROI
  );
  console.log(
    `📈 ${symbol} | ROI=${multiHigh.roi}% | WinRate=${multiHigh.winRate}% | Drawdown=${multiHigh.maxDrawdown}%`
  );

  // === BEST SINGLE ===
  const best = Object.entries(single).reduce(
    (a, [k, v]) => (v.roi > a.roi ? { indicator: k, ...v } : a),
    { indicator: "none", roi: -Infinity }
  );

  const bestHigh = Object.entries(singleHighROI).reduce(
    (a, [k, v]) => (v.roi > a.roi ? { indicator: k, ...v } : a),
    { indicator: "none", roi: -Infinity }
  );

  // Calculate time period for context
  const startDate = new Date(Number(candles[0].time));
  const endDate = new Date(Number(candles[candles.length - 1].time));
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Calculate summary statistics
  const allROIs = Object.values(single)
    .map((s) => s.roi)
    .concat(multi.roi);
  const positiveROIs = allROIs.filter((roi) => roi > 0);
  const avgROI = allROIs.reduce((sum, roi) => sum + roi, 0) / allROIs.length;

  console.log(
    `📈 Analysis Period: ${daysDiff} days (${candles.length} hourly candles)`
  );
  console.log(`🎯 Best Single: ${best.indicator} with ROI: ${best.roi}%`);
  console.log(`🔀 Multi Strategy ROI: ${multi.roi}%`);
  console.log(`📊 Average ROI: ${avgROI.toFixed(2)}%`);
  console.log(
    `✅ Profitable Strategies: ${positiveROIs.length}/${allROIs.length}`
  );

  return {
    success: true,
    symbol,
    timeframe: "1H",

    // Fix: Return dataInfo instead of metadata to match controller expectations
    dataInfo: {
      totalCandles: candles.length,
      totalIndicators: data.length,
      periodDays: daysDiff,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tradingConfig: {
        positionSize: optimizedConfig.positionSize * 100,
        stopLoss: optimizedConfig.sl,
        takeProfit: optimizedConfig.tp,
        minHoldHours: optimizedConfig.minHold,
        cooldownHours: optimizedConfig.coolDown,
        maxDailyTrades: optimizedConfig.maxDailyTrades,
        confirmationCandles: optimizedConfig.confirmN,
      },
    },
    analysis: {
      totalStrategiesTested: indicators.length + 1,
      profitableStrategies: positiveROIs.length,
      averageROI: parseFloat(avgROI.toFixed(2)),
      bestROI: Math.max(...allROIs),
      worstROI: Math.min(...allROIs),
      recommendation: getRecommendation(
        single,
        multi,
        best.indicator,
        positiveROIs.length
      ),
    },
    comparison: {
      single,
      multi,
      bestStrategy: multi.roi > best.roi ? "multi" : "single",
      bestSingleIndicator: best.indicator,
    },
    // NEW: High-ROI config results
    comparisonHighROI: {
      configName: "optimizedConfigHighROI",
      config: {
        positionSize: optimizedConfigHighROI.positionSize * 100,
        stopLoss: optimizedConfigHighROI.sl,
        takeProfit: optimizedConfigHighROI.tp,
        minHoldHours: optimizedConfigHighROI.minHold,
        cooldownHours: optimizedConfigHighROI.coolDown,
        maxDailyTrades: optimizedConfigHighROI.maxDailyTrades,
        confirmationCandles: optimizedConfigHighROI.confirmN,
        trendFilter: optimizedConfigHighROI.trendFilter,
        volatilityFilter: optimizedConfigHighROI.volatilityFilter,
      },
      single: singleHighROI,
      multi: multiHigh,
      bestStrategy: multiHigh.roi > bestHigh.roi ? "multi" : "single",
      bestSingleIndicator: bestHigh.indicator,
    },
  };
}

/**
 * 🎯 Generate trading recommendation based on results - ENHANCED FOR HIGH ROI
 */
function getRecommendation(
  singleResults,
  multiResult,
  bestIndicator,
  profitableCount
) {
  const bestSingleROI = singleResults[bestIndicator]?.roi || 0;
  const multiROI = multiResult.roi;

  if (profitableCount === 0) {
    return "❌ Semua strategi menghasilkan ROI negatif. Disarankan: 1) Coba timeframe 4H/1D, 2) Tunggu kondisi pasar bullish, 3) Pertimbangkan strategi buy-and-hold.";
  } else if (bestSingleROI >= 100 || multiROI >= 100) {
    return `🚀 ROI EXCELLENT! ${bestSingleROI > multiROI ? bestIndicator + " strategy" : "Multi-indicator strategy"} mencapai ROI ${Math.max(bestSingleROI, multiROI).toFixed(2)}%. Ini adalah hasil yang sangat baik untuk crypto trading!`;
  } else if (bestSingleROI >= 50 || multiROI >= 50) {
    return `✅ ROI VERY GOOD! ${bestSingleROI > multiROI ? bestIndicator + " strategy" : "Multi-indicator strategy"} mencapai ROI ${Math.max(bestSingleROI, multiROI).toFixed(2)}%. Hasil ini menunjukkan strategi yang solid.`;
  } else if (bestSingleROI >= 20 || multiROI >= 20) {
    return `✅ ROI GOOD! ${bestSingleROI > multiROI ? bestIndicator + " strategy" : "Multi-indicator strategy"} mencapai ROI ${Math.max(bestSingleROI, multiROI).toFixed(2)}%. Hasil yang baik untuk periode analisis ini.`;
  } else if (bestSingleROI >= 10 || multiROI >= 10) {
    return `⚠️ ROI MODERATE. ${bestSingleROI > multiROI ? bestIndicator + " strategy" : "Multi-indicator strategy"} mencapai ROI ${Math.max(bestSingleROI, multiROI).toFixed(2)}%. Masih profitable tapi bisa dioptimalkan lebih lanjut.`;
  } else if (bestSingleROI > 0 || multiROI > 0) {
    return `⚠️ ROI LOW. ${bestSingleROI > multiROI ? bestIndicator + " strategy" : "Multi-indicator strategy"} mencapai ROI ${Math.max(bestSingleROI, multiROI).toFixed(2)}%. Pertimbangkan penyesuaian parameter atau timeframe berbeda.`;
  } else {
    return "❌ Semua strategi menghasilkan ROI negatif. Disarankan untuk menghindari trading pada kondisi pasar saat ini atau coba timeframe yang berbeda.";
  }
}
