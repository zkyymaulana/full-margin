import { useDarkMode } from "../../contexts/DarkModeContext";
import { useSymbol } from "../../contexts/SymbolContext";

export function DateRangeSelector({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) {
  const { isDarkMode } = useDarkMode();
  const { selectedSymbol } = useSymbol();

  const handleQuickSelect = (months, years = 0) => {
    const end = new Date();
    const start = new Date();
    if (years) {
      start.setFullYear(start.getFullYear() - years);
    } else {
      start.setMonth(start.getMonth() - months);
    }
    setEndDate(end.toISOString().split("T")[0]);
    setStartDate(start.toISOString().split("T")[0]);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        <div>
          <label
            className={`block text-xs md:text-sm font-medium mb-1.5 md:mb-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Symbol
          </label>
          <div
            className={`w-full px-3 py-2 border rounded-lg font-medium text-sm ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-gray-300"
                : "bg-gray-100 border-gray-300 text-gray-700"
            }`}
          >
            {selectedSymbol}
          </div>
          <p className="text-xs mt-1 text-gray-500">
            Change symbol from header dropdown
          </p>
        </div>

        <div>
          <label
            className={`block text-xs md:text-sm font-medium mb-1.5 md:mb-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white"
                : "border-gray-300"
            }`}
          />
        </div>

        <div>
          <label
            className={`block text-xs md:text-sm font-medium mb-1.5 md:mb-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white"
                : "border-gray-300"
            }`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`text-xs md:text-sm self-center hidden md:inline ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Quick Select:
        </span>
        <button
          onClick={() => handleQuickSelect(1)}
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          1M
        </button>
        <button
          onClick={() => handleQuickSelect(3)}
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          3M
        </button>
        <button
          onClick={() => handleQuickSelect(6)}
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          6M
        </button>
        <button
          onClick={() => handleQuickSelect(0, 1)}
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          1Y
        </button>
      </div>
    </>
  );
}
