import { FiBarChart2, FiInfo, FiTrendingUp, FiRefreshCw } from "react-icons/fi";
import { useState } from "react";
import { useSymbol } from "../../contexts/SymbolContext";
import { formatPercent, formatRatio } from "../../utils/indicatorParser";

// BacktestPanel: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function BacktestPanel({ performance, isDarkMode }) {
  const { selectedSymbol } = useSymbol();

  // 🆕 Progress tracking states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({
    current: 0,
    total: 390625,
    percentage: 0,
    eta: "Calculating...",
    bestROI: 0,
  });

  if (!performance || Object.keys(performance).length === 0) return null;

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDateRange = () => {
    if (!performance.trainingPeriod) return null;

    const { startDateReadable, endDateReadable } = performance.trainingPeriod;
    if (!startDateReadable || !endDateReadable) return null;

    const formatShortDate = (dateStr) => {
      if (!dateStr) return "";
      return dateStr.split(" pukul ")[0];
    };

    return `${formatShortDate(startDateReadable)} - ${formatShortDate(
      endDateReadable,
    )}`;
  };

  const metrics = [
    {
      label: "ROI",
      value:
        performance.roi !== null && performance.roi !== undefined
          ? formatPercent(performance.roi)
          : "N/A",
      colorClass: isDarkMode ? "text-green-400" : "text-green-600",
    },
    {
      label: "Win Rate",
      value:
        performance.winRate !== null && performance.winRate !== undefined
          ? formatPercent(performance.winRate)
          : "N/A",
      colorClass: isDarkMode ? "text-blue-400" : "text-blue-600",
    },
    {
      label: "Sharpe Ratio",
      value:
        performance.sharpeRatio !== null &&
        performance.sharpeRatio !== undefined
          ? formatRatio(performance.sharpeRatio)
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
          ? formatPercent(performance.maxDrawdown)
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
    <>
      <div
        className={`rounded-xl shadow-sm border p-6 ${
          isDarkMode
            ? "bg-linear-to-r from-blue-900 to-purple-900 border-blue-700"
            : "bg-linear-to-r from-blue-50 to-purple-50 border-blue-200"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FiTrendingUp
              className={`text-2xl ${
                isDarkMode ? "text-blue-300" : "text-blue-700"
              }`}
            />
            <div>
              <h3
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Backtest Performance (Optimization Period)
              </h3>
              {performance?.trainingPeriod && (
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
              <FiInfo
                className={`text-sm cursor-help ${
                  isDarkMode ? "text-white" : "text-gray-700"
                }`}
              />
              <div
                className={`invisible group-hover:visible absolute left-0 top-6 w-80 p-3 rounded-lg shadow-lg z-50 text-xs ${
                  isDarkMode
                    ? "bg-gray-800 border border-gray-700 text-gray-300"
                    : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <FiBarChart2 className="text-lg" />
                  Backtest Results
                </p>
                <p>
                  The results represent backtesting during the weight
                  optimization process. The best strategy is selected based on
                  the highest ROI from historical data within this period.
                </p>
              </div>
            </div>
          </div>
        </div>

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

      {/* 🆕 PROGRESS MODAL - Menampilkan Status Background */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div
            className={`rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4 ${
              isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`p-3 rounded-full ${
                  isDarkMode ? "bg-blue-900" : "bg-blue-100"
                }`}
              >
                <FiRefreshCw
                  className={`text-3xl animate-spin ${
                    isDarkMode ? "text-blue-300" : "text-blue-600"
                  }`}
                />
              </div>
              <div>
                <h3
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {optimizationProgress.status === "background"
                    ? "Optimasi Berjalan di Background"
                    : optimizationProgress.status === "completed"
                      ? "Optimasi Selesai!"
                      : "Optimasi Berjalan"}
                </h3>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {selectedSymbol} - Full Exhaustive Search
                </p>
              </div>
            </div>

            {/* Konten berbeda berdasarkan status */}
            {optimizationProgress.status === "background" ? (
              // Status: Backend Running (setelah timeout)
              <div>
                <div
                  className={`p-6 rounded-lg mb-6 text-center ${
                    isDarkMode
                      ? "bg-gradient-to-br from-yellow-900 to-orange-900"
                      : "bg-gradient-to-br from-yellow-50 to-orange-50"
                  }`}
                >
                  <div className="text-6xl mb-4">⏳</div>
                  <p
                    className={`text-lg font-bold mb-2 ${
                      isDarkMode ? "text-yellow-200" : "text-yellow-900"
                    }`}
                  >
                    Optimasi Masih Berjalan di Server
                  </p>
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-yellow-300" : "text-yellow-800"
                    }`}
                  >
                    Estimasi waktu tersisa:{" "}
                    <strong>{optimizationProgress.eta}</strong>
                  </p>
                </div>

                <div
                  className={`p-4 rounded-lg mb-4 ${
                    isDarkMode
                      ? "bg-blue-900 border border-blue-700"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold mb-3 ${
                      isDarkMode ? "text-blue-300" : "text-blue-800"
                    }`}
                  >
                    📋 Instruksi:
                  </p>
                  <ul
                    className={`text-sm space-y-2 ${
                      isDarkMode ? "text-blue-200" : "text-blue-700"
                    }`}
                  >
                    <li>✅ Optimasi sedang berjalan di backend server</li>
                    <li>
                      ✅ Anda <strong>bisa menutup modal ini</strong>
                    </li>
                    <li>
                      ✅ Anda <strong>bisa menutup browser</strong> jika perlu
                    </li>
                    <li>
                      🔄 Refresh halaman setelah{" "}
                      <strong>{optimizationProgress.eta}</strong>
                    </li>
                    <li>📊 Hasil akan otomatis tersimpan di database</li>
                  </ul>
                </div>

                <div
                  className={`p-3 rounded-lg mb-6 text-xs ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  <p className="mb-1">
                    💡 <strong>Progress backend dapat dilihat di:</strong>
                  </p>
                  <p className="font-mono">Backend Terminal/Console</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowProgressModal(false)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                    }`}
                  >
                    Tutup Modal
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🔄 Refresh Sekarang
                  </button>
                </div>
              </div>
            ) : optimizationProgress.status === "completed" ? (
              // Status: Completed
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <p
                  className={`text-lg font-bold mb-4 ${
                    isDarkMode ? "text-green-400" : "text-green-600"
                  }`}
                >
                  Optimasi Berhasil Diselesaikan!
                </p>
              </div>
            ) : (
              // Status: Running (progress normal)
              <>
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`text-sm font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Progress
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`}
                    >
                      {optimizationProgress.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className={`w-full h-4 rounded-full overflow-hidden ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                      style={{ width: `${optimizationProgress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Kombinasi Tested */}
                  <div
                    className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-50"
                    }`}
                  >
                    <p
                      className={`text-xs mb-1 ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Kombinasi Tested
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {optimizationProgress.current.toLocaleString()}
                    </p>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      dari {optimizationProgress.total.toLocaleString()}
                    </p>
                  </div>

                  {/* ETA - Format seperti backend */}
                  <div
                    className={`p-4 rounded-lg ${
                      isDarkMode
                        ? "bg-gradient-to-br from-yellow-900 to-orange-900"
                        : "bg-gradient-to-br from-yellow-50 to-orange-50"
                    }`}
                  >
                    <p
                      className={`text-xs mb-1 ${
                        isDarkMode ? "text-yellow-300" : "text-yellow-700"
                      }`}
                    >
                      Estimasi Waktu Tersisa
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        isDarkMode ? "text-yellow-200" : "text-yellow-900"
                      }`}
                    >
                      {optimizationProgress.eta}
                    </p>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-yellow-400" : "text-yellow-600"
                      }`}
                    >
                      ETA
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div
                  className={`p-4 rounded-lg ${
                    isDarkMode
                      ? "bg-blue-900 border border-blue-700"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-blue-300" : "text-blue-800"
                    }`}
                  >
                    💡 <strong>Tips:</strong> Jangan tutup browser/tab ini.
                    Progress dapat dipantau di console (F12).
                  </p>
                </div>

                {/* Note */}
                <p
                  className={`text-xs text-center mt-6 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  Proses ini dapat memakan waktu hingga 1 jam tergantung jumlah
                  data
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
