import { useState, useEffect, useRef, useCallback } from "react";
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

// Halaman dashboard: menampilkan chart utama, oscillator, indikator, dan top coin.
function DashboardPage() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const [timeframe, setTimeframe] = useState("1h");
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [allCandlesData, setAllCandlesData] = useState([]);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  // Referensi chart dipakai untuk sinkronisasi, update data, dan pagination.
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const oscillatorChartsRef = useRef({});
  const syncCleanupRef = useRef(null);

  // Hook custom untuk sinkronisasi chart dan infinite scroll candle.
  const chartSync = useChartSync();
  const pagination = useChartPagination(allCandlesData, setAllCandlesData);

  // Ambil data candle halaman pertama untuk simbol + timeframe aktif.
  const { data: candlesData, isLoading: candlesLoading } = useQuery({
    queryKey: ["candles", selectedSymbol, timeframe],
    queryFn: () =>
      fetchCandlesWithPagination(selectedSymbol, timeframe, 1, 1000),
    staleTime: 10000, // ✅ 10 seconds cache tolerance
    cacheTime: 120000, // ✅ Keep in memory for 2 minutes
    refetchOnMount: false, // ✅ Don't refetch if data is fresh
    refetchOnWindowFocus: false, // ❌ Don't refetch on window focus
    enabled: !!selectedSymbol,
  });

  const { data: marketCapData } = useMarketCapLive();

  // Inisialisasi data candle setiap kali response API terbaru datang.
  useEffect(() => {
    if (candlesData?.success && candlesData.data?.length) {
      console.log("🔄 [DATA REFRESH] New candles data received from API");
      console.log(`📊 Total candles: ${candlesData.data.length}`);

      // Bersihkan state dulu untuk mencegah data lama tertinggal.
      setAllCandlesData([]);

      setTimeout(() => {
        // Isi ulang dengan data baru dari backend.
        setAllCandlesData(candlesData.data);
        console.log("✅ [STATE RESET] allCandlesData updated with fresh data");

        // Debug: Log first candle's multiSignal
        if (candlesData.data[0]?.multiSignal) {
          console.log("🔍 [FIRST CANDLE SIGNAL]", {
            time: new Date(Number(candlesData.data[0].time)).toISOString(),
            multiSignal: candlesData.data[0].multiSignal,
          });
        }
      }, 0);

      pagination.initializePagination(candlesData);
    }
  }, [candlesData]);

  // Pasang listener pagination agar scroll kiri bisa memuat data historis.
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const cleanup = pagination.setupPaginationListener(
      chartRef.current,
      seriesRef.current,
    );

    return () => {
      if (cleanup) cleanup();
      if (pagination.debounceTimerRef.current) {
        clearTimeout(pagination.debounceTimerRef.current);
      }
    };
  }, [pagination.setupPaginationListener]);

  // Sinkronkan data series utama setiap isi allCandlesData berubah.
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

    // Fit content hanya saat load awal agar posisi user tidak sering ter-reset.
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

  // Setup ulang sinkronisasi seluruh chart (main + oscillator).
  const setupAllSync = useCallback(() => {
    // Hentikan sinkronisasi lama sebelum membuat yang baru.
    if (syncCleanupRef.current) {
      syncCleanupRef.current();
      syncCleanupRef.current = null;
    }

    const allCharts = [
      chartRef.current,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);

    // Sinkronisasi butuh minimal 2 chart.
    if (allCharts.length < 2) return;

    console.log(`[ChartSync] Setup sync for ${allCharts.length} charts`);

    const cleanupFunctions = [];
    allCharts.forEach((chart, index) => {
      const chartName =
        index === 0
          ? "main"
          : Object.keys(oscillatorChartsRef.current)[index - 1] ||
            `chart-${index}`;
      const cleanup = chartSync.setupChartSync(chart, allCharts, chartName);
      if (cleanup) cleanupFunctions.push(cleanup);
    });

    syncCleanupRef.current = () => {
      cleanupFunctions.forEach((fn) => {
        if (fn) fn();
      });
    };

    console.log("[ChartSync] ✅ Sync setup complete!");
  }, [chartSync]);

  // Callback saat chart oscillator selesai dibuat.
  const handleChartReady = useCallback(
    (chartKey, chart) => {
      console.log(`[ChartSync] Chart ready: ${chartKey}`);

      // Samakan visible range chart baru dengan main chart.
      if (chartRef.current) {
        try {
          const logicalRange = chartRef.current
            .timeScale()
            .getVisibleLogicalRange();
          if (logicalRange) {
            chart.timeScale().setVisibleLogicalRange(logicalRange);
          }
        } catch (e) {
          /* ignore */
        }
      }

      // Re-setup sync agar chart baru ikut tersinkron.
      setupAllSync();
    },
    [setupAllSync],
  );

  // Setup sinkronisasi terpusat, dijalankan saat indikator aktif berubah.
  useEffect(() => {
    // Saat indikator di-toggle OFF (chart dihapus), re-setup sync
    // Saat indikator di-toggle ON, handleChartReady yang akan setup
    const oscillatorIds = ["rsi", "stochastic", "stochasticRsi", "macd"];
    const hasActiveOscillators = activeIndicators.some((id) =>
      oscillatorIds.includes(id),
    );

    if (!hasActiveOscillators) {
      // Saat semua oscillator off, cleanup sync agar ringan.
      if (syncCleanupRef.current) {
        syncCleanupRef.current();
        syncCleanupRef.current = null;
      }
      return;
    }

    // Delay kecil membantu saat transisi chart add/remove.
    const t = setTimeout(() => setupAllSync(), 50);
    return () => clearTimeout(t);
  }, [activeIndicators, setupAllSync]);

  // Cleanup akhir saat halaman unmount.
  useEffect(() => {
    return () => {
      if (syncCleanupRef.current) {
        syncCleanupRef.current();
        syncCleanupRef.current = null;
      }
    };
  }, []);

  // Toggle indikator overlay/oscillator yang aktif.
  const toggleIndicator = (indicatorId) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId],
    );
  };

  // Ambil candle terbaru untuk OHLCV dan kartu indikator.
  const latestCandle =
    candlesData?.success && candlesData.data?.length > 0
      ? candlesData.data[0]
      : null;

  // Ambil 5 coin teratas dari data market cap live.
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
            Cryptocurrency market analysis
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

          {/* Loading State - Only show once */}
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
              {/* OHLCV Card */}
              {latestCandle && (
                <OHLCVCard latestCandle={hoveredCandle || latestCandle} />
              )}

              {/* Main Chart */}
              <MainChart
                chartRef={chartRef}
                seriesRef={seriesRef}
                allCandlesData={allCandlesData}
                activeIndicators={activeIndicators}
                chartSync={chartSync}
                oscillatorChartsRef={oscillatorChartsRef}
                onCrosshairMove={setHoveredCandle}
              />

              {/* Oscillator Charts */}
              <OscillatorCharts
                activeIndicators={activeIndicators}
                allCandlesData={allCandlesData}
                chartSync={chartSync}
                oscillatorChartsRef={oscillatorChartsRef}
                mainChartRef={chartRef}
                onChartReady={handleChartReady}
              />
            </>
          )}
        </div>
      </div>

      {/* Technical Indicators Toggle Panel */}
      <IndicatorTogglePanel
        activeIndicators={activeIndicators}
        onToggle={toggleIndicator}
      />

      {/* Indicator Value Cards - ✅ ONLY ONE INSTANCE */}
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

export { DashboardPage };
export default DashboardPage;
