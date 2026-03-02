import { useDarkMode } from "../../contexts/DarkModeContext";
import { FiSettings, FiSearch } from "react-icons/fi";

export function ActionButtons({
  handleOptimization,
  handleCompare,
  isOptimizationRunning,
  isLoading,
  isPending,
}) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
      {/* Optimization Now Button */}
      <button
        onClick={handleOptimization}
        disabled={isOptimizationRunning}
        className={`w-full md:w-auto py-2 px-4 md:px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 hover:cursor-pointer ${
          isDarkMode
            ? "bg-purple-600 hover:bg-purple-700 text-white"
            : "bg-purple-500 hover:bg-purple-600 text-white"
        }`}
      >
        {isOptimizationRunning ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Optimizing...</span>
          </>
        ) : (
          <>
            <FiSettings className="text-base md:text-lg text-white" />
            <span className="text-sm">Optimization Now</span>
          </>
        )}
      </button>

      {/* Compare Strategies Button */}
      <button
        onClick={handleCompare}
        disabled={isLoading || isPending}
        className={`w-full md:w-auto py-2 px-4 md:px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 hover:cursor-pointer ${
          isDarkMode
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {isLoading || isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Analyzing...</span>
          </>
        ) : (
          <>
            <FiSearch className="text-base md:text-lg text-white" />
            <span className="text-sm">Compare Strategies</span>
          </>
        )}
      </button>
    </div>
  );
}
