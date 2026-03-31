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

  const handleQuickSelect = ({ days = 0, months = 0, years = 0 }) => {
    const end = new Date();
    const start = new Date();

    if (years) {
      start.setFullYear(start.getFullYear() - years);
    } else if (months) {
      start.setMonth(start.getMonth() - months);
    } else if (days) {
      start.setDate(start.getDate() - days);
    }

    const formatToYYYYMMDD = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatToYYYYMMDD(start));
    setEndDate(formatToYYYYMMDD(end));
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
                ? "bg-gray-700 border-gray-600 text-white [color-scheme:dark]"
                : "border-gray-300 [color-scheme:light]"
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
                ? "bg-gray-700 border-gray-600 text-white [color-scheme:dark]"
                : "border-gray-300 [color-scheme:light]"
            }`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span
          className={`text-xs md:text-sm self-center hidden md:inline ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Quick Select:
        </span>
        <button
          onClick={() => handleQuickSelect({ days: 7 })}
          title="Last 1 Week"
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          1W
        </button>
        <button
          onClick={() => handleQuickSelect({ months: 1 })}
          title="Last 1 Month"
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          1M
        </button>
        <button
          onClick={() => handleQuickSelect({ months: 3 })}
          title="Last 3 Month"
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          3M
        </button>
        <button
          onClick={() => handleQuickSelect({ years: 1 })}
          title="Last 1 Years"
          className={`px-2.5 md:px-3 py-1.5 text-xs rounded-lg transition-colors hover:cursor-pointer ${
            isDarkMode
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          1Y
        </button>

        <span
          className={`text-[10px] md:hidden w-full mt-1 ${
            isDarkMode ? "text-gray-500" : "text-gray-500"
          }`}
        >
          1M = 1 Month | 3M = 3 Months | 6M = 6 Months | 1Y = 1 Year
        </span>
      </div>
    </>
  );
}
