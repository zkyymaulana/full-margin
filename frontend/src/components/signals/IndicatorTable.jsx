import { getIndicatorSignal, safeSignal } from "../../utils/indicatorParser";

function IndicatorTable({ allIndicators, isDarkMode }) {
  if (allIndicators.length === 0) return null;

  return (
    <div
      className={`lg:col-span-2 rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <h3
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Complete Indicator Analysis
              </h3>
            </div>
            <div className="group relative">
              <span className="text-sm cursor-help">ℹ️</span>
              <div
                className={`invisible group-hover:visible absolute left-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
                  isDarkMode
                    ? "bg-gray-800 border border-gray-700 text-gray-300"
                    : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                <p className="font-semibold mb-1">📋 Tabel Indikator Lengkap</p>
                <p>
                  Menampilkan semua indikator teknikal dengan detail parameter
                  (SMA 20, SMA 50, RSI 14, dll) dan nilai real-time dari setiap
                  indikator.
                </p>
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              isDarkMode
                ? "bg-blue-900 text-blue-300"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {allIndicators.length} Indicators
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className={`border-b ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <th
                  className={`text-left py-3 px-4 text-sm font-semibold ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Indicator
                </th>
                <th
                  className={`text-center py-3 px-4 text-sm font-semibold ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Signal
                </th>
                <th
                  className={`text-center py-3 px-4 text-sm font-semibold ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Category
                </th>
              </tr>
            </thead>
            <tbody>
              {allIndicators.map((indicator) => {
                // ✅ FORCE database signal only - strict validation
                const rawSignal = indicator.signal || "neutral";
                const validatedSignal = safeSignal(rawSignal);

                // ✅ Get formatted signal display
                const {
                  signal: signalText,
                  color: signalColor,
                  icon,
                } = getIndicatorSignal(validatedSignal, isDarkMode);

                return (
                  <tr
                    key={indicator.key}
                    className={`border-b transition-colors ${
                      isDarkMode
                        ? "border-gray-700 hover:bg-gray-700"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <td
                      className={`py-3 px-4 text-sm font-medium ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {indicator.name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${signalColor}`}
                      >
                        {icon} {signalText}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          indicator.category === "Trend"
                            ? isDarkMode
                              ? "bg-blue-900 text-blue-300"
                              : "bg-blue-100 text-blue-700"
                            : indicator.category === "Momentum"
                            ? isDarkMode
                              ? "bg-purple-900 text-purple-300"
                              : "bg-purple-100 text-purple-700"
                            : isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {indicator.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default IndicatorTable;
