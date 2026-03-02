import { useDarkMode } from "../../../contexts/DarkModeContext";
import { formatPercent, getROIColor } from "../utils";
import { FiAward, FiAlertTriangle } from "react-icons/fi";

export function ResultsSummary({ displayData }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div
      className={`rounded-lg md:rounded-xl border p-4 md:p-6 ${
        isDarkMode
          ? "bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-800"
          : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-0 mb-4">
        <div>
          <h2
            className={`text-xl md:text-2xl font-bold mb-1 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Backtest Results Summary
          </h2>
          <p
            className={`text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {displayData.symbol} • {displayData.timeframe} •{" "}
            {displayData.period?.days || displayData.analysis?.periodDays} days
          </p>
        </div>
        <div className="text-left md:text-right">
          <div
            className={`text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Best Strategy
          </div>
          <div
            className={`text-lg md:text-xl font-bold ${
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

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <div
          className={`rounded-lg p-3 md:p-4 ${
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
            className={`text-lg md:text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {displayData.analysis?.dataPoints?.toLocaleString() || 0}
          </div>
        </div>

        <div
          className={`rounded-lg p-3 md:p-4 ${
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
            className={`text-lg md:text-2xl font-bold ${getROIColor(
              displayData.analysis?.bestSingle?.roi,
              isDarkMode
            )}`}
          >
            {formatPercent(displayData.analysis?.bestSingle?.roi)}
          </div>
          <div
            className={`text-xs mt-1 truncate ${
              isDarkMode ? "text-gray-500" : "text-gray-500"
            }`}
          >
            {displayData.analysis?.bestSingle?.indicator || "N/A"}
          </div>
        </div>

        <div
          className={`rounded-lg p-3 md:p-4 ${
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
            className={`text-lg md:text-2xl font-bold ${getROIColor(
              displayData.comparison?.multi?.roi,
              isDarkMode
            )}`}
          >
            {formatPercent(displayData.comparison?.multi?.roi)}
          </div>
          <div
            className={`text-xs mt-1 ${
              isDarkMode ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Weighted
          </div>
        </div>

        <div
          className={`rounded-lg p-3 md:p-4 ${
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
            className={`text-lg md:text-2xl font-bold ${getROIColor(
              displayData.comparison?.voting?.roi,
              isDarkMode
            )}`}
          >
            {formatPercent(displayData.comparison?.voting?.roi)}
          </div>
          <div
            className={`text-xs mt-1 ${
              isDarkMode ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Majority
          </div>
        </div>

        <div
          className={`rounded-lg p-3 md:p-4 ${
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
            className={`text-lg md:text-2xl font-bold ${
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
          className={`mt-3 md:mt-4 rounded-lg p-3 md:p-4 border-l-4 ${
            displayData.analysis.multiBeatsBestSingle
              ? "border-green-500"
              : "border-yellow-500"
          } ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
        >
          <div className="flex items-start gap-2 md:gap-3">
            <span className="text-xl md:text-2xl">
              {displayData.analysis.multiBeatsBestSingle ? (
                <FiAward
                  className={`${
                    isDarkMode ? "text-yellow-400" : "text-yellow-500"
                  }`}
                />
              ) : (
                <FiAlertTriangle
                  className={`${
                    isDarkMode ? "text-orange-400" : "text-orange-500"
                  }`}
                />
              )}
            </span>

            <div className="flex-1">
              <div
                className={`text-sm md:text-base font-semibold mb-1 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {displayData.analysis.multiBeatsBestSingle
                  ? "Multi-Indicator Strategy Wins!"
                  : "Single Indicator Strategy Performs Better"}
              </div>
              <div
                className={`text-xs md:text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Multi-indicator achieved{" "}
                {formatPercent(displayData.comparison?.multi?.roi)} ROI vs{" "}
                {displayData.analysis.bestSingle?.indicator} at{" "}
                {formatPercent(displayData.analysis.bestSingle?.roi)} ROI
                <span className="hidden md:inline">
                  {" "}
                  (Win Rate:{" "}
                  {formatPercent(
                    displayData.analysis.winRateComparison?.multi
                  )}{" "}
                  vs{" "}
                  {formatPercent(
                    displayData.analysis.winRateComparison?.bestSingle
                  )}
                  )
                </span>
              </div>
              {/* Voting Strategy Comparison */}
              {displayData.comparison?.voting &&
                displayData.analysis.votingComparison && (
                  <div
                    className={`text-xs md:text-sm mt-2 pt-2 border-t ${
                      isDarkMode
                        ? "border-gray-700 text-gray-400"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    Voting strategy achieved{" "}
                    {formatPercent(displayData.comparison.voting.roi)} ROI
                    <span className="hidden md:inline">
                      {" "}
                      compared to Multi-Indicator{" "}
                      {formatPercent(displayData.comparison.multi?.roi)} ROI
                    </span>
                    {displayData.analysis.votingComparison.difference > 0 && (
                      <span className="text-green-600 font-medium">
                        {" "}
                        (+
                        {formatPercent(
                          displayData.analysis.votingComparison.difference
                        )}
                        )
                      </span>
                    )}
                    {displayData.analysis.votingComparison.difference < 0 && (
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
  );
}
