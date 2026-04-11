import { FiDollarSign } from "react-icons/fi";

function MarketCapHeader({ isDarkMode, onRefresh }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h1
          className={`text-2xl md:text-3xl font-bold flex items-center gap-2 md:gap-3 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          <FiDollarSign className="text-xl md:text-2xl" />
          Market Cap Overview
        </h1>
        <p
          className={`mt-1 text-sm md:text-base ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Top cryptocurrencies ranked by market capitalization
        </p>
      </div>

      <button
        onClick={onRefresh}
        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
          isDarkMode
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        } shadow-md hover:shadow-lg`}
      >
        🔄 Refresh Data
      </button>
    </div>
  );
}

export { MarketCapHeader };
export default MarketCapHeader;
