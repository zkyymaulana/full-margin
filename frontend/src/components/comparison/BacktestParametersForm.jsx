import { useDarkMode } from "../../contexts/DarkModeContext";
import { DateRangeSelector } from "./DateRangeSelector";
import { ActionButtons } from "./ActionButtons";

// BacktestParametersForm: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function BacktestParametersForm({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  minDate,
  maxDate,
  handleCompare,
  isLoading,
  isPending,
}) {
  const { isDarkMode } = useDarkMode();

  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="p-3 md:p-6">
        <h2
          className={`text-base md:text-xl font-semibold mb-3 md:mb-4 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Configure Backtest Parameters
        </h2>

        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          minDate={minDate}
          maxDate={maxDate}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mt-3 md:mt-4">
          <div className="flex-1" />
          <ActionButtons
            handleCompare={handleCompare}
            isLoading={isLoading}
            isPending={isPending}
          />
        </div>
      </div>
    </div>
  );
}
