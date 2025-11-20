import { useDarkMode } from "../../contexts/DarkModeContext";
import {
  overlayIndicators,
  oscillatorIndicators,
} from "../../utils/chartConfig";

/**
 * Indicator Toggle Panel Component
 * Allows users to toggle technical indicators on/off
 */
function IndicatorTogglePanel({ activeIndicators, onToggle }) {
  const { isDarkMode } = useDarkMode();
  const availableIndicators = [...overlayIndicators, ...oscillatorIndicators];

  return (
    <div className="card">
      <div className={`card-body ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <span className="text-lg">📊</span>
          </div>
          <div>
            <h4
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Technical Indicators
            </h4>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Toggle Panel - 8 Indicators Available
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {availableIndicators.map((indicator) => (
            <button
              key={indicator.id}
              onClick={() => onToggle(indicator.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeIndicators.includes(indicator.id)
                  ? isDarkMode
                    ? "bg-blue-900 text-blue-300 border-2 border-blue-700 shadow-sm"
                    : "bg-blue-100 text-blue-600 border-2 border-blue-300 shadow-sm"
                  : isDarkMode
                  ? "bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: indicator.color }}
                ></div>
                <span className="truncate">{indicator.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default IndicatorTogglePanel;
