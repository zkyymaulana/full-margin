import { FiSearch } from "react-icons/fi";

export default function MarketFilters({
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  isDarkMode,
}) {
  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border p-3 md:p-4 ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row gap-2 md:gap-4 items-stretch sm:items-center">
          <span
            className={`text-xs md:text-sm font-medium ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Market Filters
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-3 md:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm ${
              isDarkMode
                ? "border-gray-600 bg-gray-700 text-white"
                : "border-gray-300 bg-white text-gray-900"
            }`}
          >
            <option value="all">All Market Caps</option>
            <option value="gainers">Gainers Only</option>
            <option value="losers">Losers Only</option>
          </select>
        </div>

        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search coins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 md:px-4 py-2 pl-9 md:pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm ${
              isDarkMode
                ? "border-gray-600 bg-gray-700 text-white placeholder-gray-500"
                : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"
            }`}
          />
          <FiSearch className="absolute left-3 top-2.5 text-gray-400 text-sm md:text-base" />
        </div>
      </div>
    </div>
  );
}
