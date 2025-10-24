import { useState } from "react";
import { useComparison } from "../hooks/useComparison";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";

function Comparison() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2025-10-18");

  const {
    mutate: compare,
    data: comparisonData,
    isLoading,
    error,
  } = useComparison();

  const handleCompare = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end date");
      return;
    }

    compare({
      symbol: selectedSymbol,
      startDate,
      endDate,
    });
  };

  // Helper functions
  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return typeof num === "number" ? num.toFixed(2) : num;
  };

  const formatPercent = (num) => {
    if (!num && num !== 0) return "N/A";
    return `${num.toFixed(2)}%`;
  };

  const getROIColor = (roi) => {
    if (!roi && roi !== 0)
      return isDarkMode ? "text-gray-400" : "text-gray-700";
    if (roi >= 50) return "text-green-600";
    if (roi >= 0) return "text-green-500";
    if (roi >= -50) return "text-red-500";
    return "text-red-600";
  };

  const getROIBadge = (roi) => {
    if (!roi && roi !== 0)
      return isDarkMode
        ? "bg-gray-700 text-gray-300"
        : "bg-gray-100 text-gray-700";
    if (roi >= 50)
      return isDarkMode
        ? "bg-green-900 text-green-300"
        : "bg-green-100 text-green-700";
    if (roi >= 0)
      return isDarkMode
        ? "bg-green-900/50 text-green-400"
        : "bg-green-50 text-green-600";
    if (roi >= -50)
      return isDarkMode
        ? "bg-red-900/50 text-red-400"
        : "bg-red-50 text-red-600";
    return isDarkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Strategy Comparison & Backtesting
        </h1>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Compare trading strategies performance across different technical
          indicators
        </p>
      </div>

      {/* Comparison Form */}
      <div
        className={`rounded-xl shadow-sm border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="p-6">
          <h2
            className={`text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Configure Backtest Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Symbol
              </label>
              <div
                className={`w-full px-4 py-2 border rounded-lg font-medium ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-gray-300"
                    : "bg-gray-100 border-gray-300 text-gray-700"
                }`}
              >
                {selectedSymbol}
              </div>
              <p className="text-xs mt-1 text-gray-500">
                Change symbol from header dropdown
              </p>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "border-gray-300"
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "border-gray-300"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {/* Quick Date Presets */}
            <div className="flex gap-2 flex-wrap">
              <span
                className={`text-sm self-center mr-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Quick Select:
              </span>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setMonth(start.getMonth() - 3);
                  setEndDate(end.toISOString().split("T")[0]);
                  setStartDate(start.toISOString().split("T")[0]);
                }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                3 Months
              </button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setMonth(start.getMonth() - 6);
                  setEndDate(end.toISOString().split("T")[0]);
                  setStartDate(start.toISOString().split("T")[0]);
                }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                6 Months
              </button>
              <button
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setFullYear(start.getFullYear() - 1);
                  setEndDate(end.toISOString().split("T")[0]);
                  setStartDate(start.toISOString().split("T")[0]);
                }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                1 Year
              </button>
              <button
                onClick={() => {
                  setEndDate("2025-10-18");
                  setStartDate("2020-01-01");
                }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Max Range
              </button>
            </div>

            <button
              onClick={handleCompare}
              disabled={isLoading}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Compare Strategies
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className={`border rounded-xl p-4 ${
            isDarkMode
              ? "bg-red-900/20 border-red-800"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              isDarkMode ? "text-red-400" : "text-red-700"
            }`}
          >
            <span className="text-xl">⚠️</span>
            <span className="font-medium">Error: {error.message}</span>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonData?.success && (
        <>
          {/* Overview Stats */}
          <div
            className={`rounded-xl border p-6 ${
              isDarkMode
                ? "bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-800"
                : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2
                  className={`text-2xl font-bold mb-1 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Backtest Results Summary
                </h2>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {comparisonData.symbol} • {comparisonData.timeframe} •{" "}
                  {comparisonData.periodDays} days •{" "}
                  {comparisonData.totalCandles?.toLocaleString()} candles
                </p>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Best Strategy
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {comparisonData.comparison?.bestSingleIndicator || "N/A"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div
                className={`rounded-lg p-4 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Strategies Tested
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {comparisonData.analysis?.totalStrategiesTested || 0}
                </div>
              </div>
              <div
                className={`rounded-lg p-4 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Profitable
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {comparisonData.analysis?.profitableStrategies || 0}
                </div>
              </div>
              <div
                className={`rounded-lg p-4 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Average ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    comparisonData.analysis?.averageROI
                  )}`}
                >
                  {formatPercent(comparisonData.analysis?.averageROI)}
                </div>
              </div>
              <div
                className={`rounded-lg p-4 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Best ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    comparisonData.analysis?.bestROI
                  )}`}
                >
                  {formatPercent(comparisonData.analysis?.bestROI)}
                </div>
              </div>
              <div
                className={`rounded-lg p-4 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Worst ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    comparisonData.analysis?.worstROI
                  )}`}
                >
                  {formatPercent(comparisonData.analysis?.worstROI)}
                </div>
              </div>
            </div>

            {comparisonData.analysis?.recommendation && (
              <div
                className={`mt-4 rounded-lg p-4 border-l-4 border-blue-500 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {comparisonData.analysis.recommendation}
                </div>
              </div>
            )}
          </div>

          {/* Trading Config */}
          <div
            className={`rounded-xl shadow-sm border p-6 ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <h3
              className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              <span>⚙️</span>
              Trading Configuration
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {Object.entries(comparisonData.tradingConfig || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className={`rounded-lg p-3 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-50"
                    }`}
                  >
                    <div
                      className={`text-xs mb-1 capitalize ${
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
                      {typeof value === "number" ? formatNumber(value) : value}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Standard Configuration Results */}
          <div
            className={`rounded-xl shadow-sm border ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`p-6 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <h3
                className={`text-xl font-semibold flex items-center gap-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                <span>📊</span>
                Standard Configuration Results
              </h3>
              <p
                className={`text-sm mt-1 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Performance of each strategy with default trading parameters
              </p>
            </div>
            <div className="p-6">
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
                        Strategy
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        ROI
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Win Rate
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Trades
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Final Balance
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Max Drawdown
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Sharpe Ratio
                      </th>
                      <th
                        className={`text-right py-3 px-4 text-sm font-semibold ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Profit Factor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      comparisonData.comparison?.single || {}
                    ).map(([strategy, data]) => (
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
                            {comparisonData.comparison?.bestSingleIndicator ===
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
                          <span
                            className={`font-bold ${getROIColor(data.roi)}`}
                          >
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
                              data.finalBalance >= 1000
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            ${formatNumber(data.finalBalance)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                          {formatPercent(data.maxDrawdown)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatNumber(data.sharpeRatio)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatNumber(data.profitFactor)}
                        </td>
                      </tr>
                    ))}
                    {/* Multi Strategy Row */}
                    {comparisonData.comparison?.multi && (
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
                                isDarkMode
                                  ? "text-purple-300"
                                  : "text-purple-900"
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
                              Combined
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-bold ${getROIColor(
                              comparisonData.comparison.multi.roi
                            )}`}
                          >
                            {formatPercent(comparisonData.comparison.multi.roi)}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatPercent(
                            comparisonData.comparison.multi.winRate
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {comparisonData.comparison.multi.trades}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-mono text-sm ${
                              comparisonData.comparison.multi.finalBalance >=
                              1000
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            $
                            {formatNumber(
                              comparisonData.comparison.multi.finalBalance
                            )}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatPercent(
                            comparisonData.comparison.multi.maxDrawdown
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatNumber(
                            comparisonData.comparison.multi.sharpeRatio
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-sm ${
                            isDarkMode ? "text-gray-300" : ""
                          }`}
                        >
                          {formatNumber(
                            comparisonData.comparison.multi.profitFactor
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Optimized High ROI Configuration */}
          {comparisonData.comparisonHighROI && (
            <div
              className={`rounded-xl shadow-sm border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div
                className={`p-6 border-b ${
                  isDarkMode
                    ? "bg-gradient-to-r from-green-900/20 to-blue-900/20 border-gray-700"
                    : "bg-gradient-to-r from-green-50 to-blue-50 border-gray-200"
                }`}
              >
                <h3
                  className={`text-xl font-semibold flex items-center gap-2 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  <span>🎯</span>
                  Optimized Configuration - High ROI
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Performance with optimized parameters (
                  {comparisonData.comparisonHighROI.configName})
                </p>
                {/* Optimized Config Details */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(
                    comparisonData.comparisonHighROI.config || {}
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className={`rounded-lg p-2 ${
                        isDarkMode ? "bg-gray-800" : "bg-white"
                      }`}
                    >
                      <div
                        className={`text-xs capitalize ${
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
                  ))}
                </div>
              </div>
              <div className="p-6">
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
                          Strategy
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          ROI
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Win Rate
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Trades
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Final Balance
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Annualized Return
                        </th>
                        <th
                          className={`text-right py-3 px-4 text-sm font-semibold ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Sharpe Ratio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        comparisonData.comparisonHighROI?.single || {}
                      ).map(([strategy, data]) => (
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
                              {comparisonData.comparisonHighROI
                                ?.bestSingleIndicator === strategy && (
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
                            <span
                              className={`font-bold ${getROIColor(data.roi)}`}
                            >
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
                                data.finalBalance >= 1000
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              ${formatNumber(data.finalBalance)}
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
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {formatNumber(data.sharpeRatio)}
                          </td>
                        </tr>
                      ))}
                      {/* Multi Strategy Row */}
                      {comparisonData.comparisonHighROI?.multi && (
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
                                  isDarkMode
                                    ? "text-purple-300"
                                    : "text-purple-900"
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
                                Combined
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-bold ${getROIColor(
                                comparisonData.comparisonHighROI.multi.roi
                              )}`}
                            >
                              {formatPercent(
                                comparisonData.comparisonHighROI.multi.roi
                              )}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {formatPercent(
                              comparisonData.comparisonHighROI.multi.winRate
                            )}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {comparisonData.comparisonHighROI.multi.trades}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-mono text-sm ${
                                comparisonData.comparisonHighROI.multi
                                  .finalBalance >= 1000
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              $
                              {formatNumber(
                                comparisonData.comparisonHighROI.multi
                                  .finalBalance
                              )}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {comparisonData.comparisonHighROI.multi
                              .annualizedReturn
                              ? formatPercent(
                                  comparisonData.comparisonHighROI.multi
                                    .annualizedReturn
                                )
                              : "N/A"}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {formatNumber(
                              comparisonData.comparisonHighROI.multi.sharpeRatio
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Comparison;
