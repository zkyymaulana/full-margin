import { useIndicator, useMultiIndicator } from "../hooks/useIndicators";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useMemo } from "react";

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Format number with proper decimals
 */
const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Number(num).toFixed(decimals);
};

/**
 * Format price with thousand separators
 */
const formatPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return null;
  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Get signal with color and icon based on signal type
 */
const getIndicatorSignal = (signal, isDarkMode) => {
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
 */
const parseIndicators = (indicators = {}, price = 0) => {
  const parsed = {
    trend: [],
    momentum: [],
    volatility: [],
  };

  // Parse SMA
  if (indicators.sma) {
    Object.entries(indicators.sma).forEach(([key, value]) => {
      if (key !== "signal" && !isNaN(value)) {
        parsed.trend.push({
          name: `SMA(${key})`,
          key: `sma_${key}`,
          value: value,
          signal: indicators.sma.signal || "neutral",
          type: "price",
        });
      }
    });
  }

  // Parse EMA
  if (indicators.ema) {
    Object.entries(indicators.ema).forEach(([key, value]) => {
      if (key !== "signal" && !isNaN(value)) {
        parsed.trend.push({
          name: `EMA(${key})`,
          key: `ema_${key}`,
          value: value,
          signal: indicators.ema.signal || "neutral",
          type: "price",
        });
      }
    });
  }

  // Parse Parabolic SAR
  if (indicators.parabolicSar?.value !== undefined) {
    const psarSignal =
      price > indicators.parabolicSar.value
        ? "buy"
        : price < indicators.parabolicSar.value
        ? "sell"
        : "neutral";
    parsed.trend.push({
      name: "Parabolic SAR",
      key: "psar",
      value: indicators.parabolicSar.value,
      signal: psarSignal,
      type: "price",
    });
  }

  // Parse RSI
  if (indicators.rsi) {
    Object.entries(indicators.rsi).forEach(([key, value]) => {
      if (key !== "signal" && !isNaN(value)) {
        parsed.momentum.push({
          name: `RSI(${key})`,
          key: `rsi_${key}`,
          value: value,
          signal: indicators.rsi.signal || "neutral",
          type: "index",
        });
      }
    });
  }

  // Parse MACD
  if (indicators.macd) {
    const macdSignal =
      indicators.macd.histogram > 0
        ? "buy"
        : indicators.macd.histogram < 0
        ? "sell"
        : "neutral";

    if (indicators.macd.macd !== undefined) {
      parsed.momentum.push({
        name: "MACD",
        key: "macd_macd",
        value: indicators.macd.macd,
        signal: macdSignal,
        type: "index",
      });
    }
    if (indicators.macd.signalLine !== undefined) {
      parsed.momentum.push({
        name: "MACD Signal",
        key: "macd_signal",
        value: indicators.macd.signalLine,
        signal: macdSignal,
        type: "index",
      });
    }
    if (indicators.macd.histogram !== undefined) {
      parsed.momentum.push({
        name: "MACD Histogram",
        key: "macd_histogram",
        value: indicators.macd.histogram,
        signal: macdSignal,
        type: "index",
      });
    }
  }

  // Parse Stochastic
  if (indicators.stochastic) {
    const stochSignal =
      indicators.stochastic["%K"] > 80
        ? "sell"
        : indicators.stochastic["%K"] < 20
        ? "buy"
        : "neutral";

    if (indicators.stochastic["%K"] !== undefined) {
      parsed.momentum.push({
        name: "Stochastic %K",
        key: "stoch_k",
        value: indicators.stochastic["%K"],
        signal: stochSignal,
        type: "index",
      });
    }
    if (indicators.stochastic["%D"] !== undefined) {
      parsed.momentum.push({
        name: "Stochastic %D",
        key: "stoch_d",
        value: indicators.stochastic["%D"],
        signal: stochSignal,
        type: "index",
      });
    }
  }

  // Parse Stochastic RSI
  if (indicators.stochasticRsi) {
    const stochRsiSignal =
      indicators.stochasticRsi["%K"] > 0.8
        ? "sell"
        : indicators.stochasticRsi["%K"] < 0.2
        ? "buy"
        : "neutral";

    if (indicators.stochasticRsi["%K"] !== undefined) {
      parsed.momentum.push({
        name: "Stochastic RSI %K",
        key: "stochrsi_k",
        value: indicators.stochasticRsi["%K"],
        signal: stochRsiSignal,
        type: "index",
      });
    }
    if (indicators.stochasticRsi["%D"] !== undefined) {
      parsed.momentum.push({
        name: "Stochastic RSI %D",
        key: "stochrsi_d",
        value: indicators.stochasticRsi["%D"],
        signal: stochRsiSignal,
        type: "index",
      });
    }
  }

  // Parse Bollinger Bands
  if (indicators.bollingerBands) {
    const bbSignal =
      price > indicators.bollingerBands.upper
        ? "sell"
        : price < indicators.bollingerBands.lower
        ? "buy"
        : "neutral";

    if (indicators.bollingerBands.upper !== undefined) {
      parsed.volatility.push({
        name: "Bollinger Upper",
        key: "bb_upper",
        value: indicators.bollingerBands.upper,
        signal: bbSignal,
        type: "price",
      });
    }
    if (indicators.bollingerBands.middle !== undefined) {
      parsed.volatility.push({
        name: "Bollinger Middle",
        key: "bb_middle",
        value: indicators.bollingerBands.middle,
        signal: bbSignal,
        type: "price",
      });
    }
    if (indicators.bollingerBands.lower !== undefined) {
      parsed.volatility.push({
        name: "Bollinger Lower",
        key: "bb_lower",
        value: indicators.bollingerBands.lower,
        signal: bbSignal,
        type: "price",
      });
    }
  }

  return parsed;
};

/**
 * Calculate category score from indicators
 */
const calculateCategoryScore = (indicators = [], weights = {}) => {
  if (indicators.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  indicators.forEach((indicator) => {
    const weight = weights[indicator.key] || 1;
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
const getActiveCategoriesFromCombo = (bestCombo = "") => {
  const combo = bestCombo.toLowerCase();
  return {
    trend: combo.includes("trend"),
    momentum: combo.includes("momentum"),
    volatility: combo.includes("volatility"),
  };
};

// ========================================
// REUSABLE INDICATOR CARD COMPONENT
// ========================================
const IndicatorCard = ({
  title,
  indicators,
  weight,
  score,
  color,
  isDarkMode,
  tooltip,
}) => {
  if (indicators.length === 0) return null;

  return (
    <div
      className={`rounded-xl shadow-sm border p-6 ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3
            className={`text-lg font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {title}
          </h3>
          {tooltip && (
            <div className="group relative">
              <span className="text-sm cursor-help">ℹ️</span>
              <div
                className={`invisible group-hover:visible absolute left-0 top-6 w-72 p-3 rounded-lg shadow-lg z-50 text-xs ${
                  isDarkMode
                    ? "bg-gray-800 border border-gray-700 text-gray-300"
                    : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                {tooltip}
              </div>
            </div>
          )}
        </div>
        {weight !== undefined && weight > 0 && (
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${color}`}
          >
            Weight: {formatNumber(weight)}
          </span>
        )}
      </div>

      {/* Score Display */}
      {score !== undefined && (
        <div className="mb-4 text-center">
          <div
            className={`text-3xl font-bold ${color
              .split(" ")[0]
              .replace("bg-", "text-")}`}
          >
            {formatNumber(score)}
          </div>
          <div
            className={`text-xs mt-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Category Score
          </div>
        </div>
      )}

      {/* Indicators List */}
      <div className="space-y-3">
        {indicators.map((indicator, index) => {
          const { signal: signalText, color: signalColor } = getIndicatorSignal(
            indicator.signal,
            isDarkMode
          );
          const displayValue =
            indicator.type === "price"
              ? formatPrice(indicator.value)
              : formatNumber(indicator.value);

          if (!displayValue) return null;

          return (
            <div
              key={indicator.key}
              className={`flex justify-between items-center ${
                index === indicators.length - 1 && indicators.length > 4
                  ? "pt-2 border-t border-gray-200 dark:border-gray-700"
                  : ""
              }`}
            >
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {indicator.name}
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {indicator.type === "price" ? "$" : ""}
                  {displayValue}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${signalColor}`}
                >
                  {signalText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================
function Indicators() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const {
    data: indicatorData,
    isLoading: indicatorLoading,
    error: indicatorError,
  } = useIndicator(selectedSymbol);
  const {
    data: multiData,
    isLoading: multiLoading,
    error: multiError,
  } = useMultiIndicator(selectedSymbol);

  const isLoading = indicatorLoading || multiLoading;
  const error = indicatorError || multiError;

  // Parse and categorize indicators
  const {
    parsedIndicators,
    categoryWeights,
    categoryScores,
    totalScore,
    multiSignal,
  } = useMemo(() => {
    if (!indicatorData?.data?.[0]) {
      return {
        parsedIndicators: { trend: [], momentum: [], volatility: [] },
        categoryWeights: { trend: 0, momentum: 0, volatility: 0 },
        categoryScores: { trend: 0, momentum: 0, volatility: 0 },
        totalScore: 0,
        multiSignal: "HOLD",
      };
    }

    const latestData = indicatorData.data[0];
    const parsed = parseIndicators(latestData.indicators, latestData.price);

    // Extract weights from multiData
    const bestWeights = multiData?.bestWeights || {};
    const weights = {
      trend:
        (bestWeights.SMA || 0) +
        (bestWeights.EMA || 0) +
        (bestWeights.PSAR || 0),
      momentum:
        (bestWeights.RSI || 0) +
        (bestWeights.MACD || 0) +
        (bestWeights.Stochastic || 0) +
        (bestWeights.StochasticRSI || 0),
      volatility: bestWeights.BollingerBands || 0,
    };

    // Calculate category scores
    const scores = {
      trend: calculateCategoryScore(parsed.trend, bestWeights),
      momentum: calculateCategoryScore(parsed.momentum, bestWeights),
      volatility: calculateCategoryScore(parsed.volatility, bestWeights),
    };

    // Calculate total score
    const totalWeight = weights.trend + weights.momentum + weights.volatility;
    const total =
      totalWeight > 0
        ? (scores.trend * weights.trend +
            scores.momentum * weights.momentum +
            scores.volatility * weights.volatility) /
          totalWeight
        : 0;

    const signal = total > 0.3 ? "BUY" : total < -0.3 ? "SELL" : "HOLD";

    return {
      parsedIndicators: parsed,
      categoryWeights: weights,
      categoryScores: scores,
      totalScore: total,
      multiSignal: signal,
    };
  }, [indicatorData, multiData]);

  // Determine active categories
  const activeCategories = useMemo(() => {
    return getActiveCategoriesFromCombo(multiData?.bestCombo || "");
  }, [multiData?.bestCombo]);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
            Loading indicators...
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className={`p-4 border rounded-lg ${
          isDarkMode
            ? "bg-red-900 border-red-600 text-red-300"
            : "bg-red-100 border-red-400 text-red-700"
        }`}
      >
        Error loading indicators: {error.message}
      </div>
    );
  }

  // Extract data
  const latestIndicator = indicatorData?.data?.[0] || {};
  const { price, time } = latestIndicator;
  const { performance = {}, methodology, bestCombo } = multiData || {};

  const lastUpdate = time ? new Date(time).toLocaleString() : "N/A";

  // All indicators for table
  const allIndicators = [
    ...parsedIndicators.trend.map((ind) => ({ ...ind, category: "Trend" })),
    ...parsedIndicators.momentum.map((ind) => ({
      ...ind,
      category: "Momentum",
    })),
    ...parsedIndicators.volatility.map((ind) => ({
      ...ind,
      category: "Volatility",
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1
            className={`text-3xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Technical Indicator Analysis
          </h1>
          <div className="group relative">
            <span className="text-2xl cursor-help">ℹ️</span>
            <div
              className={`invisible group-hover:visible absolute left-0 top-8 w-80 p-4 rounded-lg shadow-lg z-50 ${
                isDarkMode
                  ? "bg-gray-800 border border-gray-700 text-gray-300"
                  : "bg-white border border-gray-200 text-gray-700"
              }`}
            >
              <h4 className="font-semibold mb-2">Tentang Halaman Ini</h4>
              <p className="text-sm">
                Halaman ini menampilkan analisis teknikal lengkap menggunakan
                berbagai indikator yang dikelompokkan dalam 3 kategori: Trend,
                Momentum, dan Volatility. Sistem akan memberikan rekomendasi
                BUY/SELL/HOLD berdasarkan kombinasi semua indikator.
              </p>
            </div>
          </div>
        </div>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          {methodology || "Rule-Based Multi-Indicator Evaluation"}
        </p>
        <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Symbol:{" "}
            <span
              className={`font-bold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              {selectedSymbol}
            </span>
          </span>
          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Last Update: {lastUpdate}
          </span>
          {price && (
            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
              Current Price:{" "}
              <span
                className={`font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                ${formatPrice(price)}
              </span>
            </span>
          )}
          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Timeframe:{" "}
            <span
              className={`font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              {indicatorData?.timeframe || "1h"}
            </span>
          </span>
          {bestCombo && (
            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
              Best Strategy:{" "}
              <span
                className={`font-semibold ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}
              >
                {bestCombo}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Performance Metrics Banner */}
      {performance && Object.keys(performance).length > 0 && (
        <div
          className={`rounded-xl shadow-sm border p-4 ${
            isDarkMode
              ? "bg-gradient-to-r from-blue-900 to-purple-900 border-blue-700"
              : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <span
                className={`font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Backtest Performance ({bestCombo})
              </span>
              <div className="group relative">
                <span className="text-sm cursor-help">ℹ️</span>
                <div
                  className={`invisible group-hover:visible absolute left-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
                    isDarkMode
                      ? "bg-gray-800 border border-gray-700 text-gray-300"
                      : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  <p className="font-semibold mb-1">📊 Hasil Backtest</p>
                  <p>
                    Ini adalah hasil uji coba strategi trading menggunakan data
                    historis. Strategi terbaik yang dipilih berdasarkan ROI
                    tertinggi dari kombinasi indikator yang tersedia.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  ROI
                </div>
                <div
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-green-400" : "text-green-600"
                  }`}
                >
                  {formatNumber(performance.roi) || "N/A"}%
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Win Rate
                </div>
                <div
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  {formatNumber(performance.winRate) || "N/A"}%
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Max Drawdown
                </div>
                <div
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-red-400" : "text-red-600"
                  }`}
                >
                  {formatNumber(performance.maxDrawdown) || "N/A"}%
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Trades
                </div>
                <div
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {performance.trades || "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Cards - Dynamic based on bestCombo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeCategories.trend && parsedIndicators.trend.length > 0 && (
          <IndicatorCard
            title="Trend"
            indicators={parsedIndicators.trend}
            weight={categoryWeights.trend}
            score={categoryScores.trend}
            color={
              isDarkMode
                ? "bg-blue-900 text-blue-300"
                : "bg-blue-100 text-blue-700"
            }
            isDarkMode={isDarkMode}
            tooltip={
              <>
                <p className="font-semibold mb-1">📈 Indikator Trend</p>
                <p>
                  <strong>SMA/EMA:</strong> Moving Average untuk melihat arah
                  trend harga.
                  <br />
                  <strong>PSAR:</strong> Parabolic SAR untuk menentukan
                  potential stop dan reversal point.
                  <br />
                  <strong>Score Positif</strong> = Trend naik (Bullish)
                  <br />
                  <strong>Score Negatif</strong> = Trend turun (Bearish)
                </p>
              </>
            }
          />
        )}

        {activeCategories.momentum && parsedIndicators.momentum.length > 0 && (
          <IndicatorCard
            title="Momentum"
            indicators={parsedIndicators.momentum}
            weight={categoryWeights.momentum}
            score={categoryScores.momentum}
            color={
              isDarkMode
                ? "bg-purple-900 text-purple-300"
                : "bg-purple-100 text-purple-700"
            }
            isDarkMode={isDarkMode}
            tooltip={
              <>
                <p className="font-semibold mb-1">⚡ Indikator Momentum</p>
                <p>
                  <strong>RSI:</strong> Relative Strength Index, mengukur
                  kecepatan perubahan harga (Overbought &gt;70, Oversold
                  &lt;30).
                  <br />
                  <strong>MACD:</strong> Moving Average Convergence Divergence,
                  untuk momentum trend.
                  <br />
                  <strong>Stochastic:</strong> Membandingkan harga close dengan
                  range harga tertentu.
                </p>
              </>
            }
          />
        )}

        {activeCategories.volatility &&
          parsedIndicators.volatility.length > 0 && (
            <IndicatorCard
              title="Volatility"
              indicators={parsedIndicators.volatility}
              weight={categoryWeights.volatility}
              score={categoryScores.volatility}
              color={
                isDarkMode
                  ? "bg-green-900 text-green-300"
                  : "bg-green-100 text-green-700"
              }
              isDarkMode={isDarkMode}
              tooltip={
                <>
                  <p className="font-semibold mb-1">💥 Indikator Volatility</p>
                  <p>
                    <strong>Bollinger Bands:</strong> Mengukur volatilitas pasar
                    dengan 3 garis (Upper, Middle, Lower).
                    <br />
                    Harga di atas Upper Band = Potensi Overbought
                    <br />
                    Harga di bawah Lower Band = Potensi Oversold
                    <br />
                    <strong>Score:</strong> Membantu identifikasi timing entry
                    yang tepat.
                  </p>
                </>
              }
            />
          )}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Complete Indicator Analysis Table */}
        {allIndicators.length > 0 && (
          <div
            className={`lg:col-span-2 rounded-xl shadow-sm border ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📊</div>
                  <div>
                    <h3
                      className={`text-lg font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Complete Indicator Analysis
                    </h3>
                  </div>
                  <div className="group relative">
                    <span className="text-sm cursor-help">ℹ️</span>
                    <div
                      className={`invisible group-hover:visible absolute left-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
                        isDarkMode
                          ? "bg-gray-800 border border-gray-700 text-gray-300"
                          : "bg-white border border-gray-200 text-gray-700"
                      }`}
                    >
                      <p className="font-semibold mb-1">
                        📋 Tabel Indikator Lengkap
                      </p>
                      <p>
                        Menampilkan semua indikator teknikal dengan nilai
                        real-time dan sinyal masing-masing. Dikelompokkan
                        berdasarkan kategori (Trend/Momentum/Volatility) untuk
                        memudahkan analisis.
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    isDarkMode
                      ? "bg-blue-900 text-blue-300"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {allIndicators.length} Indicators
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDarkMode ? "border-gray-700" : "border-gray-200"
                      }`}
                    >
                      <th
                        className={`text-left py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Indicator
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Current Value
                      </th>
                      <th
                        className={`text-center py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Signal
                      </th>
                      <th
                        className={`text-center py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIndicators.map((indicator, index) => {
                      const {
                        signal: signalText,
                        color: signalColor,
                        icon,
                      } = getIndicatorSignal(indicator.signal, isDarkMode);
                      const displayValue =
                        indicator.type === "price"
                          ? formatPrice(indicator.value)
                          : formatNumber(indicator.value);

                      if (!displayValue) return null;

                      return (
                        <tr
                          key={indicator.key}
                          className={`border-b transition-colors ${
                            isDarkMode
                              ? "border-gray-700 hover:bg-gray-700"
                              : "border-gray-100 hover:bg-gray-50"
                          }`}
                        >
                          <td
                            className={`py-3 px-4 text-sm font-medium ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {indicator.name}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {indicator.type === "price" && "$"}
                            {displayValue}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${signalColor}`}
                            >
                              {icon} {signalText}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                indicator.category === "Trend"
                                  ? isDarkMode
                                    ? "bg-blue-900 text-blue-300"
                                    : "bg-blue-100 text-blue-700"
                                  : indicator.category === "Momentum"
                                  ? isDarkMode
                                    ? "bg-purple-900 text-purple-300"
                                    : "bg-purple-100 text-purple-700"
                                  : isDarkMode
                                  ? "bg-green-900 text-green-300"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {indicator.category}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Multi Indicator Panel */}
        <div
          className={`rounded-xl shadow-sm border ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-2xl">🎯</div>
              <div>
                <h3
                  className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Multi Indicator
                </h3>
              </div>
              <div className="group relative">
                <span className="text-sm cursor-help">ℹ️</span>
                <div
                  className={`invisible group-hover:visible absolute right-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
                    isDarkMode
                      ? "bg-gray-800 border border-gray-700 text-gray-300"
                      : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  <p className="font-semibold mb-1">
                    🎯 Sinyal Multi-Indikator
                  </p>
                  <p>
                    Menggabungkan semua indikator dengan bobot optimal dari
                    hasil backtest. Score dihitung berdasarkan:
                    <br />
                    <strong>BUY:</strong> Score &gt; 0.3
                    <br />
                    <strong>HOLD:</strong> Score -0.3 hingga 0.3
                    <br />
                    <strong>SELL:</strong> Score &lt; -0.3
                    <br />
                    Semakin tinggi score, semakin kuat sinyal.
                  </p>
                </div>
              </div>
            </div>

            {/* Signal Display */}
            <div className="text-center mb-6">
              <div
                className={`text-5xl font-black mb-2 ${
                  multiSignal === "BUY"
                    ? isDarkMode
                      ? "text-green-400"
                      : "text-green-600"
                    : multiSignal === "SELL"
                    ? isDarkMode
                      ? "text-red-400"
                      : "text-red-600"
                    : isDarkMode
                    ? "text-white"
                    : "text-gray-900"
                }`}
              >
                {multiSignal}
              </div>
              <div
                className={`text-sm mb-4 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Total Score: {formatNumber(totalScore)}
              </div>

              {/* Signal Slider */}
              <div className="mb-4">
                <div
                  className={`flex justify-between text-xs mb-2 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <span>SELL</span>
                  <span>NEUTRAL</span>
                  <span>BUY</span>
                </div>
                <div
                  className={`relative h-2 rounded-full ${
                    isDarkMode
                      ? "bg-gradient-to-r from-red-500 via-gray-600 to-green-500"
                      : "bg-gradient-to-r from-red-500 via-gray-300 to-green-500"
                  }`}
                >
                  <div
                    className={`absolute w-4 h-4 rounded-full -top-1 transform -translate-x-1/2 transition-all duration-300 ${
                      isDarkMode ? "bg-white" : "bg-gray-900"
                    }`}
                    style={{ left: `${((totalScore + 1) / 2) * 100}%` }}
                  ></div>
                </div>
                <div
                  className={`flex justify-between text-xs mt-1 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  <span>-1.0</span>
                  <span>0</span>
                  <span>+1.0</span>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="space-y-3 mb-6">
              {activeCategories.trend && parsedIndicators.trend.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={categoryScores.trend > 0}
                    readOnly
                    className="rounded text-blue-600"
                  />
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Trend
                  </span>
                  <span
                    className={`ml-auto text-sm font-bold ${
                      categoryScores.trend > 0
                        ? isDarkMode
                          ? "text-green-400"
                          : "text-green-600"
                        : categoryScores.trend < 0
                        ? isDarkMode
                          ? "text-red-400"
                          : "text-red-600"
                        : isDarkMode
                        ? "text-gray-500"
                        : "text-gray-400"
                    }`}
                  >
                    {formatNumber(categoryScores.trend)}
                  </span>
                </div>
              )}
              {activeCategories.momentum &&
                parsedIndicators.momentum.length > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categoryScores.momentum > 0}
                      readOnly
                      className="rounded text-purple-600"
                    />
                    <span
                      className={`text-sm ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Momentum
                    </span>
                    <span
                      className={`ml-auto text-sm font-bold ${
                        categoryScores.momentum > 0
                          ? isDarkMode
                            ? "text-green-400"
                            : "text-green-600"
                          : categoryScores.momentum < 0
                          ? isDarkMode
                            ? "text-red-400"
                            : "text-red-600"
                          : isDarkMode
                          ? "text-gray-500"
                          : "text-gray-400"
                      }`}
                    >
                      {formatNumber(categoryScores.momentum)}
                    </span>
                  </div>
                )}
              {activeCategories.volatility &&
                parsedIndicators.volatility.length > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categoryScores.volatility > 0}
                      readOnly
                      className="rounded text-green-600"
                    />
                    <span
                      className={`text-sm ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Volatility
                    </span>
                    <span
                      className={`ml-auto text-sm font-bold ${
                        categoryScores.volatility > 0
                          ? isDarkMode
                            ? "text-green-400"
                            : "text-green-600"
                          : categoryScores.volatility < 0
                          ? isDarkMode
                            ? "text-red-400"
                            : "text-red-600"
                          : isDarkMode
                          ? "text-gray-500"
                          : "text-gray-400"
                      }`}
                    >
                      {formatNumber(categoryScores.volatility)}
                    </span>
                  </div>
                )}
            </div>

            {/* Signal Breakdown */}
            <div
              className={`pt-6 border-t ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <h4
                className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                <span className="text-lg">💎</span>
                Signal Breakdown ({allIndicators.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allIndicators.map((indicator) => {
                  const { signal, icon } = getIndicatorSignal(
                    indicator.signal,
                    isDarkMode
                  );
                  return (
                    <div
                      key={indicator.key}
                      className="flex justify-between items-center"
                    >
                      <span
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {indicator.name}
                      </span>
                      <span
                        className={`text-xs font-medium flex items-center gap-1 ${
                          signal === "BUY"
                            ? isDarkMode
                              ? "text-green-400"
                              : "text-green-600"
                            : signal === "SELL"
                            ? isDarkMode
                              ? "text-red-400"
                              : "text-red-600"
                            : isDarkMode
                            ? "text-gray-400"
                            : "text-gray-500"
                        }`}
                      >
                        {icon} {signal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Indicators;
