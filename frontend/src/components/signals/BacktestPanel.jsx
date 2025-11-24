import { formatNumber } from "../../utils/indicatorParser";

function BacktestPanel({ performance, bestCombo, isDarkMode }) {
  if (!performance || Object.keys(performance).length === 0) return null;

  // Format currency
  const formatCurrency = (value) => {
    if (!value && value !== 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format date range for training period
  const formatDateRange = () => {
    if (!performance.trainingPeriod) return null;

    const { startDateReadable, endDateReadable } = performance.trainingPeriod;
    if (!startDateReadable || !endDateReadable) return null;

    // Simplified format for display
    const formatShortDate = (dateStr) => {
      if (!dateStr) return "";
      // Extract "14 November 2024" from "14 November 2024 pukul 00.00"
      return dateStr.split(" pukul ")[0];
    };

    return `${formatShortDate(startDateReadable)} - ${formatShortDate(
      endDateReadable
    )}`;
  };

  // Metrics data array for cleaner rendering
  const metrics = [
    {
      label: "ROI",
      value:
        performance.roi !== null && performance.roi !== undefined
          ? `${formatNumber(performance.roi)}%`
          : "N/A",
      colorClass: isDarkMode ? "text-green-400" : "text-green-600",
    },
    {
      label: "Win Rate",
      value:
        performance.winRate !== null && performance.winRate !== undefined
          ? `${formatNumber(performance.winRate)}%`
          : "N/A",
      colorClass: isDarkMode ? "text-blue-400" : "text-blue-600",
    },
    {
      label: "Sharpe Ratio",
      value:
        performance.sharpeRatio !== null &&
        performance.sharpeRatio !== undefined
          ? formatNumber(performance.sharpeRatio)
          : "N/A",
      colorClass:
        performance.sharpeRatio > 2
          ? isDarkMode
            ? "text-green-400"
            : "text-green-600"
          : performance.sharpeRatio > 1
          ? isDarkMode
            ? "text-blue-400"
            : "text-blue-600"
          : isDarkMode
          ? "text-yellow-400"
          : "text-yellow-600",
    },
    {
      label: "Max Drawdown",
      value:
        performance.maxDrawdown !== null &&
        performance.maxDrawdown !== undefined
          ? `${formatNumber(performance.maxDrawdown)}%`
          : "N/A",
      colorClass: isDarkMode ? "text-red-400" : "text-red-600",
    },
    {
      label: "Trades",
      value: performance.trades || "N/A",
      colorClass: isDarkMode ? "text-white" : "text-gray-900",
    },
    {
      label: "Initial Capital",
      value: formatCurrency(performance.initialCapital || 10000),
      colorClass: isDarkMode ? "text-gray-300" : "text-gray-700",
    },
    {
      label: "Final Capital",
      value: formatCurrency(performance.finalCapital),
      colorClass:
        performance.finalCapital > (performance.initialCapital || 10000)
          ? isDarkMode
            ? "text-green-400"
            : "text-green-600"
          : isDarkMode
          ? "text-red-400"
          : "text-red-600",
    },
  ];

  return (
    <div
      className={`rounded-xl shadow-sm border p-6 ${
        isDarkMode
          ? "bg-linear-to-r from-blue-900 to-purple-900 border-blue-700"
          : "bg-linear-to-r from-blue-50 to-purple-50 border-blue-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">📈</span>
        <div>
          <h3
            className={`text-lg font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Backtest Performance ({bestCombo})
          </h3>
          {formatDateRange() && (
            <p
              className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Period: {formatDateRange()}
            </p>
          )}
        </div>
        <div className="group relative mb-4">
          <span className="text-sm cursor-help">ℹ️</span>
          <div
            className={`invisible group-hover:visible absolute left-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
              isDarkMode
                ? "bg-gray-800 border border-gray-700 text-gray-300"
                : "bg-white border border-gray-200 text-gray-700"
            }`}
          >
            <p className="font-semibold mb-1">📊 Hasil Backtest</p>
            <p>
              Hasil uji coba strategi trading menggunakan data historis.
              Strategi terbaik dipilih berdasarkan ROI tertinggi dari kombinasi
              indikator.
            </p>
            <p className="mt-2">
              <strong>Sharpe Ratio:</strong> Mengukur return yang disesuaikan
              dengan risiko. Nilai &gt; 1 baik, &gt; 2 sangat baik.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="text-center">
            <div
              className={`text-xs mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {metric.label}
            </div>
            <div className={`text-lg font-bold ${metric.colorClass}`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BacktestPanel;
