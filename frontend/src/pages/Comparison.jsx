import { useState, useEffect } from "react";
import { useComparison } from "../hooks/useComparison";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useQueryClient } from "@tanstack/react-query";

function Comparison() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2025-10-18");

  const {
    mutate: compare,
    data: comparisonData,
    isLoading,
    isPending,
    error,
  } = useComparison();

  // 🔍 DEBUG: Log loading state
  useEffect(() => {
    console.log("🔄 Loading State:", { isLoading, isPending });
  }, [isLoading, isPending]);

  // ✅ Load cached comparison result for current symbol
  const cachedData = queryClient.getQueryData(["comparison", selectedSymbol]);

  // ✅ Save to cache when comparison completes
  useEffect(() => {
    if (comparisonData?.success) {
      queryClient.setQueryData(["comparison", selectedSymbol], comparisonData, {
        // Cache for 30 minutes
        cacheTime: 30 * 60 * 1000,
      });
    }
  }, [comparisonData, selectedSymbol, queryClient]);

  // ✅ Use cached data if available, otherwise use fresh data
  const displayData = comparisonData || cachedData;

  // 🔍 DEBUG: Log bestStrategy untuk debugging
  useEffect(() => {
    if (displayData?.comparison?.bestStrategy) {
      console.log("🏆 Best Strategy:", displayData.comparison.bestStrategy);
      console.log("📊 Comparison Data:", {
        single: displayData.analysis?.bestSingle,
        multi: displayData.comparison?.multi?.roi,
        voting: displayData.comparison?.voting?.roi,
      });
    }
  }, [displayData]);

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

  // Format for ROI, Win Rate, Max Drawdown - add % suffix
  const formatPercent = (num) => {
    if (!num && num !== 0) return "N/A";
    return `${num.toFixed(2)}%`;
  };

  // Format for Sharpe/Sortino Ratio - no % suffix
  const formatRatio = (num) => {
    if (!num && num !== 0) return "N/A";
    return num.toFixed(2);
  };

  const formatCurrency = (num) => {
    if (!num && num !== 0) return "N/A";
    return `$${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getROIColor = (roi) => {
    if (!roi && roi !== 0)
      return isDarkMode ? "text-gray-400" : "text-gray-700";
    if (roi >= 50) return "text-green-600";
    if (roi >= 0) return "text-green-500";
    if (roi >= -50) return "text-red-500";
    return "text-red-600";
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
                className={`px-3 py-1 text-xs rounded-lg transition-colors hover:cursor-pointer ${
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
                className={`px-3 py-1 text-xs rounded-lg transition-colors hover:cursor-pointer ${
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
                className={`px-3 py-1 text-xs rounded-lg transition-colors hover:cursor-pointer ${
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
                className={`px-3 py-1 text-xs rounded-lg transition-colors hover:cursor-pointer ${
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
              disabled={isLoading || isPending}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 hover:cursor-pointer"
            >
              {isLoading || isPending ? (
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
      {error && !(isLoading || isPending) && (
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

      {/* Loading State Overlay */}
      {(isLoading || isPending) && (
        <div
          className={`rounded-xl shadow-sm border p-12 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Animated Spinner */}
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">🔍</span>
              </div>
            </div>

            {/* Loading Text */}
            <div className="text-center">
              <h3
                className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Analyzing Strategies...
              </h3>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Running backtests for {selectedSymbol} ({startDate} to {endDate}
                )
              </p>
            </div>

            {/* Progress Indicators */}
            <div className="w-full max-w-md space-y-3">
              <div
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Testing 8 single indicators
                  </span>
                </div>
                <span className="text-xs text-gray-500">Step 1/3</span>
              </div>

              <div
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Running multi-indicator backtest
                  </span>
                </div>
                <span className="text-xs text-gray-500">Step 2/3</span>
              </div>

              <div
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Calculating voting strategy
                  </span>
                </div>
                <span className="text-xs text-gray-500">Step 3/3</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {displayData?.success && !(isLoading || isPending) && (
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
                  {displayData.symbol} • {displayData.timeframe} •{" "}
                  {displayData.period?.days || displayData.analysis?.periodDays}{" "}
                  days
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
                <div
                  className={`text-xl font-bold ${
                    displayData.comparison?.bestStrategy === "multi"
                      ? "text-purple-600"
                      : displayData.comparison?.bestStrategy === "voting"
                      ? isDarkMode
                        ? "text-indigo-400"
                        : "text-indigo-600"
                      : "text-blue-600"
                  }`}
                >
                  {displayData.comparison?.bestStrategy === "multi"
                    ? "Multi-Indicator"
                    : displayData.comparison?.bestStrategy === "voting"
                    ? "Voting Strategy"
                    : displayData.analysis?.bestSingle?.indicator || "N/A"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Card 1: Total Candles */}
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
                  Total Candles
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {displayData.analysis?.dataPoints?.toLocaleString() || 0}
                </div>
              </div>

              {/* Card 2: Best Single ROI */}
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
                  Best Single ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    displayData.analysis?.bestSingle?.roi
                  )}`}
                >
                  {formatPercent(displayData.analysis?.bestSingle?.roi)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  {displayData.analysis?.bestSingle?.indicator || "N/A"}
                </div>
              </div>

              {/* Card 3: Multi ROI */}
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
                  Multi ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    displayData.comparison?.multi?.roi
                  )}`}
                >
                  {formatPercent(displayData.comparison?.multi?.roi)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Weighted Strategy
                </div>
              </div>

              {/* Card 4: Voting ROI */}
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
                  Voting ROI
                </div>
                <div
                  className={`text-2xl font-bold ${getROIColor(
                    displayData.comparison?.voting?.roi
                  )}`}
                >
                  {formatPercent(displayData.comparison?.voting?.roi)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Majority Vote
                </div>
              </div>

              {/* Card 5: ROI Difference (Multi vs Best Single) */}
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
                  ROI Difference
                </div>
                <div
                  className={`text-2xl font-bold ${
                    displayData.analysis?.roiDifference > 0
                      ? "text-green-600"
                      : displayData.analysis?.roiDifference < 0
                      ? "text-red-600"
                      : isDarkMode
                      ? "text-gray-400"
                      : "text-gray-500"
                  }`}
                >
                  {displayData.analysis?.roiDifference > 0 ? "+" : ""}
                  {formatPercent(displayData.analysis?.roiDifference)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Multi vs Single
                </div>
              </div>
            </div>

            {/* Analysis Info */}
            {displayData.analysis && (
              <div
                className={`mt-4 rounded-lg p-4 border-l-4 ${
                  displayData.analysis.multiBeatsBestSingle
                    ? "border-green-500"
                    : "border-yellow-500"
                } ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {displayData.analysis.multiBeatsBestSingle ? "🏆" : "⚠️"}
                  </span>
                  <div className="flex-1">
                    <div
                      className={`font-semibold mb-1 ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {displayData.analysis.multiBeatsBestSingle
                        ? "Multi-Indicator Strategy Wins!"
                        : "Single Indicator Strategy Performs Better"}
                    </div>
                    <div
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Multi-indicator achieved{" "}
                      {formatPercent(displayData.comparison?.multi?.roi)} ROI vs{" "}
                      {displayData.analysis.bestSingle?.indicator} at{" "}
                      {formatPercent(displayData.analysis.bestSingle?.roi)} ROI
                      (Win Rate:{" "}
                      {formatPercent(
                        displayData.analysis.winRateComparison?.multi
                      )}{" "}
                      vs{" "}
                      {formatPercent(
                        displayData.analysis.winRateComparison?.bestSingle
                      )}
                      )
                    </div>
                    {/* Voting Strategy Comparison */}
                    {displayData.comparison?.voting &&
                      displayData.analysis.votingComparison && (
                        <div
                          className={`text-sm mt-2 pt-2 border-t ${
                            isDarkMode
                              ? "border-gray-700 text-gray-400"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          Voting strategy achieved{" "}
                          {formatPercent(displayData.comparison.voting.roi)} ROI
                          compared to Multi-Indicator{" "}
                          {formatPercent(displayData.comparison.multi?.roi)} ROI
                          {displayData.analysis.votingComparison.difference >
                            0 && (
                            <span className="text-green-600 font-medium">
                              {" "}
                              (+
                              {formatPercent(
                                displayData.analysis.votingComparison.difference
                              )}
                              )
                            </span>
                          )}
                          {displayData.analysis.votingComparison.difference <
                            0 && (
                            <span className="text-red-600 font-medium">
                              {" "}
                              (
                              {formatPercent(
                                displayData.analysis.votingComparison.difference
                              )}
                              )
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Best Weights Section */}
          {displayData.bestWeights && (
            <div
              className={`rounded-xl shadow-sm border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className={`text-lg font-semibold flex items-center gap-2 ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    <span>⚖️</span>
                    Optimized Indicator Weights
                  </h3>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      displayData.weightSource === "database"
                        ? isDarkMode
                          ? "bg-green-900 text-green-300"
                          : "bg-green-100 text-green-700"
                        : isDarkMode
                        ? "bg-blue-900 text-blue-300"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    Source: {displayData.weightSource || "calculated"}
                  </span>
                </div>
                <p
                  className={`text-sm mb-4 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  These weights determine the influence of each indicator in the
                  multi-strategy
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(displayData.bestWeights).map(
                    ([indicator, weight]) => (
                      <div
                        key={indicator}
                        className={`rounded-lg p-4 border ${
                          weight > 0
                            ? isDarkMode
                              ? "bg-blue-900/20 border-blue-700"
                              : "bg-blue-50 border-blue-200"
                            : isDarkMode
                            ? "bg-gray-700 border-gray-600"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div
                          className={`text-sm font-medium mb-1 ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          {indicator}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`text-2xl font-bold ${
                              weight > 0
                                ? isDarkMode
                                  ? "text-blue-400"
                                  : "text-blue-600"
                                : isDarkMode
                                ? "text-gray-500"
                                : "text-gray-400"
                            }`}
                          >
                            {weight}
                          </div>
                          {weight > 0 && (
                            <div className="flex-1">
                              <div
                                className={`h-2 rounded-full ${
                                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                }`}
                              >
                                <div
                                  className="h-2 rounded-full bg-blue-500"
                                  style={{
                                    width: `${
                                      (weight /
                                        Math.max(
                                          ...Object.values(
                                            displayData.bestWeights
                                          )
                                        )) *
                                      100
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

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
                        // Check if this single indicator is the best strategy
                        const isBestSingle =
                          displayData.analysis?.bestSingle?.indicator ===
                          strategy;
                        const isOverallWinner =
                          displayData.comparison?.bestStrategy === "single" &&
                          isBestSingle;

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
                      }
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
                              Optimized
                            </span>
                            {displayData.comparison?.bestStrategy ===
                              "multi" && (
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
                              displayData.comparison.multi.roi
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
                              displayData.comparison.multi.finalCapital
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                          {formatPercent(
                            displayData.comparison.multi.maxDrawdown
                          )}
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
                          {formatRatio(
                            displayData.comparison.multi.sharpeRatio
                          )}
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
                                isDarkMode
                                  ? "text-indigo-400"
                                  : "text-indigo-900"
                              }`}
                            >
                              Voting Strategy
                            </span>
                            {displayData.comparison?.bestStrategy ===
                              "voting" && (
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
                              displayData.comparison.voting.roi
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
                              displayData.comparison.voting.finalCapital >=
                              10000
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(
                              displayData.comparison.voting.finalCapital
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-red-600">
                          {formatPercent(
                            displayData.comparison.voting.maxDrawdown
                          )}
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
                          {formatRatio(
                            displayData.comparison.voting.sharpeRatio
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
          {displayData.comparisonHighROI && (
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
                  {displayData.comparisonHighROI.configName})
                </p>
                {/* Optimized Config Details */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(
                    displayData.comparisonHighROI.config || {}
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
                      {Object.entries(
                        displayData.comparisonHighROI?.single || {}
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
                              {displayData.comparisonHighROI
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
                      ))}
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
                                Optimized
                              </span>
                              {displayData.comparison?.bestStrategy ===
                                "multi" && (
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
                                displayData.comparisonHighROI.multi.roi
                              )}`}
                            >
                              {formatPercent(
                                displayData.comparisonHighROI.multi.roi
                              )}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono text-sm ${
                              isDarkMode ? "text-gray-300" : ""
                            }`}
                          >
                            {formatPercent(
                              displayData.comparisonHighROI.multi.winRate
                            )}
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
                                displayData.comparisonHighROI.multi
                                  .finalCapital >= 10000
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
                            {displayData.comparisonHighROI.multi
                              .annualizedReturn
                              ? formatPercent(
                                  displayData.comparisonHighROI.multi
                                    .annualizedReturn
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
          )}
        </>
      )}
    </div>
  );
}

export default Comparison;
