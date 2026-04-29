import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSymbol } from "../contexts/SymbolContext";
import { useMarketCapLive } from "../hooks/useMarketcap";
import { useCryptoWebSocket } from "../hooks/useCryptoWebSocket";
import { fetchCandlesWithPagination } from "../services/api.service";
import { useChartSync } from "../hooks/useChartSync";
import { useChartPagination } from "../hooks/useChartPagination";
import { useLiveRunningCandle } from "../hooks/useLiveRunningCandle";
import IndicatorTogglePanel from "../components/dashboard/IndicatorTogglePanel";
import IndicatorValueCards from "../components/dashboard/IndicatorValueCards";
import TopCoinsSection from "../components/dashboard/TopCoinsSection";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardChartSection from "../components/dashboard/DashboardChartSection";

// Halaman dashboard: menampilkan chart utama, oscillator, indikator, dan top coin.
function DashboardPage() {
  const { selectedSymbol } = useSymbol();
  const [timeframe, setTimeframe] = useState("1h");
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [allCandlesData, setAllCandlesData] = useState([]);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  // Referensi chart dipakai untuk sinkronisasi, update data, dan pagination.
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const oscillatorChartsRef = useRef({});
  const syncCleanupRef = useRef(null);
  const seriesMetaRef = useRef({
    initialized: false,
    minTime: null,
    maxTime: null,
    length: 0,
  });
  const lastCandlesKeyRef = useRef(null);

  // Hook custom untuk sinkronisasi chart dan infinite scroll candle.
  const chartSync = useChartSync();
  const pagination = useChartPagination(allCandlesData, setAllCandlesData);

  // Ambil data candle halaman pertama untuk simbol + timeframe aktif.
  const { data: candlesData, isLoading: candlesLoading } = useQuery({
    queryKey: ["candles", selectedSymbol, timeframe],
    queryFn: () =>
      fetchCandlesWithPagination(selectedSymbol, timeframe, 1, 1000),
    staleTime: 10000,
    cacheTime: 120000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !!selectedSymbol,
  });

  const { data: marketCapData } = useMarketCapLive();
  const { ticks: wsTicks, candles: wsCandles } = useCryptoWebSocket();

  const liveTicker = useMemo(() => {
    if (!marketCapData?.success || !Array.isArray(marketCapData.data)) {
      return null;
    }
    return marketCapData.data.find((coin) => coin.symbol === selectedSymbol);
  }, [marketCapData, selectedSymbol]);

  const wsPrice = Number(wsTicks?.[selectedSymbol]?.price);
  const fallbackLivePrice = Number(liveTicker?.price);
  const livePrice = Number.isFinite(wsPrice) ? wsPrice : fallbackLivePrice;

  const marketTickTs = marketCapData?.timestamp
    ? new Date(marketCapData.timestamp).getTime()
    : null;

  const tickTimestampMs = Number.isFinite(
    Number(wsCandles?.[selectedSymbol]?.time),
  )
    ? Number(wsCandles?.[selectedSymbol]?.time)
    : Number.isFinite(Number(wsTicks?.[selectedSymbol]?.time))
      ? Number(wsTicks?.[selectedSymbol]?.time)
      : marketTickTs;

  const liveTickKey =
    wsCandles?.[selectedSymbol]?.time ||
    wsTicks?.[selectedSymbol]?.time ||
    marketCapData?.timestamp ||
    null;

  useLiveRunningCandle({
    setCandles: setAllCandlesData,
    timeframe,
    livePrice,
    liveOhlcv: wsCandles?.[selectedSymbol] || null,
    tickKey: liveTickKey,
    tickTimestampMs,
    enabled: !!selectedSymbol && Number.isFinite(livePrice),
  });

  useEffect(() => {
    if (allCandlesData.length > 0) return;

    seriesMetaRef.current = {
      initialized: false,
      minTime: null,
      maxTime: null,
      length: 0,
    };
  }, [allCandlesData.length]);

  // Reset state saat symbol/timeframe berubah agar data tidak tercampur.
  useEffect(() => {
    setAllCandlesData([]);
    seriesMetaRef.current = {
      initialized: false,
      minTime: null,
      maxTime: null,
      length: 0,
    };
    lastCandlesKeyRef.current = `${selectedSymbol || ""}-${timeframe}`;
  }, [selectedSymbol, timeframe]);

  // Inisialisasi data candle saat response API pertama datang.
  useEffect(() => {
    if (!candlesData?.success || !candlesData.data?.length) return;

    const currentKey = `${selectedSymbol || ""}-${timeframe}`;
    if (lastCandlesKeyRef.current !== currentKey) {
      lastCandlesKeyRef.current = currentKey;
      setAllCandlesData(candlesData.data);
      pagination.initializePagination(candlesData);
      return;
    }

    if (allCandlesData.length === 0) {
      setAllCandlesData(candlesData.data);
      pagination.initializePagination(candlesData);
    }
  }, [candlesData, selectedSymbol, timeframe, allCandlesData.length]);

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

    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;
    let latestRawCandle = null;

    for (const candle of allCandlesData) {
      const candleTime = Number(candle.time) / 1000;
      if (!Number.isFinite(candleTime)) continue;

      if (candleTime < minTime) minTime = candleTime;
      if (candleTime > maxTime) {
        maxTime = candleTime;
        latestRawCandle = candle;
      }
    }

    if (
      !latestRawCandle ||
      !Number.isFinite(minTime) ||
      !Number.isFinite(maxTime)
    ) {
      return;
    }

    const previous = seriesMetaRef.current;
    const canDoIncrementalUpdate =
      previous.initialized &&
      minTime === previous.minTime &&
      maxTime >= previous.maxTime &&
      allCandlesData.length >= previous.length &&
      allCandlesData.length <= previous.length + 1;

    if (canDoIncrementalUpdate) {
      seriesRef.current.update({
        time: maxTime,
        open: Number(latestRawCandle.open),
        high: Number(latestRawCandle.high),
        low: Number(latestRawCandle.low),
        close: Number(latestRawCandle.close),
      });

      chartSync.dataRangeRef.current = {
        minTime,
        maxTime,
      };

      seriesMetaRef.current = {
        initialized: true,
        minTime,
        maxTime,
        length: allCandlesData.length,
      };
      return;
    }

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

      seriesMetaRef.current = {
        initialized: true,
        minTime: chartData[0].time,
        maxTime: chartData[chartData.length - 1].time,
        length: chartData.length,
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

  }, [chartSync]);

  // Callback saat chart oscillator selesai dibuat.
  const handleChartReady = useCallback(
    (chartKey, chart) => {

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

  // Kartu OHLCV/indikator mengikuti candle terbaru yang sudah di-update live.
  const latestCandle = useMemo(() => {
    if (!allCandlesData.length) {
      return candlesData?.data?.[0] || null;
    }

    let latest = null;
    let latestTime = Number.NEGATIVE_INFINITY;
    for (const candle of allCandlesData) {
      const time = Number(candle.time);
      if (!Number.isFinite(time)) continue;
      if (time > latestTime) {
        latestTime = time;
        latest = candle;
      }
    }

    return latest || candlesData?.data?.[0] || null;
  }, [allCandlesData, candlesData?.data]);

  // Ambil 5 coin teratas dari data market cap live.
  const topCoins = marketCapData?.success ? marketCapData.data.slice(0, 5) : [];

  const timeframes = [{ value: "1h", label: "1h" }];

  return (
    <div className="space-y-6">
      <DashboardHeader />

      <DashboardChartSection
        selectedSymbol={selectedSymbol}
        timeframes={timeframes}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        candlesLoading={candlesLoading}
        latestCandle={latestCandle}
        hoveredCandle={hoveredCandle}
        chartRef={chartRef}
        seriesRef={seriesRef}
        allCandlesData={allCandlesData}
        activeIndicators={activeIndicators}
        chartSync={chartSync}
        oscillatorChartsRef={oscillatorChartsRef}
        onCrosshairMove={setHoveredCandle}
        onChartReady={handleChartReady}
      />

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
