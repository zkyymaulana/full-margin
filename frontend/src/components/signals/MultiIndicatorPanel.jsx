import { formatNumber } from "../../utils/indicatorParser";

function MultiIndicatorPanel({
  multiSignalData, // ✅ Full object from backend
  categoryScores: categoryScoresFromParent, // ✅ Legacy support (deprecated)
  signalCounts,
  isDarkMode,
}) {
  // ✅ Extract data from backend (NO CALCULATION)
  const {
    signal = "neutral",
    strength = 0,
    finalScore = 0,
    signalLabel = "NEUTRAL",
    categoryScores: categoryScoresFromBackend, // ✅ NEW: From backend
  } = multiSignalData || {};

  // ✅ Use categoryScores from backend (fallback to parent prop for backward compatibility)
  const categoryScores = categoryScoresFromBackend ||
    categoryScoresFromParent || {
      trend: 0,
      momentum: 0,
      volatility: 0,
    };

  // ✅ Normalize signal for display
  const displaySignal = signalLabel || signal.toUpperCase();

  // ✅ Calculate slider position from strength (range: -1 to +1)
  // Backend sends strength as 0.0 to 1.0 (confidence level)
  // For display: BUY = positive, SELL = negative
  const sliderValue =
    signal === "sell" ? -strength : signal === "buy" ? strength : 0;
  const sliderPosition = ((sliderValue + 1) / 2) * 100; // Convert -1..+1 to 0..100%

  return (
    <div
      className={`rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="p-6">
        {/* Header */}
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
                🎯 Weighted Multi-Indicator Signal
              </p>
              <p>
                Menggabungkan 8 indikator teknikal dengan bobot optimal dari
                backtest.
                <br />
                <strong>Threshold = 0:</strong>
                <br />
                • finalScore &gt; 0 → BUY
                <br />
                • finalScore &lt; 0 → SELL
                <br />• finalScore = 0 → NEUTRAL
              </p>
              <p className="mt-2">
                <strong>Strength:</strong> Confidence level (0.0 - 1.0)
                <br />
                <strong>Category Scores:</strong>
                <br />
                • Trend: SMA + EMA + PSAR
                <br />
                • Momentum: RSI + MACD + Stochastic + Stochastic RSI
                <br />• Volatility: Bollinger Bands
              </p>
            </div>
          </div>
        </div>

        {/* Signal Display */}
        <div className="text-center mb-6">
          <div
            className={`text-4xl font-black mb-2 ${
              signal === "buy"
                ? isDarkMode
                  ? "text-green-400"
                  : "text-green-600"
                : signal === "sell"
                ? isDarkMode
                  ? "text-red-400"
                  : "text-red-600"
                : isDarkMode
                ? "text-gray-400"
                : "text-gray-600"
            }`}
          >
            {displaySignal}
          </div>
          <div
            className={`text-sm font-medium mb-4 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Strength: {signal === "sell" && strength > 0 ? "-" : "+"}
            {formatNumber(strength, 2)}
          </div>

          {/* ✅ Signal Counts from Database */}
          {signalCounts && (
            <div className="flex justify-center gap-3 mb-4">
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? "bg-green-900/30 text-green-400"
                    : "bg-green-100 text-green-700"
                }`}
              >
                🟢 {signalCounts.buy}
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? "bg-red-900/30 text-red-400"
                    : "bg-red-100 text-red-700"
                }`}
              >
                🔴 {signalCounts.sell}
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-400"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                ⚪ {signalCounts.neutral}
              </div>
            </div>
          )}

          {/* ✅ SLIDER - Using strength from backend (range: -1 to +1) */}
          <div className="mb-6">
            <div
              className={`flex justify-between text-xs mb-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              <span>SELL</span>
              <span>NEUTRAL</span>
              <span>BUY</span>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-gray-400 to-green-500">
              <div
                className={`absolute w-4 h-4 rounded-full -top-1 transform -translate-x-1/2 transition-all duration-300 shadow-lg ${
                  isDarkMode
                    ? "bg-white border-2 border-gray-700"
                    : "bg-gray-900 border-2 border-white"
                }`}
                style={{ left: `${sliderPosition}%` }}
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

        {/* ✅ CATEGORY SCORES - From Backend (NO CALCULATION) */}
        <div className="space-y-3 mb-6">
          <div
            className={`text-xs font-semibold mb-2 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            CATEGORY BREAKDOWN
          </div>

          {/* Trend - Always show from backend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Trend
              </span>
            </div>
            <span
              className={`text-sm font-bold ${
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
              {categoryScores.trend > 0 ? "+" : ""}
              {formatNumber(categoryScores.trend, 2)}
            </span>
          </div>

          {/* Momentum - Always show from backend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Momentum
              </span>
            </div>
            <span
              className={`text-sm font-bold ${
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
              {categoryScores.momentum > 0 ? "+" : ""}
              {formatNumber(categoryScores.momentum, 2)}
            </span>
          </div>

          {/* Volatility - Always show from backend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💥</span>
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Volatility
              </span>
            </div>
            <span
              className={`text-sm font-bold ${
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
              {categoryScores.volatility > 0 ? "+" : ""}
              {formatNumber(categoryScores.volatility, 2)}
            </span>
          </div>
        </div>

        {/* ✅ TOTAL SCORE - Moved to Bottom */}
        <div
          className={`pt-4 border-t ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-semibold ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              FINAL SCORE
            </span>
            <span
              className={`text-xl font-black ${
                finalScore > 0
                  ? isDarkMode
                    ? "text-green-400"
                    : "text-green-600"
                  : finalScore < 0
                  ? isDarkMode
                    ? "text-red-400"
                    : "text-red-600"
                  : isDarkMode
                  ? "text-gray-500"
                  : "text-gray-400"
              }`}
            >
              {finalScore > 0 ? "+" : ""}
              {formatNumber(finalScore, 2)}
            </span>
          </div>
          <div
            className={`text-xs mt-1 text-right ${
              isDarkMode ? "text-gray-500" : "text-gray-400"
            }`}
          >
            Weighted Score from 8 Indicators
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiIndicatorPanel;
