/**
 * Format number with proper decimals
 */
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Number(num).toFixed(decimals);
};

/**
 * Format price with thousand separators
 */
export const formatPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return null;
  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Get signal with color and icon based on signal type
 */
export const getIndicatorSignal = (signal, isDarkMode) => {
  const normalizedSignal = signal?.toLowerCase();

  if (normalizedSignal === "buy") {
    return {
      signal: "BUY",
      color: isDarkMode
        ? "bg-green-900 text-green-300"
        : "bg-green-100 text-green-700",
      icon: "📈",
    };
  } else if (normalizedSignal === "sell") {
    return {
      signal: "SELL",
      color: isDarkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-700",
      icon: "📉",
    };
  } else {
    return {
      signal: "NEUTRAL",
      color: isDarkMode
        ? "bg-gray-700 text-gray-300"
        : "bg-gray-100 text-gray-700",
      icon: "⚖️",
    };
  }
};

/**
 * Parse indicators from API response and categorize them
 * Returns only 8 core indicators without sub-lines
 */
export const parseIndicators = (indicators = {}, price = 0, weights = {}) => {
  const parsed = {
    trend: [],
    momentum: [],
    volatility: [],
  };

  // Parse SMA (Trend)
  if (indicators.sma) {
    parsed.trend.push({
      name: "SMA",
      key: "SMA",
      signal: indicators.sma.signal || "neutral",
      weight: weights.SMA || 0,
      type: "trend",
    });
  }

  // Parse EMA (Trend)
  if (indicators.ema) {
    parsed.trend.push({
      name: "EMA",
      key: "EMA",
      signal: indicators.ema.signal || "neutral",
      weight: weights.EMA || 0,
      type: "trend",
    });
  }

  // Parse Parabolic SAR (Trend)
  if (indicators.parabolicSar?.value !== undefined) {
    const psarSignal =
      price > indicators.parabolicSar.value
        ? "buy"
        : price < indicators.parabolicSar.value
        ? "sell"
        : "neutral";
    parsed.trend.push({
      name: "Parabolic SAR",
      key: "PSAR",
      signal: psarSignal,
      weight: weights.PSAR || 0,
      type: "trend",
    });
  }

  // Parse RSI (Momentum)
  if (indicators.rsi) {
    parsed.momentum.push({
      name: "RSI",
      key: "RSI",
      signal: indicators.rsi.signal || "neutral",
      weight: weights.RSI || 0,
      type: "momentum",
    });
  }

  // Parse MACD (Momentum) - Single indicator
  if (indicators.macd) {
    const macdSignal =
      indicators.macd.histogram > 0
        ? "buy"
        : indicators.macd.histogram < 0
        ? "sell"
        : "neutral";

    parsed.momentum.push({
      name: "MACD",
      key: "MACD",
      signal: macdSignal,
      weight: weights.MACD || 0,
      type: "momentum",
    });
  }

  // Parse Stochastic (Momentum) - Single indicator
  if (indicators.stochastic) {
    const stochSignal =
      indicators.stochastic["%K"] > 80
        ? "sell"
        : indicators.stochastic["%K"] < 20
        ? "buy"
        : "neutral";

    parsed.momentum.push({
      name: "Stochastic Oscillator",
      key: "Stochastic",
      signal: stochSignal,
      weight: weights.Stochastic || 0,
      type: "momentum",
    });
  }

  // Parse Stochastic RSI (Momentum) - Single indicator
  if (indicators.stochasticRsi) {
    const stochRsiSignal =
      indicators.stochasticRsi["%K"] > 0.8
        ? "sell"
        : indicators.stochasticRsi["%K"] < 0.2
        ? "buy"
        : "neutral";

    parsed.momentum.push({
      name: "Stochastic RSI",
      key: "StochasticRSI",
      signal: stochRsiSignal,
      weight: weights.StochasticRSI || 0,
      type: "momentum",
    });
  }

  // Parse Bollinger Bands (Volatility) - Single indicator
  if (indicators.bollingerBands) {
    const bbSignal =
      price > indicators.bollingerBands.upper
        ? "sell"
        : price < indicators.bollingerBands.lower
        ? "buy"
        : "neutral";

    parsed.volatility.push({
      name: "Bollinger Bands",
      key: "BollingerBands",
      signal: bbSignal,
      weight: weights.BollingerBands || 0,
      type: "volatility",
    });
  }

  return parsed;
};

/**
 * Parse indicators from API response and categorize them
 * Returns detailed indicators with parameters (e.g., SMA 20, SMA 50, RSI 14)
 */
export const parseIndicatorsDetailed = (
  indicators = {},
  price = 0,
  weights = {}
) => {
  const parsed = {
    trend: [],
    momentum: [],
    volatility: [],
  };

  // Parse SMA (Trend) - with periods
  if (indicators.sma) {
    const periods = Object.keys(indicators.sma).filter(
      (key) => key !== "signal"
    );
    periods.forEach((period) => {
      parsed.trend.push({
        name: `SMA ${period}`,
        key: `SMA_${period}`,
        value: indicators.sma[period],
        signal: indicators.sma.signal || "neutral",
        weight: weights.SMA || 0,
        type: "trend",
      });
    });
  }

  // Parse EMA (Trend) - with periods
  if (indicators.ema) {
    const periods = Object.keys(indicators.ema).filter(
      (key) => key !== "signal"
    );
    periods.forEach((period) => {
      parsed.trend.push({
        name: `EMA ${period}`,
        key: `EMA_${period}`,
        value: indicators.ema[period],
        signal: indicators.ema.signal || "neutral",
        weight: weights.EMA || 0,
        type: "trend",
      });
    });
  }

  // Parse Parabolic SAR (Trend)
  if (indicators.parabolicSar?.value !== undefined) {
    const psarSignal =
      price > indicators.parabolicSar.value
        ? "buy"
        : price < indicators.parabolicSar.value
        ? "sell"
        : "neutral";
    parsed.trend.push({
      name: "Parabolic SAR",
      key: "PSAR",
      value: indicators.parabolicSar.value,
      signal: psarSignal,
      weight: weights.PSAR || 0,
      type: "trend",
    });
  }

  // Parse RSI (Momentum) - with period
  if (indicators.rsi) {
    const periods = Object.keys(indicators.rsi).filter(
      (key) => key !== "signal"
    );
    periods.forEach((period) => {
      parsed.momentum.push({
        name: `RSI ${period}`,
        key: `RSI_${period}`,
        value: indicators.rsi[period],
        signal: indicators.rsi.signal || "neutral",
        weight: weights.RSI || 0,
        type: "momentum",
      });
    });
  }

  // Parse MACD (Momentum)
  if (indicators.macd) {
    const macdSignal =
      indicators.macd.histogram > 0
        ? "buy"
        : indicators.macd.histogram < 0
        ? "sell"
        : "neutral";

    parsed.momentum.push({
      name: "MACD",
      key: "MACD",
      value: indicators.macd.macd,
      signal: macdSignal,
      weight: weights.MACD || 0,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "MACD Signal",
      key: "MACD_Signal",
      value: indicators.macd.signalLine,
      signal: macdSignal,
      weight: weights.MACD || 0,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "MACD Histogram",
      key: "MACD_Histogram",
      value: indicators.macd.histogram,
      signal: macdSignal,
      weight: weights.MACD || 0,
      type: "momentum",
    });
  }

  // Parse Stochastic (Momentum)
  if (indicators.stochastic) {
    const stochSignal =
      indicators.stochastic["%K"] > 80
        ? "sell"
        : indicators.stochastic["%K"] < 20
        ? "buy"
        : "neutral";

    parsed.momentum.push({
      name: "Stochastic %K",
      key: "Stochastic_K",
      value: indicators.stochastic["%K"],
      signal: stochSignal,
      weight: weights.Stochastic || 0,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "Stochastic %D",
      key: "Stochastic_D",
      value: indicators.stochastic["%D"],
      signal: stochSignal,
      weight: weights.Stochastic || 0,
      type: "momentum",
    });
  }

  // Parse Stochastic RSI (Momentum)
  if (indicators.stochasticRsi) {
    const stochRsiSignal =
      indicators.stochasticRsi["%K"] > 0.8
        ? "sell"
        : indicators.stochasticRsi["%K"] < 0.2
        ? "buy"
        : "neutral";

    parsed.momentum.push({
      name: "Stochastic RSI %K",
      key: "StochasticRSI_K",
      value: indicators.stochasticRsi["%K"],
      signal: stochRsiSignal,
      weight: weights.StochasticRSI || 0,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "Stochastic RSI %D",
      key: "StochasticRSI_D",
      value: indicators.stochasticRsi["%D"],
      signal: stochRsiSignal,
      weight: weights.StochasticRSI || 0,
      type: "momentum",
    });
  }

  // Parse Bollinger Bands (Volatility)
  if (indicators.bollingerBands) {
    const bbSignal =
      price > indicators.bollingerBands.upper
        ? "sell"
        : price < indicators.bollingerBands.lower
        ? "buy"
        : "neutral";

    parsed.volatility.push({
      name: "Bollinger Upper",
      key: "BB_Upper",
      value: indicators.bollingerBands.upper,
      signal: bbSignal,
      weight: weights.BollingerBands || 0,
      type: "volatility",
    });
    parsed.volatility.push({
      name: "Bollinger Middle",
      key: "BB_Middle",
      value: indicators.bollingerBands.middle,
      signal: bbSignal,
      weight: weights.BollingerBands || 0,
      type: "volatility",
    });
    parsed.volatility.push({
      name: "Bollinger Lower",
      key: "BB_Lower",
      value: indicators.bollingerBands.lower,
      signal: bbSignal,
      weight: weights.BollingerBands || 0,
      type: "volatility",
    });
  }

  return parsed;
};

/**
 * Calculate category score from indicators
 */
export const calculateCategoryScore = (indicators = [], weights = {}) => {
  if (indicators.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  indicators.forEach((indicator) => {
    const weight = weights[indicator.key] || 0;
    if (weight === 0) return; // Skip indicators with weight 0

    const signalValue =
      indicator.signal === "buy" ? 1 : indicator.signal === "sell" ? -1 : 0;

    totalScore += signalValue * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
};

/**
 * Determine which categories to show based on bestCombo
 */
export const getActiveCategoriesFromCombo = (bestCombo = "") => {
  const combo = bestCombo.toLowerCase();
  return {
    trend: combo.includes("trend"),
    momentum: combo.includes("momentum"),
    volatility: combo.includes("volatility"),
  };
};

/**
 * Normalize indicator names for cleaner display in table
 * Groups similar indicators and formats them nicely
 */
export const normalizeIndicatorName = (indicatorList = []) => {
  if (!indicatorList || indicatorList.length === 0) return [];

  const groups = {
    SMA: [],
    EMA: [],
    RSI: [],
    MACD: [],
    Stochastic: [],
    StochasticRSI: [],
    BollingerBands: [],
    PSAR: [],
  };

  // Group indicators by type
  indicatorList.forEach((indicator) => {
    const name = indicator.name;

    if (name.startsWith("SMA")) {
      groups.SMA.push(indicator);
    } else if (name.startsWith("EMA")) {
      groups.EMA.push(indicator);
    } else if (name.startsWith("RSI")) {
      groups.RSI.push(indicator);
    } else if (name.includes("MACD")) {
      groups.MACD.push(indicator);
    } else if (name.startsWith("Stochastic RSI")) {
      groups.StochasticRSI.push(indicator);
    } else if (name.startsWith("Stochastic")) {
      groups.Stochastic.push(indicator);
    } else if (name.includes("Bollinger")) {
      groups.BollingerBands.push(indicator);
    } else if (name.includes("Parabolic SAR")) {
      groups.PSAR.push(indicator);
    }
  });

  const normalized = [];

  // SMA - combine periods
  if (groups.SMA.length > 0) {
    const periods = groups.SMA.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (periods.length > 0) {
      normalized.push({
        name: `SMA (${periods.join(", ")})`,
        key: "SMA",
        signal: groups.SMA[0].signal,
        category: groups.SMA[0].category,
        weight: groups.SMA[0].weight,
      });
    }
  }

  // EMA - combine periods
  if (groups.EMA.length > 0) {
    const periods = groups.EMA.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (periods.length > 0) {
      normalized.push({
        name: `EMA (${periods.join(", ")})`,
        key: "EMA",
        signal: groups.EMA[0].signal,
        category: groups.EMA[0].category,
        weight: groups.EMA[0].weight,
      });
    }
  }

  // RSI - show period
  if (groups.RSI.length > 0) {
    const periods = groups.RSI.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 14;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    normalized.push({
      name: `RSI (${periods.join(", ")})`,
      key: "RSI",
      signal: groups.RSI[0].signal,
      category: groups.RSI[0].category,
      weight: groups.RSI[0].weight,
    });
  }

  // MACD - combine all (MACD, Signal, Histogram)
  if (groups.MACD.length > 0) {
    normalized.push({
      name: "MACD (12, 26, 9)",
      key: "MACD",
      signal: groups.MACD[0].signal,
      category: groups.MACD[0].category,
      weight: groups.MACD[0].weight,
    });
  }

  // Stochastic Oscillator - combine %K and %D
  if (groups.Stochastic.length > 0) {
    normalized.push({
      name: "Stochastic (14, 3)",
      key: "Stochastic",
      signal: groups.Stochastic[0].signal,
      category: groups.Stochastic[0].category,
      weight: groups.Stochastic[0].weight,
    });
  }

  // Stochastic RSI - combine %K and %D
  if (groups.StochasticRSI.length > 0) {
    normalized.push({
      name: "Stochastic RSI",
      key: "StochasticRSI",
      signal: groups.StochasticRSI[0].signal,
      category: groups.StochasticRSI[0].category,
      weight: groups.StochasticRSI[0].weight,
    });
  }

  // Bollinger Bands - combine Upper, Middle, Lower
  if (groups.BollingerBands.length > 0) {
    normalized.push({
      name: "Bollinger Bands (20, 2)",
      key: "BollingerBands",
      signal: groups.BollingerBands[0].signal,
      category: groups.BollingerBands[0].category,
      weight: groups.BollingerBands[0].weight,
    });
  }

  // Parabolic SAR
  if (groups.PSAR.length > 0) {
    normalized.push({
      name: "Parabolic SAR",
      key: "PSAR",
      signal: groups.PSAR[0].signal,
      category: groups.PSAR[0].category,
      weight: groups.PSAR[0].weight,
    });
  }

  return normalized;
};
