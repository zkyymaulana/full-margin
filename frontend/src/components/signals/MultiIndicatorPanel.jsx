import { formatNumber, getIndicatorSignal } from "../../utils/indicatorParser";

function MultiIndicatorPanel({
  multiSignal,
  totalScore,
  categoryScores,
  activeCategories,
  parsedIndicators,
  isDarkMode,
}) {
  return (
    <div
      className={`rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
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
              <p className="font-semibold mb-1">🎯 Sinyal Multi-Indikator</p>
              <p>
                Menggabungkan 8 indikator utama dengan bobot optimal dari hasil
                backtest. Score dihitung berdasarkan:
                <br />
                <strong>BUY:</strong> Score &gt; 0.3
                <br />
                <strong>HOLD:</strong> Score -0.3 hingga 0.3
                <br />
                <strong>SELL:</strong> Score &lt; -0.3
              </p>
              <p className="mt-2">
                <strong>Kategori Score:</strong>
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
                  ? "bg-linear-to-r from-red-500 via-gray-600 to-green-500"
                  : "bg-linear-to-r from-red-500 via-gray-300 to-green-500"
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
        <div className="space-y-3">
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
      </div>
    </div>
  );
}

export default MultiIndicatorPanel;
