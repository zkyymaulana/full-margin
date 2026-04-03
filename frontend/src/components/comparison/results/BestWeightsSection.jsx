import { useDarkMode } from "../../../contexts/DarkModeContext";

// BestWeightsSection: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function BestWeightsSection({ displayData }) {
  const { isDarkMode } = useDarkMode();

  if (!displayData.bestWeights) return null;

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3 md:mb-4">
          <h3
            className={`text-base md:text-lg font-semibold flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Optimized Indicator Weights
          </h3>
          <span
            className={`px-2 md:px-3 py-1 text-xs font-medium rounded-full self-start md:self-auto ${
              displayData.weightSource === "database"
                ? isDarkMode
                  ? "bg-green-900 text-green-300"
                  : "bg-green-100 text-green-700"
                : isDarkMode
                ? "bg-blue-900 text-blue-300"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {displayData.weightSource || "calculated"}
          </span>
        </div>
        <p
          className={`text-xs md:text-sm mb-3 md:mb-4 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          These weights determine the influence of each indicator
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {Object.entries(displayData.bestWeights).map(
            ([indicator, weight]) => (
              <div
                key={indicator}
                className={`rounded-lg p-3 md:p-4 border ${
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
                  className={`text-xs md:text-sm font-medium mb-1 truncate ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {indicator}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`text-xl md:text-2xl font-bold ${
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
                    <div className="flex-1 hidden md:block">
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
                                  ...Object.values(displayData.bestWeights)
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
  );
}
