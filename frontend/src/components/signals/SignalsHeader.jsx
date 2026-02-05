import { FiInfo } from "react-icons/fi";
import { formatPrice } from "../../utils/indicatorParser";

function SignalsHeader({
  selectedSymbol,
  methodology,
  lastUpdate,
  price,
  timeframe,
  bestCombo,
  isDarkMode,
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Technical Indicator Analysis
        </h1>
        <div className="group relative">
          <div className="text-gray-700 dark:text-gray-300">
            <FiInfo className="text-2xl cursor-help text-current" />
          </div>

          <div
            className={`invisible group-hover:visible absolute left-0 top-8 w-80 p-4 rounded-lg shadow-lg z-50 ${
              isDarkMode
                ? "bg-gray-800 border border-gray-700 text-gray-300"
                : "bg-white border border-gray-200 text-gray-700"
            }`}
          >
            <h4 className="font-semibold mb-2">Tentang Halaman Ini</h4>
            <p className="text-sm">
              Halaman ini menampilkan analisis teknikal lengkap menggunakan
              berbagai indikator yang dikelompokkan dalam 3 kategori: Trend,
              Momentum, dan Volatility. Sistem akan memberikan rekomendasi
              BUY/SELL/HOLD berdasarkan kombinasi semua indikator.
            </p>
          </div>
        </div>
      </div>
      <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
        {methodology || "Rule-Based Multi-Indicator Evaluation"}
      </p>
      <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
        <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          Symbol:{" "}
          <span
            className={`font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {selectedSymbol}
          </span>
        </span>
        <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          Last Update: {lastUpdate}
        </span>
        {price && (
          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Current Price:{" "}
            <span
              className={`font-bold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              ${formatPrice(price)}
            </span>
          </span>
        )}
        <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          Timeframe:{" "}
          <span
            className={`font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {timeframe || "1h"}
          </span>
        </span>
        {bestCombo && (
          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Best Strategy:{" "}
            <span
              className={`font-semibold ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {bestCombo}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export default SignalsHeader;
