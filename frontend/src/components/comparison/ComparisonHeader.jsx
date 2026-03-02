import { useDarkMode } from "../../contexts/DarkModeContext";

export function ComparisonHeader() {
  const { isDarkMode } = useDarkMode();

  return (
    <div>
      <h1
        className={`text-2xl md:text-3xl font-bold ${
          isDarkMode ? "text-white" : "text-gray-900"
        }`}
      >
        Strategy Comparison & Backtesting
      </h1>
      <p
        className={`mt-1 text-sm md:text-base ${
          isDarkMode ? "text-gray-400" : "text-gray-600"
        }`}
      >
        Compare trading strategies performance across different technical
        indicators
      </p>
    </div>
  );
}
