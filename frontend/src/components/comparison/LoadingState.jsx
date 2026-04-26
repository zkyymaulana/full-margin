import { useDarkMode } from "../../contexts/DarkModeContext";
import { FiSearch } from "react-icons/fi";
import { formatDateLabel } from "./utils";

// LoadingState: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function LoadingState({
  isLoading,
  isPending,
  selectedSymbol,
  startDate,
  endDate,
}) {
  const { isDarkMode } = useDarkMode();

  if (!isLoading && !isPending) return null;

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border p-6 md:p-12 ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex flex-col items-center justify-center space-y-4 md:space-y-6">
        {/* Animated Spinner */}
        <div className="relative">
          <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <FiSearch
              className={`text-2xl md:text-3xl ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            />
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center">
          <h3
            className={`text-xl md:text-2xl font-bold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Analyzing Strategies...
          </h3>
          <p
            className={`text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Running backtests for {selectedSymbol}
            <span className="hidden md:inline">
              {" "}
              ({formatDateLabel(startDate)} to {formatDateLabel(endDate)})
            </span>
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="w-full max-w-md space-y-2 md:space-y-3">
          <div
            className={`flex items-center justify-between p-2 md:p-3 rounded-lg ${
              isDarkMode ? "bg-gray-700" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span
                className={`text-xs md:text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Testing 8 single indicators
              </span>
            </div>
            <span className="text-xs text-gray-500">1/3</span>
          </div>

          <div
            className={`flex items-center justify-between p-2 md:p-3 rounded-lg ${
              isDarkMode ? "bg-gray-700" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div
                className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <span
                className={`text-xs md:text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Running multi-indicator backtest
              </span>
            </div>
            <span className="text-xs text-gray-500">2/3</span>
          </div>

          {/* <div
            className={`flex items-center justify-between p-2 md:p-3 rounded-lg ${
              isDarkMode ? "bg-gray-700" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div
                className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
              <span
                className={`text-xs md:text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Calculating voting strategy
              </span>
            </div>
            <span className="text-xs text-gray-500">3/3</span>
          </div> */}
        </div>
      </div>
    </div>
  );
}
