import { useDarkMode } from "../../contexts/DarkModeContext";

/**
 * Indicator Value Cards Component
 * Displays real-time indicator values in a grid layout
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

  // Determine PSAR signal
  const getPsarSignal = () => {
    if (!indicators.parabolicSar?.value || !price) return "neutral";
    return price > indicators.parabolicSar.value
      ? "buy"
      : price < indicators.parabolicSar.value
      ? "sell"
      : "neutral";
  };

  // Determine Bollinger signal
  const getBollingerSignal = () => {
    if (
      !indicators.bollingerBands?.upper ||
      !indicators.bollingerBands?.lower ||
      !price
    )
      return "neutral";
    return price > indicators.bollingerBands.upper
      ? "sell"
      : price < indicators.bollingerBands.lower
      ? "buy"
      : "neutral";
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
          isBadge: true,
        },
      ],
      signal:
        indicators.rsi?.[14] > 70
          ? "sell"
          : indicators.rsi?.[14] < 30
          ? "buy"
          : "neutral",
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
          value: `$${formatValue(indicators.parabolicSar?.value)}K`,
          isHighlight: true,
        },
      ],
      signal: getPsarSignal(),
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
      signal: "neutral",
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
      signal: "neutral",
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
          label: "Signal Line:",
          value: indicators.macd?.signalLine > 0 ? "buy" : "sell",
          isBadge: true,
        },
        {
          label: "Histogram:",
          value: formatValue(indicators.macd?.histogram),
          bg: true,
        },
      ],
      signal:
        indicators.macd?.macd > indicators.macd?.signalLine ? "buy" : "sell",
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
      signal:
        indicators.stochastic?.["%K"] > 80
          ? "sell"
          : indicators.stochastic?.["%K"] < 20
          ? "buy"
          : "neutral",
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
      signal:
        indicators.stochasticRsi?.["%K"] > 80
          ? "sell"
          : indicators.stochasticRsi?.["%K"] < 20
          ? "buy"
          : "neutral",
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
          value: `$${formatValue(indicators.bollingerBands?.upper)}K`,
          bg: true,
        },
        {
          label: "Middle:",
          value: `$${formatValue(indicators.bollingerBands?.middle)}K`,
          bg: true,
        },
        {
          label: "Lower:",
          value: `$${formatValue(indicators.bollingerBands?.lower)}K`,
          bg: true,
        },
      ],
      signal: getBollingerSignal(),
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
          className={`rounded-xl p-4 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } shadow-sm border ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="text-2xl shrink-0"
              style={{ filter: isDarkMode ? "brightness(0.9)" : "none" }}
            >
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className={`text-sm font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {card.title}
              </h4>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {card.subtitle}
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="space-y-2">
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
