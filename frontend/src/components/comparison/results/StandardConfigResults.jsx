import { useDarkMode } from "../../../contexts/DarkModeContext";
import {
  formatPercent,
  formatCurrency,
  formatRatio,
  getROIColor,
} from "../utils";
import { FiBarChart2 } from "react-icons/fi";

// StandardConfigResults: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function StandardConfigResults({ displayData }) {
  const { isDarkMode } = useDarkMode();

  if (!displayData.comparison) return null;

  const bestStrategy = displayData.bestStrategy?.name;

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div
        className={`p-4 md:p-6 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <h3
          className={`text-base md:text-xl font-semibold flex items-center gap-2 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          <FiBarChart2
            className={`text-lg md:text-2xl ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          />
          Standard Configuration Results
        </h3>
        <p
          className={`text-xs md:text-sm mt-1 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Performance of each strategy with default parameters
        </p>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {Object.entries(displayData.comparison?.single || {}).map(
          ([strategy, data]) => {
            const isBestSingle =
              displayData.analysis?.bestSingle?.indicator === strategy;
            const isOverallWinner = bestStrategy === "single" && isBestSingle;

            return (
              <div
                key={strategy}
                className={`p-4 border-b ${
                  isDarkMode
                    ? "border-gray-700 hover:bg-gray-700"
                    : "border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start mb-3">
                  <div>
                    <div
                      className={`font-semibold text-sm ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {strategy}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {isBestSingle && (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            isDarkMode
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          Best Single
                        </span>
                      )}
                      {isOverallWinner && (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            isDarkMode
                              ? "bg-green-900 text-green-300"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      ROI
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold ${getROIColor(
                        data.roi,
                      )}`}
                    >
                      {formatPercent(data.roi)}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Win Rate
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {formatPercent(data.winRate)}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Trades
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {data.trades}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Final Capital
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold ${
                        data.finalCapital >= 10000
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(data.finalCapital)}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Max Drawdown
                    </div>
                    <div className="text-sm font-mono font-semibold text-red-600">
                      {formatPercent(data.maxDrawdown)}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Sharpe
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold ${
                        data.sharpeRatio > 1
                          ? "text-green-600"
                          : data.sharpeRatio > 0
                            ? isDarkMode
                              ? "text-gray-300"
                              : "text-gray-700"
                            : "text-red-600"
                      }`}
                    >
                      {formatRatio(data.sharpeRatio)}
                    </div>
                  </div>
                </div>
              </div>
            );
          },
        )}

        {/* Multi Strategy Card */}
        {displayData.comparison?.multi && (
          <div
            className={`p-4 border-b ${
              isDarkMode
                ? "bg-purple-900/20 border-purple-800"
                : "bg-purple-50 border-purple-200"
            }`}
          >
            <div className="flex items-start mb-3">
              <div>
                <div
                  className={`font-bold text-sm ${
                    isDarkMode ? "text-purple-300" : "text-purple-900"
                  }`}
                >
                  Multi-Indicator
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      isDarkMode
                        ? "bg-purple-900 text-purple-300"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    Optimized
                  </span>
                  {bestStrategy === "multi" && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        isDarkMode
                          ? "bg-green-900 text-green-300"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      Winner
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  ROI
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${getROIColor(
                    displayData.comparison.multi.roi,
                  )}`}
                >
                  {formatPercent(displayData.comparison.multi.roi)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Win Rate
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatPercent(displayData.comparison.multi.winRate)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Trades
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {displayData.comparison.multi.trades}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Final Capital
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    displayData.comparison.multi.finalCapital >= 10000
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(displayData.comparison.multi.finalCapital)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Max Drawdown
                </div>
                <div className="text-sm font-mono font-semibold text-red-600">
                  {formatPercent(displayData.comparison.multi.maxDrawdown)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Sharpe
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    displayData.comparison.multi.sharpeRatio > 1
                      ? "text-green-600"
                      : displayData.comparison.multi.sharpeRatio > 0
                        ? isDarkMode
                          ? "text-gray-300"
                          : "text-gray-700"
                        : "text-red-600"
                  }`}
                >
                  {formatRatio(displayData.comparison.multi.sharpeRatio)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voting Strategy Card */}
        {displayData.comparison?.voting && (
          <div
            className={`p-4 ${
              isDarkMode
                ? "bg-indigo-900/20 border-indigo-800"
                : "bg-indigo-50 border-indigo-200"
            }`}
          >
            <div className="flex items-start mb-3">
              <div>
                <div
                  className={`font-bold text-sm ${
                    isDarkMode ? "text-indigo-400" : "text-indigo-900"
                  }`}
                >
                  Voting Strategy
                </div>
                {bestStrategy === "voting" && (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium mt-1 ${
                      isDarkMode
                        ? "bg-green-900 text-green-300"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    Winner
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  ROI
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${getROIColor(
                    displayData.comparison.voting.roi,
                  )}`}
                >
                  {formatPercent(displayData.comparison.voting.roi)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Win Rate
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {formatPercent(displayData.comparison.voting.winRate)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Trades
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {displayData.comparison.voting.trades}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Final Capital
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    displayData.comparison.voting.finalCapital >= 10000
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(displayData.comparison.voting.finalCapital)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Max Drawdown
                </div>
                <div className="text-sm font-mono font-semibold text-red-600">
                  {formatPercent(displayData.comparison.voting.maxDrawdown)}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Sharpe
                </div>
                <div
                  className={`text-sm font-mono font-semibold ${
                    displayData.comparison.voting.sharpeRatio > 1
                      ? "text-green-600"
                      : displayData.comparison.voting.sharpeRatio > 0
                        ? isDarkMode
                          ? "text-gray-300"
                          : "text-gray-700"
                        : "text-red-600"
                  }`}
                >
                  {formatRatio(displayData.comparison.voting.sharpeRatio)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block p-6">
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
                  Max Drawdown
                </th>
                <th
                  className={`text-right py-3 px-4 text-sm font-semibold whitespace-nowrap ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Sharpe Ratio
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(displayData.comparison?.single || {}).map(
                ([strategy, data]) => {
                  const isBestSingle =
                    displayData.analysis?.bestSingle?.indicator === strategy;
                  const isOverallWinner =
                    bestStrategy === "single" && isBestSingle;

                  return (
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
                          {isBestSingle && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                isDarkMode
                                  ? "bg-yellow-900 text-yellow-300"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              Best Single
                            </span>
                          )}
                          {isOverallWinner && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                isDarkMode
                                  ? "bg-green-900 text-green-300"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              Winner
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
                      <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                        {formatPercent(data.maxDrawdown)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-sm ${
                          data.sharpeRatio > 1
                            ? "text-green-600"
                            : data.sharpeRatio > 0
                              ? isDarkMode
                                ? "text-gray-300"
                                : "text-gray-700"
                              : "text-red-600"
                        }`}
                      >
                        {formatRatio(data.sharpeRatio)}
                      </td>
                    </tr>
                  );
                },
              )}
              {/* Multi Strategy Row */}
              {displayData.comparison?.multi && (
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
                      {bestStrategy === "multi" && (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            isDarkMode
                              ? "bg-green-900 text-green-300"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-bold ${getROIColor(
                        displayData.comparison.multi.roi,
                      )}`}
                    >
                      {formatPercent(displayData.comparison.multi.roi)}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {formatPercent(displayData.comparison.multi.winRate)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {displayData.comparison.multi.trades}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono text-sm ${
                        displayData.comparison.multi.finalCapital >= 10000
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        displayData.comparison.multi.finalCapital,
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                    {formatPercent(displayData.comparison.multi.maxDrawdown)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      displayData.comparison.multi.sharpeRatio > 1
                        ? "text-green-600"
                        : displayData.comparison.multi.sharpeRatio > 0
                          ? isDarkMode
                            ? "text-gray-300"
                            : "text-gray-700"
                          : "text-red-600"
                    }`}
                  >
                    {formatRatio(displayData.comparison.multi.sharpeRatio)}
                  </td>
                </tr>
              )}
              {/* Voting Strategy Row */}
              {displayData.comparison?.voting && (
                <tr
                  className={`border-b font-medium ${
                    isDarkMode
                      ? "bg-indigo-900/30 border-indigo-800"
                      : "bg-indigo-50 border-indigo-200"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          isDarkMode ? "text-indigo-400" : "text-indigo-900"
                        }`}
                      >
                        Voting Strategy
                      </span>
                      {bestStrategy === "voting" && (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            isDarkMode
                              ? "bg-green-900 text-green-300"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-bold ${getROIColor(
                        displayData.comparison.voting.roi,
                      )}`}
                    >
                      {formatPercent(displayData.comparison.voting.roi)}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {formatPercent(displayData.comparison.voting.winRate)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      isDarkMode ? "text-gray-300" : ""
                    }`}
                  >
                    {displayData.comparison.voting.trades}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono text-sm ${
                        displayData.comparison.voting.finalCapital >= 10000
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        displayData.comparison.voting.finalCapital,
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                    {formatPercent(displayData.comparison.voting.maxDrawdown)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-sm ${
                      displayData.comparison.voting.sharpeRatio > 1
                        ? "text-green-600"
                        : displayData.comparison.voting.sharpeRatio > 0
                          ? isDarkMode
                            ? "text-gray-300"
                            : "text-gray-700"
                          : "text-red-600"
                    }`}
                  >
                    {formatRatio(displayData.comparison.voting.sharpeRatio)}
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
