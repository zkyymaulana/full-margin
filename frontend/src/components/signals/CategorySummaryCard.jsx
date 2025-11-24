function CategorySummaryCard({ title, indicators, isDarkMode, icon }) {
  return (
    <div
      className={`rounded-xl shadow-sm border p-6 ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3
          className={`text-lg font-semibold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {title}
        </h3>
      </div>

      {/* Indicators List - Minimalist */}
      {indicators.length === 0 ? (
        <div
          className={`text-center py-8 text-sm ${
            isDarkMode ? "text-gray-500" : "text-gray-400"
          }`}
        >
          No indicators available
        </div>
      ) : (
        <div className="space-y-3">
          {indicators.map((indicator) => {
            const isInactive = indicator.weight === 0;

            return (
              <div
                key={indicator.key}
                className={`flex justify-between items-center ${
                  isInactive ? "opacity-50" : ""
                }`}
              >
                {/* Indicator Name */}
                <span
                  className={`text-sm ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {indicator.name}
                </span>

                {/* Weight with Label */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    Weight:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      isInactive
                        ? isDarkMode
                          ? "text-gray-600"
                          : "text-gray-400"
                        : isDarkMode
                        ? "text-white"
                        : "text-gray-900"
                    }`}
                  >
                    {indicator.weight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CategorySummaryCard;
