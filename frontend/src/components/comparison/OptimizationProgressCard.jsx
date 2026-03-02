import { useDarkMode } from "../../contexts/DarkModeContext";
import { FiSettings, FiClock, FiCheckCircle, FiX } from "react-icons/fi";

export function OptimizationProgressCard({
  showEstimateProgress,
  progressData,
  selectedSymbol,
  onClose,
  onCancel, // ✅ NEW: Callback untuk cancel
}) {
  const { isDarkMode } = useDarkMode();

  if (!showEstimateProgress || !progressData) return null;

  const isCompleted = progressData.status === "completed";
  const isRunning = progressData.status === "running";
  const isWaiting = progressData.status === "waiting";
  const isCancelled = progressData.status === "cancelled";

  const formatDateRange = () => {
    if (!progressData.datasetRange) return null;

    const start = new Date(progressData.datasetRange.start);
    const end = new Date(progressData.datasetRange.end);

    const formatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };

    return {
      start: start.toLocaleDateString("en-US", formatOptions),
      end: end.toLocaleDateString("en-US", formatOptions),
    };
  };

  const dateRange = formatDateRange();

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border p-6 ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex flex-col items-center justify-center space-y-2">
        {/* Animated Spinner or Success/Error Icon */}
        <div className="relative">
          {isCompleted ? (
            <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500 rounded-full flex items-center justify-center">
              <FiCheckCircle className="text-4xl md:text-5xl text-white" />
            </div>
          ) : isCancelled ? (
            // ✅ NEW: Cancelled Icon
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500 rounded-full flex items-center justify-center">
              <FiX className="text-4xl md:text-5xl text-white" />
            </div>
          ) : (
            <>
              <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FiSettings
                  className={`text-2xl md:text-3xl ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                />
              </div>
            </>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h3
            className={`text-xl md:text-2xl font-bold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {isCompleted
              ? "Optimization Completed!"
              : isCancelled
              ? "Optimization Cancelled"
              : isWaiting
              ? "Preparing Optimization..."
              : "Optimizing Strategies..."}
          </h3>
          <p
            className={`text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {isCompleted
              ? `Successfully optimized ${selectedSymbol}`
              : isCancelled
              ? progressData.reason === "server_restart"
                ? "Server is restarting. Please try again."
                : progressData.message || "Optimization was cancelled"
              : `Running optimization for ${selectedSymbol}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md space-y-4">
          <div
            className={`rounded-lg p-3 ${
              isDarkMode ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            {/* Dataset Info - Only show if data is available */}
            {progressData.dataPoints && (
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Combinations:
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {(390625).toLocaleString()} (5^8)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Dataset Size:
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {progressData.dataPoints.toLocaleString()} candles
                  </span>
                </div>
                {dateRange && (
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Date Range:
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {dateRange.start} → {dateRange.end}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Progress Info - Only show if not waiting */}
            {!isWaiting && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Candles Processed
                  </div>
                  <div
                    className={`text-xs font-mono ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {(
                      progressData.current ||
                      progressData.tested ||
                      0
                    ).toLocaleString()}
                    /{(progressData.total || 0).toLocaleString()} (
                    {progressData.percentage || 0}%)
                  </div>
                </div>
                <div
                  className={`h-2 rounded-full overflow-hidden ${
                    isDarkMode ? "bg-gray-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`h-full transition-all duration-500 ${
                      isCompleted
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : "bg-gradient-to-r from-purple-500 to-blue-500"
                    }`}
                    style={{
                      width: `${Math.max(progressData.percentage || 0, 5)}%`,
                    }}
                  ></div>
                </div>
              </>
            )}

            {/* Running State Info */}
            {isRunning && (
              <div className="mt-2 flex items-center justify-between">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Best ROI:{" "}
                  <span className="font-bold text-green-600">
                    {progressData.bestROI}%
                  </span>
                </div>
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Estimated:{" "}
                  <span className="font-bold">{progressData.etaFormatted}</span>
                </div>
              </div>
            )}

            {/* Waiting State Info */}
            {isWaiting && (
              <div className="mt-2 text-center">
                <div
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {progressData.etaFormatted}
                </div>
              </div>
            )}

            {/* Completed State Info */}
            {isCompleted && (
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-medium ${
                    isDarkMode ? "text-green-400" : "text-green-600"
                  }`}
                >
                  Tested {progressData.total?.toLocaleString()} combinations on{" "}
                  {progressData.dataPoints?.toLocaleString()} candles!
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Best ROI:{" "}
                  <span className="font-bold text-green-600">
                    {progressData.bestROI}%
                  </span>
                </div>
              </div>
            )}

            {/* Cancelled State Info */}
            {isCancelled && (
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-medium ${
                    isDarkMode ? "text-red-400" : "text-red-600"
                  }`}
                >
                  {progressData.reason === "server_restart"
                    ? "Server restarted during optimization"
                    : "Optimization cancelled by user"}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Cancel Button - Only show when running */}
            {isRunning && onCancel && (
              <button
                onClick={onCancel}
                className={`hover:cursor-pointer flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? "bg-red-900 hover:bg-red-800 text-red-300"
                    : "bg-red-100 hover:bg-red-200 text-red-700"
                }`}
              >
                Cancel
              </button>
            )}

            {/* Close Button - Show when completed or cancelled */}
            {(isCompleted || isCancelled) && onClose && (
              <button
                onClick={onClose}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                }`}
              >
                <FiX className="text-lg" />
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
