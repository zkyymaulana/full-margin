// ==============================
// GLOBAL THRESHOLD
// ==============================
const THRESHOLD = 0.6;

// ==============================
// INTERPRETATION FUNCTIONS
// ==============================

// Trend
export function interpretTrendScore(score) {
  if (score >= THRESHOLD) return "Strong Uptrend";
  if (score > -THRESHOLD) return "Sideways";
  return "Strong Downtrend";
}

// Momentum
export function interpretMomentumScore(score) {
  if (score >= THRESHOLD) return "Strong Bullish Momentum";
  if (score > -THRESHOLD) return "Neutral Momentum";
  return "Strong Bearish Momentum";
}

// Volatility (non-directional)
export function interpretVolatilityScore(score) {
  if (score >= THRESHOLD) return "High Volatility";
  if (score > -THRESHOLD) return "Normal Volatility";
  return "Low Volatility";
}

// ==============================
// HELPER
// ==============================
function simplifyLabel(label) {
  return label.toLowerCase();
}

// ==============================
// INSIGHT GENERATOR
// ==============================
export function generateInsight(categoryScores, signal, finalScore = 0) {
  const { trend, momentum, volatility } = categoryScores;

  const aligned = [];
  const conflicting = [];

  const isBullish = signal === "buy";
  const isBearish = signal === "sell";

  // ===== TREND =====
  const trendLabel = simplifyLabel(interpretTrendScore(trend));
  if (Math.abs(trend) >= THRESHOLD) {
    if ((trend > 0 && isBullish) || (trend < 0 && isBearish)) {
      aligned.push(trendLabel);
    } else {
      conflicting.push(trendLabel);
    }
  }

  // ===== MOMENTUM =====
  const momentumLabel = simplifyLabel(interpretMomentumScore(momentum));
  if (Math.abs(momentum) >= THRESHOLD) {
    if ((momentum > 0 && isBullish) || (momentum < 0 && isBearish)) {
      aligned.push(momentumLabel);
    } else {
      conflicting.push(momentumLabel);
    }
  }

  // ===== VOLATILITY (neutral) =====
  const volatilityLabel = simplifyLabel(interpretVolatilityScore(volatility));
  if (Math.abs(volatility) >= THRESHOLD) {
    aligned.push(volatilityLabel);
  }

  const bias =
    signal === "buy" ? "Bullish" : signal === "sell" ? "Bearish" : "Neutral";

  let sentence = "";

  if (aligned.length === 0 && conflicting.length === 0) {
    sentence = `${bias} bias with mixed signals across indicators.`;
  } else if (aligned.length > 0 && conflicting.length === 0) {
    sentence = `${bias} bias supported by ${aligned.join(" and ")}.`;
  } else if (aligned.length === 0 && conflicting.length > 0) {
    sentence = `${bias} bias despite ${conflicting.join(" and ")}.`;
  } else {
    sentence = `${bias} bias supported by ${aligned.join(
      " and ",
    )}, but conflicting with ${conflicting.join(" and ")}.`;
  }

  // Weak signal warning
  if (Math.abs(finalScore) < 0.2) {
    sentence += " Signal is weak and should be confirmed.";
  }

  return sentence;
}
export function formatTelegramSignalMessage({
  symbol,
  signal,
  signalLabel,
  price,
  finalScore,
  strength,
  categoryScores = { trend: 0, momentum: 0, volatility: 0 },
  timeframe = "1h",
  performance,
}) {
  const formatCurrency = (value) => {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const now = new Date();

  const dateStr = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });

  const maxDrawdown =
    performance.maxDrawdown !== undefined &&
    performance.maxDrawdown !== null &&
    !isNaN(performance.maxDrawdown)
      ? performance.maxDrawdown.toFixed(2)
      : "0.00";

  const insight = generateInsight(categoryScores, signal, finalScore);

  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";

  const absoluteStrength = Math.abs(strength || 0);
  const percent = Math.abs(absoluteStrength * 100).toFixed(0);

  const direction =
    signal === "sell" ? "SELL" : signal === "buy" ? "BUY" : "NEUTRAL";

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const startDateStr = oneYearAgo.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  const endDateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return `${signalEmoji} *${signalLabel.toUpperCase()}* ${signalEmoji}

💲 ${symbol}
• *Price:* ${formatCurrency(price)}
• *Score:* ${finalScore >= 0 ? "+" : ""}${finalScore.toFixed(2)}
• *Strength:* ${percent}% ${direction}
• *Timeframe:* ${timeframe}
• *Time:* ${dateStr}, ${timeStr}

📊 *Market Interpretation:*
• Trend: ${categoryScores.trend >= 0 ? "+" : ""}${categoryScores.trend.toFixed(2)} (${interpretTrendScore(categoryScores.trend)})
• Momentum: ${categoryScores.momentum >= 0 ? "+" : ""}${categoryScores.momentum.toFixed(2)} (${interpretMomentumScore(categoryScores.momentum)})
• Volatility: ${categoryScores.volatility >= 0 ? "+" : ""}${categoryScores.volatility.toFixed(2)} (${interpretVolatilityScore(categoryScores.volatility)})

📈 *Historical Strategy Performance (Recent 1 Year):*
${startDateStr} - ${endDateStr}
• ROI: ${performance.roi.toFixed(2)}%
• Win Rate: ${performance.winRate.toFixed(2)}%
• Max Drawdown: ${maxDrawdown}%
• Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}
• Trades: ${performance.trades}

💡 *Insight:*
${insight}

⚠️ _Performance reflects recent historical data and may vary with market conditions._
⚠️ _Decision Support Only — Not Financial Advice_`;
}
