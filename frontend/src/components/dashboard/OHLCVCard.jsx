import { useDarkMode } from "../../contexts/DarkModeContext";
import { formatPrice, formatVolume } from "../../utils/chartConfig";

/**
 * OHLCV Card Component
 * Displays Open, High, Low, Close, Volume data for the latest candle
 */
function OHLCVCard({ latestCandle }) {
  const { isDarkMode } = useDarkMode();

  if (!latestCandle) return null;

  return (
    <div
      className={`mb-4 p-4 rounded-lg border ${
        isDarkMode
          ? "bg-gray-900 border-gray-700"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Open */}
        <div>
          <div
            className={`text-xs mb-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Open
          </div>
          <div
            className={`font-mono text-sm font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {formatPrice(latestCandle.open)}
          </div>
        </div>

        {/* High */}
        <div>
          <div
            className={`text-xs mb-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            High
          </div>
          <div
            className={`font-mono text-sm font-semibold ${
              isDarkMode ? "text-green-400" : "text-green-600"
            }`}
          >
            {formatPrice(latestCandle.high)}
          </div>
        </div>

        {/* Low */}
        <div>
          <div
            className={`text-xs mb-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Low
          </div>
          <div
            className={`font-mono text-sm font-semibold ${
              isDarkMode ? "text-red-400" : "text-red-600"
            }`}
          >
            {formatPrice(latestCandle.low)}
          </div>
        </div>

        {/* Close */}
        <div>
          <div
            className={`text-xs mb-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Close
          </div>
          <div
            className={`font-mono text-sm font-semibold ${
              latestCandle.close >= latestCandle.open
                ? isDarkMode
                  ? "text-green-400"
                  : "text-green-600"
                : isDarkMode
                ? "text-red-400"
                : "text-red-600"
            }`}
          >
            {formatPrice(latestCandle.close)}
          </div>
        </div>

        {/* Volume */}
        <div>
          <div
            className={`text-xs mb-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Volume
          </div>
          <div
            className={`font-mono text-sm font-semibold ${
              isDarkMode ? "text-blue-400" : "text-blue-600"
            }`}
          >
            {formatVolume(latestCandle.volume)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OHLCVCard;
