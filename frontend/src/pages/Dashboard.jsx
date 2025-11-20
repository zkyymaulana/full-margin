import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useMarketCapLive } from "../hooks/useMarketcap";
import { fetchCandlesWithPagination } from "../services/api.service";
import { useChartSync } from "../hooks/useChartSync";
import { useChartPagination } from "../hooks/useChartPagination";
import MainChart from "../components/dashboard/MainChart";
import OscillatorCharts from "../components/dashboard/OscillatorCharts";
import IndicatorTogglePanel from "../components/dashboard/IndicatorTogglePanel";
import IndicatorValueCards from "../components/dashboard/IndicatorValueCards";
import OHLCVCard from "../components/dashboard/OHLCVCard";
import TopCoinsSection from "../components/dashboard/TopCoinsSection";

function Dashboard() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const [timeframe, setTimeframe] = useState("1h");
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [allCandlesData, setAllCandlesData] = useState([]);

  // Chart refs
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const oscillatorChartsRef = useRef({});

  // Custom hooks
  const chartSync = useChartSync();
  const pagination = useChartPagination(allCandlesData, setAllCandlesData);

  // Fetch data
  const { data: candlesData, isLoading: candlesLoading } = useQuery({
    queryKey: ["candles", selectedSymbol, timeframe],
    queryFn: () =>
      fetchCandlesWithPagination(selectedSymbol, timeframe, 1, 1000),
    staleTime: 60000,
    enabled: !!selectedSymbol,
  });

  const { data: marketCapData } = useMarketCapLive();

  // Initialize data
  useEffect(() => {
    if (candlesData?.success && candlesData.data?.length) {
      setAllCandlesData(candlesData.data);
      pagination.initializePagination(candlesData);
    }
  }, [candlesData]);

  // Setup pagination listener
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const cleanup = pagination.setupPaginationListener(
      chartRef.current,
      seriesRef.current
    );

    return () => {
      if (cleanup) cleanup();
      if (pagination.debounceTimerRef.current) {
        clearTimeout(pagination.debounceTimerRef.current);
      }
    };
  }, [pagination.setupPaginationListener]);

  // Update chart data range
  useEffect(() => {
    if (!seriesRef.current || !allCandlesData.length) return;

    const chartData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }))
      .sort((a, b) => a.time - b.time);

    seriesRef.current.setData(chartData);

    if (chartData.length > 0) {
      chartSync.dataRangeRef.current = {
        minTime: chartData[0].time,
        maxTime: chartData[chartData.length - 1].time,
      };
    }

    // Fit content only for initial load
    if (
      chartRef.current &&
      allCandlesData.length === candlesData?.data?.length
    ) {
      chartRef.current.timeScale().fitContent();
      const visibleRange = chartRef.current.timeScale().getVisibleRange();
      if (visibleRange) {
        chartSync.currentVisibleRangeRef.current = visibleRange;
      }
    }
  }, [allCandlesData, candlesData?.data?.length]);

  // Sync all charts when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const allCharts = [
        chartRef.current,
        ...Object.values(oscillatorChartsRef.current),
      ].filter(Boolean);

      if (allCharts.length > 0 && chartRef.current) {
        const mainTimeScale = chartRef.current.timeScale();
        const visibleRange =
          chartSync.currentVisibleRangeRef.current ||
          mainTimeScale.getVisibleRange();

        if (visibleRange) {
          allCharts.forEach((chart) => {
            if (chart !== chartRef.current) {
              try {
                chart.timeScale().setVisibleRange(visibleRange);
              } catch (e) {
                console.warn("Initial sync error:", e);
              }
            }
          });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [candlesData, activeIndicators]);

  // Toggle indicator
  const toggleIndicator = (indicatorId) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  // Get latest candle
  const latestCandle =
    candlesData?.success && candlesData.data?.length > 0
      ? candlesData.data[0]
      : null;

  // Get top coins
  const topCoins = marketCapData?.success ? marketCapData.data.slice(0, 5) : [];

  const timeframes = [{ value: "1h", label: "1h" }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={`text-3xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Dashboard
          </h1>
          <p
            className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            Real-time cryptocurrency market analysis
          </p>
        </div>
      </div>

      {/* Chart Section */}
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
                  onClick={() => setTimeframe(tf.value)}
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

          {candlesLoading && (
            <div className="flex items-center justify-center h-[500px]">
              <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
                Loading chart data...
              </div>
            </div>
          )}

          {/* OHLCV Card */}
          {latestCandle && !candlesLoading && (
            <OHLCVCard latestCandle={latestCandle} />
          )}

          {/* Main Chart */}
          <MainChart
            chartRef={chartRef}
            seriesRef={seriesRef}
            allCandlesData={allCandlesData}
            activeIndicators={activeIndicators}
            chartSync={chartSync}
            oscillatorChartsRef={oscillatorChartsRef}
          />

          {/* Oscillator Charts */}
          <OscillatorCharts
            activeIndicators={activeIndicators}
            allCandlesData={allCandlesData}
            chartSync={chartSync}
            oscillatorChartsRef={oscillatorChartsRef}
            mainChartRef={chartRef}
          />

          {/* Indicator Value Cards */}
          <IndicatorValueCards activeIndicators={activeIndicators} />
        </div>
      </div>

      {/* Technical Indicators Toggle Panel */}
      <IndicatorTogglePanel
        activeIndicators={activeIndicators}
        onToggle={toggleIndicator}
      />

      {/* Indicator Value Cards */}
      {latestCandle && (
        <IndicatorValueCards
          latestCandle={latestCandle}
          activeIndicators={activeIndicators}
        />
      )}

      {/* Top 5 Coins */}
      <TopCoinsSection topCoins={topCoins} />
    </div>
  );
}

export default Dashboard;
