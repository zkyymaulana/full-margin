/**
 * File: telegram.message.js
 * -------------------------------------------------
 * Tujuan: Mengisolasi seluruh logika pembentukan pesan Telegram.
 * - Interpretasi skor indikator (trend/momentum/volatility)
 * - Pembuatan insight dari categoryScores
 * - Formatting message trading signal menjadi teks Markdown
 *
 * Refactor ini hanya memindahkan kode (tanpa mengubah format pesan/algoritma).
 */

/**
 * Interpretasi skor trend menjadi teks yang mudah dibaca.
 *
 */
export function interpretTrendScore(score) {
  if (score >= 3) return "Very Strong Uptrend";
  if (score >= 1) return "Strong Uptrend";
  if (score >= 0.5) return "Moderate Uptrend";
  if (score > -0.5) return "Sideways";
  if (score > -1) return "Moderate Downtrend";
  if (score > -3) return "Strong Downtrend";
  return "Very Strong Downtrend";
}

/**
 * Interpretasi skor momentum menjadi teks yang mudah dibaca.
 *
 */
export function interpretMomentumScore(score) {
  if (score >= 4) return "Extreme Bullish Momentum";
  if (score >= 2) return "Strong Bullish Momentum";
  if (score >= 0.5) return "Moderate Bullish Momentum";
  if (score > -0.5) return "Neutral Momentum";
  if (score > -2) return "Moderate Bearish Momentum";
  if (score > -4) return "Strong Bearish Momentum";
  return "Extreme Bearish Momentum";
}

/**
 * Interpretasi skor volatility menjadi teks yang mudah dibaca.
 *
 */
export function interpretVolatilityScore(score) {
  if (score >= 2) return "High Volatility (Bullish)";
  if (score >= 0.5) return "Elevated Volatility (Bullish)";
  if (score > -0.5) return "Normal Volatility";
  if (score > -2) return "Elevated Volatility (Bearish)";
  return "High Volatility (Bearish)";
}

/**
 * Membuat kalimat insight berdasarkan categoryScores.
 *
 * Aturan (tetap sama seperti sebelumnya):
 * - Faktor dominan dipilih berdasarkan nilai absolut (trend>=1, momentum>=1, volatility>=0.5)
 * - Bias mengikuti arah signal (buy/sell/neutral)
 *
 */
export function generateInsight(categoryScores, signal) {
  const { trend, momentum, volatility } = categoryScores;

  // Menentukan faktor dominan (nilai absolut besar)
  const dominantFactors = [];

  if (Math.abs(trend) >= 1) {
    dominantFactors.push(trend > 0 ? "positive trend" : "negative trend");
  }

  if (Math.abs(momentum) >= 1) {
    dominantFactors.push(momentum > 0 ? "strong momentum" : "weak momentum");
  }

  if (Math.abs(volatility) >= 0.5) {
    dominantFactors.push(volatility > 0 ? "high volatility" : "low volatility");
  }

  // Menyusun bias berdasarkan signal
  const bias =
    signal === "buy" ? "Bullish" : signal === "sell" ? "Bearish" : "Neutral";

  if (dominantFactors.length === 0) {
    return `${bias} bias with mixed signals across indicators.`;
  }

  const factorsText = dominantFactors.join(" and ");
  return `${bias} bias supported mainly by ${factorsText}.`;
}

/**
 * Membangun format pesan Telegram untuk trading signal.
 *
 * Penting:
 * - Format Markdown dan susunan pesan harus sama persis seperti sebelumnya.
 * - Fungsi ini hanya bertugas membuat string pesan (tanpa mengirim).
 *
 */
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
  // Format price dengan mata uang
  const formatCurrency = (value) => {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Format date & time (timezone Asia/Jakarta)
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

  // Format maxDrawdown secara aman
  const maxDrawdown =
    performance.maxDrawdown !== undefined &&
    performance.maxDrawdown !== null &&
    !isNaN(performance.maxDrawdown)
      ? performance.maxDrawdown.toFixed(2)
      : "0.00";

  // Generate insight berdasarkan category scores
  const insight = generateInsight(categoryScores, signal);

  // Emoji sinyal (sesuai aturan sebelumnya)
  const signalEmoji = signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "⚪";

  // Normalize strength display so sign always follows signal direction.
  const absoluteStrength = Math.abs(strength || 0);
  const displayStrength =
    signal === "sell"
      ? -absoluteStrength
      : signal === "buy"
        ? absoluteStrength
        : 0;
  const percent = Math.abs(displayStrength * 100).toFixed(0);
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

  // Susunan pesan (Markdown) harus sama
  const message = `${signalEmoji} *${signalLabel.toUpperCase()}* ${signalEmoji}

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

⚠️ _Performance reflects recent historical data (recent 1 year) and may vary with market conditions._
⚠️ _Decision Support Only — Not Financial Advice_`;

  return message;
}
