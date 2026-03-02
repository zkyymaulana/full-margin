import { useDarkMode } from "../../../contexts/DarkModeContext";
import {
  formatPercent,
  formatCurrency,
  formatNumber,
  getROIColor,
} from "../utils";

export function OptimizedHighROIResults({ displayData }) {
  const { isDarkMode } = useDarkMode();

  if (!displayData.comparisonHighROI) return null;

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div
        className={`p-4 md:p-6 border-b ${
          isDarkMode
            ? "bg-gradient-to-r from-green-900/20 to-blue-900/20 border-gray-700"
            : "bg-gradient-to-r from-green-50 to-blue-50 border-gray-200"
        }`}
      >
        <h3
          className={`text-base md:text-xl font-semibold flex items-center gap-2 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          <span>🎯</span>
          Optimized Configuration - High ROI
        </h3>
        <p
          className={`text-xs md:text-sm mt-1 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Performance with optimized parameters
          <span className="hidden md:inline">
            {" "}
            ({displayData.comparisonHighROI.configName})
          </span>
        </p>
        {/* Optimized Config Details */}
        <div className="mt-3 md:mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
          {Object.entries(displayData.comparisonHighROI.config || {}).map(
            ([key, value]) => (
              <div
                key={key}
                className={`rounded-lg p-2 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs capitalize truncate ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </div>
                <div
                  className={`text-sm font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {typeof value === "boolean"
                    ? value
                      ? "✓"
                      : "✗"
                    : typeof value === "number"
                    ? formatNumber(value)
                    : value}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Desktop Table View for High ROI */}
      <div className="p-4 md:p-6">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full table-auto">
            <thead>
              <tr
                className={`border-b ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <th
                  className={`text-left py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Strategy
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  ROI
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Win Rate
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Trades
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Final Capital
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Annualized Return
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(displayData.comparisonHighROI?.single || {}).map(
                ([strategy, data]) => (
                  <tr
                    key={strategy}
                    className={`border-b transition-colors ${
                      isDarkMode
                        ? "border-gray-700 hover:bg-gray-700"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {strategy}
                        </span>
                        {displayData.comparisonHighROI?.bestSingleIndicator ===
                          strategy && (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              isDarkMode
                                ? "bg-yellow-900 text-yellow-300"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            Best
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${getROIColor(data.roi)}`}>
                        {formatPercent(data.roi)}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-sm ${
                        isDarkMode ? "text-gray-300" : ""
                      }`}
                    >
                      {formatPercent(data.winRate)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-sm ${
                        isDarkMode ? "text-gray-300" : ""
                      }`}
                    >
                      {data.trades}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono text-sm ${
                          data.finalCapital >= 10000
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(data.finalCapital)}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-sm ${
                        isDarkMode ? "text-gray-300" : ""
                      }`}
                    >
                      {data.annualizedReturn
                        ? formatPercent(data.annualizedReturn)
                        : "N/A"}
                    </td>
                  </tr>
                )
              )}
              {/* Multi Strategy Row */}
              {displayData.comparisonHighROI?.multi && (
                <tr
                  className={`border-b font-medium ${
                    isDarkMode
                      ? "bg-purple-900/30 border-purple-800"
                      : "bg-purple-50 border-purple-200"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          isDarkMode ? "text-purple-300" : "text-purple-900"
                        }`}
                      >
                        Multi-Indicator
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          isDarkMode
                            ? "bg-purple-900 text-purple-300"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        Optimized
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-bold ${getROIColor(
                        displayData.comparisonHighROI.multi.roi
                      )}`}
                    >
                      {formatPercent(displayData.comparisonHighROI.multi.roi)}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {formatPercent(displayData.comparisonHighROI.multi.winRate)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {displayData.comparisonHighROI.multi.trades}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono text-sm ${
                        displayData.comparisonHighROI.multi.finalCapital >=
                        10000
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        displayData.comparisonHighROI.multi.finalCapital
                      )}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {displayData.comparisonHighROI.multi.annualizedReturn
                      ? formatPercent(
                          displayData.comparisonHighROI.multi.annualizedReturn
                        )
                      : "N/A"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
