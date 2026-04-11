import { useDarkMode } from "../../contexts/DarkModeContext";
import MainChart from "./MainChart";
import OscillatorCharts from "./OscillatorCharts";
import OHLCVCard from "./OHLCVCard";

function DashboardChartSection({
  selectedSymbol,
  timeframes,
  timeframe,
  onTimeframeChange,
  candlesLoading,
  latestCandle,
  hoveredCandle,
  chartRef,
  seriesRef,
  allCandlesData,
  activeIndicators,
  chartSync,
  oscillatorChartsRef,
  onCrosshairMove,
  onChartReady,
}) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="card">
      <div className={`card-body ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className={`text-xl font-semibold ${
                isDarkMode ? "text-white border-none" : "text-gray-900"
              }`}
            >
              {selectedSymbol} Chart
            </h2>
            <p
              className={`text-xs mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Change symbol from header dropdown
            </p>
          </div>

          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  timeframe === tf.value
                    ? isDarkMode
                      ? "bg-blue-900 text-blue-300"
                      : "bg-blue-100 text-blue-600"
                    : isDarkMode
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {candlesLoading ? (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
                Loading chart data...
              </div>
            </div>
          </div>
        ) : (
          <>
            {latestCandle && (
              <OHLCVCard latestCandle={hoveredCandle || latestCandle} />
            )}

            <MainChart
              chartRef={chartRef}
              seriesRef={seriesRef}
              timeframe={timeframe}
              allCandlesData={allCandlesData}
              activeIndicators={activeIndicators}
              chartSync={chartSync}
              oscillatorChartsRef={oscillatorChartsRef}
              onCrosshairMove={onCrosshairMove}
            />

            <OscillatorCharts
              activeIndicators={activeIndicators}
              allCandlesData={allCandlesData}
              chartSync={chartSync}
              oscillatorChartsRef={oscillatorChartsRef}
              mainChartRef={chartRef}
              onChartReady={onChartReady}
            />
          </>
        )}
      </div>
    </div>
  );
}

export { DashboardChartSection };
export default DashboardChartSection;
