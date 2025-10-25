import { useIndicator, useMultiIndicator } from "../hooks/useIndicators";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";

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

  // Get latest data from both APIs
  const latestIndicator = indicatorData?.data?.[0] || {};
  const latestMulti = multiData || {};

  const { price, indicators = {} } = latestIndicator;

  const {
    bestWeights = {},
    bestResult = {},
    symbol: multiSymbol,
    timeframe: multiTimeframe,
  } = latestMulti;

  // Extract weights from bestWeights
  const weights = {
    trend:
      (bestWeights.SMA || 0) + (bestWeights.EMA || 0) + (bestWeights.PSAR || 0),
    momentum:
      (bestWeights.RSI || 0) +
      (bestWeights.MACD || 0) +
      (bestWeights.Stochastic || 0) +
      (bestWeights.StochasticRSI || 0),
    volatility: bestWeights.BollingerBands || 0,
  };

  // Get individual signals from indicators (we'll use the indicator values to determine signals)
  const signals = {
    rsi:
      indicators.rsi?.[14] > 70
        ? "sell"
        : indicators.rsi?.[14] < 30
        ? "buy"
        : "neutral",
    macd:
      indicators.macd?.histogram > 0
        ? "buy"
        : indicators.macd?.histogram < 0
        ? "sell"
        : "neutral",
    stochastic:
      indicators.stochastic?.["%K"] > 80
        ? "sell"
        : indicators.stochastic?.["%K"] < 20
        ? "buy"
        : "neutral",
    stochasticRsi:
      indicators.stochasticRsi?.["%K"] > 0.8
        ? "sell"
        : indicators.stochasticRsi?.["%K"] < 0.2
        ? "buy"
        : "neutral",
    sma:
      price > indicators.sma?.[20]
        ? "buy"
        : price < indicators.sma?.[20]
        ? "sell"
        : "neutral",
    ema:
      price > indicators.ema?.[20]
        ? "buy"
        : price < indicators.ema?.[20]
        ? "sell"
        : "neutral",
    psar:
      price > indicators.parabolicSar?.value
        ? "buy"
        : price < indicators.parabolicSar?.value
        ? "sell"
        : "neutral",
    boll:
      price > indicators.bollingerBands?.upper
        ? "sell"
        : price < indicators.bollingerBands?.lower
        ? "buy"
        : "neutral",
  };

  // Calculate category scores based on signals and weights
  const calculateCategoryScore = (categorySignals, categoryWeight) => {
    let score = 0;
    let count = 0;
    categorySignals.forEach((signal) => {
      if (signal === "buy") score += 1;
      else if (signal === "sell") score -= 1;
      count++;
    });
    return count > 0 ? (score / count) * categoryWeight : 0;
  };

  const categoryScores = {
    trend: calculateCategoryScore(
      [signals.sma, signals.ema, signals.psar],
      weights.trend
    ),
    momentum: calculateCategoryScore(
      [signals.rsi, signals.macd, signals.stochastic, signals.stochasticRsi],
      weights.momentum
    ),
    volatility: calculateCategoryScore([signals.boll], weights.volatility),
  };

  // Calculate total score and multi indicator signal
  const totalScore =
    (categoryScores.trend +
      categoryScores.momentum +
      categoryScores.volatility) /
    (weights.trend + weights.momentum + weights.volatility || 1);

  const multiIndicator =
    totalScore > 0.3 ? "BUY" : totalScore < -0.3 ? "SELL" : "HOLD";

  const lastUpdate = latestIndicator.time
    ? new Date(latestIndicator.time).toLocaleString()
    : "N/A";

  // Format number helper
  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return typeof num === "number" ? num.toFixed(2) : num;
  };

  const formatPrice = (price) => {
    if (!price && price !== 0) return "N/A";
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get signal badge style
  const getSignalStyle = (signal) => {
    const normalizedSignal = signal?.toLowerCase();
    if (normalizedSignal === "buy") {
      return "bg-green-100 text-green-700";
    } else if (normalizedSignal === "sell") {
      return "bg-red-100 text-red-700";
    } else {
      return "bg-gray-100 text-gray-700";
    }
  };

  const getSignalText = (signal) => {
    return signal?.toUpperCase() || "NEUTRAL";
  };

  // Calculate slider position based on totalScore (-1 to 1)
  const getSliderPosition = () => {
    if (!totalScore && totalScore !== 0) return 50;
    // Convert score from -1...1 to 0...100
    return ((totalScore + 1) / 2) * 100;
  };

  // All indicators for table with real values
  const allIndicators = [
    {
      name: "RSI(14)",
      value: indicators.rsi?.[14],
      signal: getSignalText(signals.rsi),
      category: "Momentum",
    },
    {
      name: "MACD",
      value: indicators.macd?.macd,
      signal: getSignalText(signals.macd),
      category: "Momentum",
    },
    {
      name: "MACD Signal",
      value: indicators.macd?.signalLine,
      signal: getSignalText(signals.macd),
      category: "Momentum",
    },
    {
      name: "MACD Histogram",
      value: indicators.macd?.histogram,
      signal: getSignalText(signals.macd),
      category: "Momentum",
    },
    {
      name: "Stochastic %K",
      value: indicators.stochastic?.["%K"],
      signal: getSignalText(signals.stochastic),
      category: "Momentum",
    },
    {
      name: "Stochastic %D",
      value: indicators.stochastic?.["%D"],
      signal: getSignalText(signals.stochastic),
      category: "Momentum",
    },
    {
      name: "Stochastic RSI %K",
      value: indicators.stochasticRsi?.["%K"],
      signal: getSignalText(signals.stochasticRsi),
      category: "Momentum",
    },
    {
      name: "Stochastic RSI %D",
      value: indicators.stochasticRsi?.["%D"],
      signal: getSignalText(signals.stochasticRsi),
      category: "Momentum",
    },
    {
      name: "SMA(20)",
      value: indicators.sma?.[20],
      signal: getSignalText(signals.sma),
      category: "Trend",
    },
    {
      name: "SMA(50)",
      value: indicators.sma?.[50],
      signal: getSignalText(signals.sma),
      category: "Trend",
    },
    {
      name: "EMA(20)",
      value: indicators.ema?.[20],
      signal: getSignalText(signals.ema),
      category: "Trend",
    },
    {
      name: "EMA(50)",
      value: indicators.ema?.[50],
      signal: getSignalText(signals.ema),
      category: "Trend",
    },
    {
      name: "Parabolic SAR",
      value: indicators.parabolicSar?.value,
      signal: getSignalText(signals.psar),
      category: "Trend",
    },
    {
      name: "Bollinger Upper",
      value: indicators.bollingerBands?.upper,
      signal: getSignalText(signals.boll),
      category: "Volatility",
    },
    {
      name: "Bollinger Lower",
      value: indicators.bollingerBands?.lower,
      signal: getSignalText(signals.boll),
      category: "Volatility",
    },
  ];

  // Separate by category
  const trendIndicators = allIndicators.filter(
    (ind) => ind.category === "Trend"
  );
  const momentumIndicators = allIndicators.filter(
    (ind) => ind.category === "Momentum"
  );
  const volatilityIndicators = allIndicators.filter(
    (ind) => ind.category === "Volatility"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Technical Indicator Analysis
        </h1>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Detailed analysis of moving averages, oscillators, and momentum
          indicators with multi-strategy signals
        </p>
        <div className="mt-2 flex items-center gap-4 text-sm">
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
        </div>
      </div>

      {/* Top 3 Sections: Trend, Momentum, Volatility */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trend Section */}
        <div
          className={`rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Trend
            </h3>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                isDarkMode
                  ? "bg-blue-900 text-blue-300"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              Weight: {weights.trend || 0}
            </span>
          </div>
          <div className="mb-4 text-center">
            <div
              className={`text-3xl font-bold ${
                isDarkMode ? "text-blue-400" : "text-blue-700"
              }`}
            >
              {formatNumber(categoryScores.trend)}
            </div>
            <div
              className={`text-xs mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Category Score
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                SMA(20)
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.sma?.[20])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.sma)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.sma)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                SMA(50)
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.sma?.[50])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.sma)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.sma)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                EMA(20)
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.ema?.[20])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.ema)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.ema)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                EMA(50)
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.ema?.[50])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.ema)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.ema)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                PSAR
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.parabolicSar?.value)}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.psar)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.psar)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Momentum Section */}
        <div
          className={`rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Momentum
            </h3>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                isDarkMode
                  ? "bg-purple-900 text-purple-300"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              Weight: {weights.momentum || 0}
            </span>
          </div>
          <div className="mb-4 text-center">
            <div
              className={`text-3xl font-bold ${
                isDarkMode ? "text-purple-400" : "text-purple-700"
              }`}
            >
              {formatNumber(categoryScores.momentum)}
            </div>
            <div
              className={`text-xs mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Category Score
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                RSI(14)
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatNumber(indicators.rsi?.[14])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.rsi)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.rsi)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Stochastic %K
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatNumber(indicators.stochastic?.["%K"])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(
                    signals.stochastic
                  )
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.stochastic)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Stoch RSI %K
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatNumber(indicators.stochasticRsi?.["%K"])}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(
                    signals.stochasticRsi
                  )
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.stochasticRsi)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                MACD
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatNumber(indicators.macd?.macd)}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.macd)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.macd)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                MACD Histogram
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatNumber(indicators.macd?.histogram)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Volatility Section */}
        <div
          className={`rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Volatility
            </h3>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                isDarkMode
                  ? "bg-green-900 text-green-300"
                  : "bg-green-100 text-green-700"
              }`}
            >
              Weight: {weights.volatility || 0}
            </span>
          </div>
          <div className="mb-4 text-center">
            <div
              className={`text-3xl font-bold ${
                isDarkMode ? "text-green-400" : "text-green-700"
              }`}
            >
              {formatNumber(categoryScores.volatility)}
            </div>
            <div
              className={`text-xs mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Category Score
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Bollinger Upper
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.bollingerBands?.upper)}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.boll)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.boll)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Bollinger Lower
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(indicators.bollingerBands?.lower)}
                </div>
                <span
                  className={`text-xs font-medium ${getSignalStyle(signals.boll)
                    .replace("bg-", "text-")
                    .replace("-100", "-700")}`}
                >
                  {getSignalText(signals.boll)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Current Price
              </span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  ${formatPrice(price)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Complete Analysis + Multi Indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Complete Indicator Analysis - Takes 2 columns */}
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
              </div>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isDarkMode
                    ? "bg-blue-900 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                Latest Values
              </span>
            </div>

            {/* Table */}
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
                  {allIndicators.map((indicator, index) => (
                    <tr
                      key={index}
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
                        {indicator.name.includes("SMA") ||
                        indicator.name.includes("EMA") ||
                        indicator.name.includes("Bollinger") ||
                        indicator.name.includes("SAR")
                          ? "$" + formatPrice(indicator.value)
                          : formatNumber(indicator.value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-20 h-7 rounded-full text-xs font-medium ${getSignalStyle(
                            indicator.signal
                          )} ${isDarkMode ? "bg-opacity-20" : ""}`}
                        >
                          {indicator.signal}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Multi Indicator Panel - Takes 1 column */}
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
              <span
                className={`ml-auto px-3 py-1 text-xs font-medium rounded-full ${
                  isDarkMode
                    ? "bg-purple-900 text-purple-300"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                Multi-Signal
              </span>
            </div>

            {/* Signal Display */}
            <div className="text-center mb-6">
              <div
                className={`text-5xl font-black mb-2 ${
                  multiIndicator === "BUY"
                    ? isDarkMode
                      ? "text-green-400"
                      : "text-green-600"
                    : multiIndicator === "SELL"
                    ? isDarkMode
                      ? "text-red-400"
                      : "text-red-600"
                    : isDarkMode
                    ? "text-white"
                    : "text-gray-900"
                }`}
              >
                {multiIndicator || "HOLD"}
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
                    style={{ left: `${getSliderPosition()}%` }}
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
            </div>

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
                Signal Breakdown
              </h4>
              <div className="space-y-2">
                {[
                  { name: "RSI", signal: signals.rsi },
                  { name: "MACD", signal: signals.macd },
                  { name: "STOCHASTIC", signal: signals.stochastic },
                  { name: "STOCHASTIC RSI", signal: signals.stochasticRsi },
                  { name: "SMA", signal: signals.sma },
                  { name: "EMA", signal: signals.ema },
                  { name: "PSAR", signal: signals.psar },
                  { name: "BOLLINGER", signal: signals.boll },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <span
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {item.name}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        item.signal?.toLowerCase() === "buy"
                          ? isDarkMode
                            ? "text-green-400"
                            : "text-green-600"
                          : item.signal?.toLowerCase() === "sell"
                          ? isDarkMode
                            ? "text-red-400"
                            : "text-red-600"
                          : isDarkMode
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
                    >
                      {getSignalText(item.signal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Indicators;
