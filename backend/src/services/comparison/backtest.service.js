/* ===========================================================
   🎯 1H Timeframe Strategy - No Trend Filter (Optimized)
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

/** 🔹 Optimized and Fixed 1H Backtest Implementation */
export function calculateBacktest(signals, map, data, options = {}) {
  if (!signals?.length || signals.length < 10 || !data?.length)
    return { roi: 0, winRate: 0, maxDrawdown: 0, trades: 0 };

  // 1H Timeframe Realistic Configuration
  const config = {
    fee: options.fee || 0.001,           // 0.1% transaction fee
    sl: options.sl || -0.008,            // -0.8% Stop Loss (realistic for 1H)
    tp: options.tp || 0.015,             // +1.5% Take Profit (achievable for 1H)
    positionSize: options.positionSize || 0.2,  // 20% position size
    minHold: options.minHold || 2,       // 2 candles minimum hold (2 hours)
    coolDown: options.coolDown || 4,     // 4 candles cooldown (4 hours)
    confirmN: options.confirmN || 1,     // Single signal (remove strict confirmation)
    execNext: options.execNext !== false, // Execute on next candle
    longOnly: options.longOnly !== false, // Long-only mode
    initialBalance: 1000
  };

  let balance = config.initialBalance;
  let position = null;
  let entryPrice = 0;
  let entryIndex = 0;
  let cooldownUntil = 0;
  
  const trades = [];
  const balanceHistory = [balance];
  let peakBalance = balance;
  let maxDrawdown = 0;

  // Process signals with realistic execution
  for (let i = 1; i < signals.length - 1; i++) {
    const signal = signals[i];
    const currentPrice = priceAt(i, map, data);
    const nextPrice = priceAt(i + 1, map, data);
    
    if (!currentPrice || !nextPrice || currentPrice <= 0 || nextPrice <= 0) {
      balanceHistory.push(balance);
      continue;
    }

    // Skip if in cooldown period
    if (i < cooldownUntil) {
      balanceHistory.push(balance);
      continue;
    }

    // Monitor existing position for SL/TP
    if (position) {
      const holdingPeriod = i - entryIndex;
      const currentReturn = position === "BUY" 
        ? (currentPrice - entryPrice) / entryPrice
        : (entryPrice - currentPrice) / entryPrice;

      // Check exit conditions
      const hitSL = currentReturn <= config.sl;
      const hitTP = currentReturn >= config.tp;
      const minHoldMet = holdingPeriod >= config.minHold;
      
      // Simple opposite signal check (no confirmation needed)
      const oppositeSignal = minHoldMet && (
        (position === "BUY" && signal === "SELL") ||
        (!config.longOnly && position === "SELL" && signal === "BUY")
      );

      if (hitSL || hitTP || oppositeSignal) {
        // Close position - use current price for immediate execution
        const exitPrice = currentPrice;
        const finalReturn = position === "BUY" 
          ? (exitPrice - entryPrice) / entryPrice
          : (entryPrice - exitPrice) / entryPrice;

        // Apply realistic transaction costs
        const netReturn = finalReturn - config.fee; // Only exit fee (entry already deducted)
        
        // Calculate position value and profit
        const positionValue = balance * config.positionSize;
        const profit = positionValue * netReturn;
        
        // Limit individual trade impact
        const maxLoss = -positionValue * 0.05; // Max 5% loss per trade
        const maxGain = positionValue * 0.03;  // Max 3% gain per trade
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
          reason: hitSL ? 'SL' : hitTP ? 'TP' : 'Signal'
        });

        // Reset position and set cooldown
        position = null;
        cooldownUntil = i + config.coolDown;
      }
    }

    // Open new position with simple signal check
    if (!position && (signal === "BUY" || (!config.longOnly && signal === "SELL"))) {
      // Skip SHORT signals in long-only mode
      if (config.longOnly && signal === "SELL") {
        balanceHistory.push(balance);
        continue;
      }

      const executionPrice = config.execNext ? nextPrice : currentPrice;
      
      // Deduct entry fee from balance
      const entryFee = balance * config.positionSize * config.fee;
      balance -= entryFee;
      
      // Set position
      position = signal;
      entryPrice = executionPrice;
      entryIndex = i;
    }

    // Update balance history and drawdown
    balanceHistory.push(balance);
    peakBalance = Math.max(peakBalance, balance);
    const drawdown = (peakBalance - balance) / peakBalance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Close final position if still open
  if (position && data.length > 1) {
    const finalPrice = priceAt(data.length - 1, map, data);
    if (finalPrice > 0) {
      const finalReturn = position === "BUY" 
        ? (finalPrice - entryPrice) / entryPrice
        : (entryPrice - finalPrice) / entryPrice;

      const netReturn = finalReturn - config.fee;
      const positionValue = balance * config.positionSize;
      const profit = positionValue * netReturn;
      
      // Apply same limits
      const maxLoss = -positionValue * 0.05;
      const maxGain = positionValue * 0.03;
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
        reason: 'Final'
      });
    }
  }

  // Calculate final metrics
  const roi = ((balance - config.initialBalance) / config.initialBalance) * 100;
  const winningTrades = trades.filter(t => t.isWin).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  return {
    roi: Math.max(-50, Math.min(100, +roi.toFixed(2))), // More realistic cap: -50% to +100%
    winRate: +winRate.toFixed(2),
    maxDrawdown: +(maxDrawdown * 100).toFixed(2),
    trades: trades.length
  };
}

/** 🔹 Sinyal indikator tunggal (diperbaiki) */
export function genSingleSignals(d, map, ind) {
  const signals = ["HOLD"];

  for (let i = 1; i < d.length; i++) {
    const current = d[i];
    const previous = d[i - 1];
    const price = map.get(current.time.toString());

    if (!price) {
      signals.push("HOLD");
      continue;
    }

    const safe = (v, def = 0) => (v == null || isNaN(v) ? def : v);

    switch (ind) {
      case "RSI":
        const rsi = safe(current.rsi, 50);
        signals.push(rsi < 30 ? "BUY" : rsi > 70 ? "SELL" : "HOLD");
        break;

      case "MACD":
        const macd = safe(current.macd);
        const macdSignal = safe(current.macdSignal);
        const prevMacd = safe(previous.macd);
        const prevMacdSignal = safe(previous.macdSignal);

        if (macd > macdSignal && prevMacd <= prevMacdSignal) {
          signals.push("BUY");
        } else if (macd < macdSignal && prevMacd >= prevMacdSignal) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      case "SMA":
        const sma20 = safe(current.sma20);
        const sma50 = safe(current.sma50);
        const prevSma20 = safe(previous.sma20);
        const prevSma50 = safe(previous.sma50);

        if (sma20 > sma50 && prevSma20 <= prevSma50) {
          signals.push("BUY");
        } else if (sma20 < sma50 && prevSma20 >= prevSma50) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      case "EMA":
        const ema20 = safe(current.ema20);
        const ema50 = safe(current.ema50);
        const prevEma20 = safe(previous.ema20);
        const prevEma50 = safe(previous.ema50);

        if (ema20 > ema50 && prevEma20 <= prevEma50) {
          signals.push("BUY");
        } else if (ema20 < ema50 && prevEma20 >= prevEma50) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      case "BollingerBands":
        const bbUpper = safe(current.bbUpper);
        const bbLower = safe(current.bbLower);

        if (bbLower > 0 && price <= bbLower) {
          signals.push("BUY");
        } else if (bbUpper > 0 && price >= bbUpper) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      case "ParabolicSAR":
        const psar = safe(current.psar);
        const prevPsar = safe(previous.psar);

        if (
          price > psar &&
          (previous ? map.get(previous.time.toString()) <= prevPsar : false)
        ) {
          signals.push("BUY");
        } else if (
          price < psar &&
          (previous ? map.get(previous.time.toString()) >= prevPsar : false)
        ) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      case "StochasticRSI":
        const stochK = safe(current.stochRsiK, 50);
        const stochD = safe(current.stochRsiD, 50);
        const prevStochK = safe(previous.stochRsiK, 50);
        const prevStochD = safe(previous.stochRsiD, 50);

        if (
          stochK < 20 &&
          stochD < 20 &&
          (prevStochK >= 20 || prevStochD >= 20)
        ) {
          signals.push("BUY");
        } else if (
          stochK > 80 &&
          stochD > 80 &&
          (prevStochK <= 80 || prevStochD <= 80)
        ) {
          signals.push("SELL");
        } else {
          signals.push("HOLD");
        }
        break;

      default:
        signals.push("HOLD");
    }
  }
  return signals;
}

/** 🔹 Sinyal multiindikator (diperbaiki) */
export function genMultiSignals(d, map) {
  const signals = ["HOLD"];

  for (let i = 1; i < d.length; i++) {
    const current = d[i];
    const previous = d[i - 1];
    const price = map.get(current.time.toString());

    if (!price) {
      signals.push("HOLD");
      continue;
    }

    const safe = (v, def = 0) => (v == null || isNaN(v) ? def : v);

    // Momentum signals
    const rsi = safe(current.rsi, 50);
    const macd = safe(current.macd);
    const macdSignal = safe(current.macdSignal);
    const momBuyScore = (rsi < 35 ? 1 : 0) + (macd > macdSignal ? 1 : 0);
    const momSellScore = (rsi > 65 ? 1 : 0) + (macd < macdSignal ? 1 : 0);

    // Trend signals
    const sma20 = safe(current.sma20);
    const sma50 = safe(current.sma50);
    const ema20 = safe(current.ema20);
    const trendBuyScore = (sma20 > sma50 ? 1 : 0) + (price > ema20 ? 1 : 0);
    const trendSellScore = (sma20 < sma50 ? 1 : 0) + (price < ema20 ? 1 : 0);

    // Volatility signals
    const bbUpper = safe(current.bbUpper);
    const bbLower = safe(current.bbLower);
    const psar = safe(current.psar);
    const volBuyScore =
      (bbLower > 0 && price <= bbLower ? 1 : 0) + (price > psar ? 1 : 0);
    const volSellScore =
      (bbUpper > 0 && price >= bbUpper ? 1 : 0) + (price < psar ? 1 : 0);

    // Voting system (need at least 2 categories agreement)
    const totalBuyScore = momBuyScore + trendBuyScore + volBuyScore;
    const totalSellScore = momSellScore + trendSellScore + volSellScore;

    let signal = "HOLD";
    if (totalBuyScore >= 3 && totalBuyScore > totalSellScore) {
      signal = "BUY";
    } else if (totalSellScore >= 3 && totalSellScore > totalBuyScore) {
      signal = "SELL";
    }

    signals.push(signal);
  }

  return signals;
}
