import { useDarkMode } from "../../contexts/DarkModeContext";
import { safeSignal } from "../../utils/indicatorParser";
import { useState } from "react";

/**
 * InfoTooltip Component
 * Reusable tooltip component for indicator explanations
 */
function InfoTooltip({ title, content }) {
  const { isDarkMode } = useDarkMode();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          isDarkMode
            ? "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
            : "bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700"
        }`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        aria-label="Info"
      >
        ⓘ
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          className={`absolute z-50 w-64 p-3 rounded-lg shadow-lg text-xs leading-relaxed ${
            isDarkMode
              ? "bg-gray-900 text-gray-200 border border-gray-700"
              : "bg-white text-gray-700 border border-gray-200"
          }`}
          style={{
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
          }}
        >
          {/* Arrow */}
          <div
            className={`absolute w-3 h-3 transform rotate-45 ${
              isDarkMode
                ? "bg-gray-900 border-l border-t border-gray-700"
                : "bg-white border-l border-t border-gray-200"
            }`}
            style={{
              top: "-6px",
              left: "50%",
              marginLeft: "-6px",
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            <div className="font-semibold mb-2">{title}</div>
            <div className="space-y-1">{content}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Indicator explanations database
 */
const indicatorExplanations = {
  rsi: {
    title: "RSI (Relative Strength Index)",
    content: (
      <>
        <p>Measures price momentum on a scale of 0-100.</p>
        <p className="mt-1">
          <strong>&gt;70:</strong> Overbought (potential reversal down)
        </p>
        <p>
          <strong>&lt;30:</strong> Oversold (potential reversal up)
        </p>
      </>
    ),
  },
  psar: {
    title: "Parabolic SAR",
    content: (
      <>
        <p>Trend indicator that shows potential price reversal points.</p>
        <p className="mt-1">
          <strong>Step:</strong> Controls how fast the PSAR dots move
        </p>
        <p>
          <strong>Max Step:</strong> Maximum acceleration limit
        </p>
      </>
    ),
  },
  ema: {
    title: "EMA (Exponential Moving Average)",
    content: (
      <>
        <p>Moving average that gives more weight to recent prices.</p>
        <p className="mt-1">
          <strong>EMA 20:</strong> Short-term trend
        </p>
        <p>
          <strong>EMA 50:</strong> Medium-term trend
        </p>
      </>
    ),
  },
  sma: {
    title: "SMA (Simple Moving Average)",
    content: (
      <>
        <p>Simple average of closing prices over a period.</p>
        <p className="mt-1">
          <strong>SMA 20:</strong> Short-term trend
        </p>
        <p>
          <strong>SMA 50:</strong> Medium-term trend
        </p>
      </>
    ),
  },
  macd: {
    title: "MACD (Moving Average Convergence Divergence)",
    content: (
      <>
        <p>
          <strong>MACD:</strong> Difference between fast & slow EMAs
        </p>
        <p className="mt-1">
          <strong>Signal:</strong> EMA of the MACD line
        </p>
        <p>
          <strong>Histogram:</strong> Distance between MACD & Signal (trend
          strength)
        </p>
      </>
    ),
  },
  stochastic: {
    title: "Stochastic Oscillator",
    content: (
      <>
        <p>Measures momentum by comparing closing price to price range.</p>
        <p className="mt-1">
          <strong>%K:</strong> Main line showing current price position
        </p>
        <p>
          <strong>%D:</strong> Smoothed average of %K (signal confirmation)
        </p>
      </>
    ),
  },
  stochasticRsi: {
    title: "Stochastic RSI",
    content: (
      <>
        <p>Combines Stochastic & RSI for higher sensitivity.</p>
        <p className="mt-1">
          <strong>%K:</strong> Main stochastic RSI line
        </p>
        <p>
          <strong>%D:</strong> Smoothed average of %K (signal confirmation)
        </p>
      </>
    ),
  },
  bollinger: {
    title: "Bollinger Bands",
    content: (
      <>
        <p>Measures price volatility with 3 lines:</p>
        <p className="mt-1">
          <strong>Upper Band:</strong> Upper volatility boundary
        </p>
        <p>
          <strong>Middle Band:</strong> Main SMA (20-period)
        </p>
        <p>
          <strong>Lower Band:</strong> Lower volatility boundary
        </p>
      </>
    ),
  },
};

/**
 * Indicator Value Cards Component
 * Displays real-time indicator values in a grid layout
 * ✅ REFACTORED: Use backend signals only (no frontend calculation)
 * ✅ SAFE: Validate all signals with safeSignal()
 * ✅ NEW: Added educational tooltips
 */
function IndicatorValueCards({ latestCandle, activeIndicators }) {
  const { isDarkMode } = useDarkMode();

  if (!latestCandle || !latestCandle.indicators) {
    return null;
  }

  const indicators = latestCandle.indicators;
  const price = latestCandle.close;

  // Helper function to determine signal color
  const getSignalColor = (signal) => {
    if (signal === "buy")
      return isDarkMode ? "text-green-400" : "text-green-600";
    if (signal === "sell") return isDarkMode ? "text-red-400" : "text-red-600";
    return isDarkMode ? "text-gray-400" : "text-gray-600";
  };

  const getSignalBg = (signal) => {
    if (signal === "buy")
      return isDarkMode ? "bg-green-900/30" : "bg-green-100";
    if (signal === "sell") return isDarkMode ? "bg-red-900/30" : "bg-red-100";
    return isDarkMode ? "bg-gray-700" : "bg-gray-100";
  };

  // Format number
  const formatValue = (value, decimals = 2) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "number") {
      if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
      return value.toFixed(decimals);
    }
    return value;
  };

  const indicatorCards = [
    // RSI
    {
      id: "rsi",
      icon: "🔴",
      title: "RSI (14)",
      subtitle: "Real-time values",
      color: "#FF6D00",
      visible: activeIndicators.includes("rsi"),
      values: [
        {
          label: "RSI",
          value: formatValue(indicators.rsi?.[14]),
          bg: true,
        },
      ],
      signal: safeSignal(indicators.rsi?.signal),
    },
    // PSAR
    {
      id: "psar",
      icon: "🔴",
      title: "PSAR (0.02 / 0.2)",
      subtitle: "Real-time values",
      color: "#FF6A00",
      visible: activeIndicators.includes("psar"),
      values: [
        { label: "Step:", value: "0.02", bg: true },
        { label: "Max Step:", value: "0.2", bg: true },
        {
          label: "Current Value",
          value: `${formatValue(indicators.parabolicSar?.value)}`,
          bg: true,
        },
      ],
      signal: safeSignal(indicators.parabolicSar?.signal),
    },
    // EMA
    {
      id: "ema",
      icon: "🟣",
      title: "EMA (20, 50)",
      subtitle: "Real-time values",
      color: "#9C27B0",
      visible: activeIndicators.includes("ema"),
      values: [
        {
          label: "EMA 20:",
          value: `$${formatValue(indicators.ema?.[20])}K`,
          bg: true,
        },
        {
          label: "EMA 50:",
          value: `$${formatValue(indicators.ema?.[50])}K`,
          bg: true,
        },
      ],
      signal: safeSignal(indicators.ema?.signal),
    },
    // SMA
    {
      id: "sma",
      icon: "🔵",
      title: "SMA (20, 50)",
      subtitle: "Real-time values",
      color: "#2962FF",
      visible: activeIndicators.includes("sma"),
      values: [
        {
          label: "SMA 20:",
          value: `$${formatValue(indicators.sma?.[20])}K`,
          bg: true,
        },
        {
          label: "SMA 50:",
          value: `$${formatValue(indicators.sma?.[50])}K`,
          bg: true,
        },
      ],
      signal: safeSignal(indicators.sma?.signal),
    },
    // MACD
    {
      id: "macd",
      icon: "🟢",
      title: "MACD (12, 26, 9)",
      subtitle: "Real-time values",
      color: "#00C853",
      visible: activeIndicators.includes("macd"),
      values: [
        { label: "Fast:", value: "12", bg: true },
        { label: "Slow:", value: "26", bg: true },
        { label: "Signal:", value: "9", bg: true },
        { label: "MACD:", value: formatValue(indicators.macd?.macd), bg: true },
        {
          label: "Histogram:",
          value: formatValue(indicators.macd?.histogram),
          bg: true,
        },
      ],
      signal: safeSignal(indicators.macd?.signal),
    },
    // Stochastic
    {
      id: "stochastic",
      icon: "🟢",
      title: "Stochastic (14, 3)",
      subtitle: "Real-time values",
      color: "#4CAF50",
      visible: activeIndicators.includes("stochastic"),
      values: [
        { label: "K Period:", value: "14", bg: true },
        { label: "D Period:", value: "3", bg: true },
        {
          label: "%K:",
          value: formatValue(indicators.stochastic?.["%K"]),
          bg: true,
        },
        {
          label: "%D:",
          value: formatValue(indicators.stochastic?.["%D"]),
          bg: true,
        },
      ],
      signal: safeSignal(indicators.stochastic?.signal),
    },
    // Stochastic RSI
    {
      id: "stochasticRsi",
      icon: "🟡",
      title: "Stochastic RSI",
      subtitle: "Real-time values",
      color: "#FFC107",
      visible: activeIndicators.includes("stochasticRsi"),
      values: [
        { label: "RSI Period:", value: "14", bg: true },
        { label: "Stoch Period:", value: "14", bg: true },
        { label: "K Period:", value: "3", bg: true },
        { label: "D Period:", value: "3", bg: true },
        {
          label: "%K:",
          value: formatValue(indicators.stochasticRsi?.["%K"]),
          bg: true,
        },
        {
          label: "%D:",
          value: formatValue(indicators.stochasticRsi?.["%D"]),
          bg: true,
        },
      ],
      signal: safeSignal(indicators.stochasticRsi?.signal),
    },
    // Bollinger Bands
    {
      id: "bollinger",
      icon: "🔵",
      title: "Bollinger B. (20, 2)",
      subtitle: "Real-time values",
      color: "#00BCD4",
      visible: activeIndicators.includes("bollinger"),
      values: [
        { label: "Period:", value: "20", bg: true },
        { label: "Multiplier:", value: "2", bg: true },
        {
          label: "Upper:",
          value: `${formatValue(indicators.bollingerBands?.upper)}`,
          bg: true,
        },
        {
          label: "Middle:",
          value: `${formatValue(indicators.bollingerBands?.middle)}`,
          bg: true,
        },
        {
          label: "Lower:",
          value: `${formatValue(indicators.bollingerBands?.lower)}`,
          bg: true,
        },
      ],
      signal: safeSignal(indicators.bollingerBands?.signal),
    },
  ];

  const visibleCards = indicatorCards.filter((card) => card.visible);

  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {visibleCards.map((card) => (
        <div
          key={card.id}
          className={`rounded-xl p-4 h-full flex flex-col ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } shadow-sm border ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          {/* Header with Info Tooltip */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="text-2xl shrink-0"
              style={{ filter: isDarkMode ? "brightness(0.9)" : "none" }}
            >
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4
                  className={`text-sm font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {card.title}
                </h4>
                {/* ✅ Info Tooltip */}
                {indicatorExplanations[card.id] && (
                  <InfoTooltip
                    title={indicatorExplanations[card.id].title}
                    content={indicatorExplanations[card.id].content}
                  />
                )}
              </div>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {card.subtitle}
              </p>
            </div>
          </div>

          {/* Content (values) */}
          <div className="space-y-2 flex-1">
            {card.values.map((item, index) => (
              <div key={index}>
                {item.isBadge ? (
                  <div className="text-center py-2">
                    <div
                      className="text-3xl font-bold"
                      style={{ color: card.color }}
                    >
                      {item.value}
                    </div>
                  </div>
                ) : item.isHighlight ? (
                  <div className="text-center py-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {item.label}
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: card.color }}
                    >
                      {item.value}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      item.bg ? (isDarkMode ? "bg-gray-700" : "bg-gray-50") : ""
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Signal Badge */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div
              className={`px-3 py-1.5 rounded-lg text-center text-xs font-semibold uppercase ${getSignalBg(
                card.signal
              )} ${getSignalColor(card.signal)}`}
            >
              {card.signal}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default IndicatorValueCards;
