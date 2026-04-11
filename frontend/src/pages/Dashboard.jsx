import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSymbol } from "../contexts/SymbolContext";
import { useMarketCapLive } from "../hooks/useMarketcap";
import {
  fetchCandlesWithPagination,
  fetchChartLiveTicker,
  fetchChartLiveOHLCV,
} from "../services/api.service";
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
  const wsRef = useRef(null);
  const lastWsEmitRef = useRef(0);
  const seriesMetaRef = useRef({
    initialized: false,
    minTime: null,
    maxTime: null,
    length: 0,
  });

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
  const { data: chartLiveTickerData } = useQuery({
    queryKey: ["chart-live-ticker", selectedSymbol],
    queryFn: () => fetchChartLiveTicker(selectedSymbol),
    enabled: !!selectedSymbol,
    refetchInterval: 2000,
    staleTime: 1000,
    refetchOnWindowFocus: false,
  });

  const { data: chartLiveOhlcvData } = useQuery({
    queryKey: ["chart-live-ohlcv", selectedSymbol, timeframe],
    queryFn: () => fetchChartLiveOHLCV(selectedSymbol, timeframe),
    enabled: !!selectedSymbol,
    refetchInterval: 2000,
    staleTime: 1000,
    refetchOnWindowFocus: false,
  });

  const [wsLivePrice, setWsLivePrice] = useState(null);
  const [wsTickKey, setWsTickKey] = useState(null);
  const [wsTickTimestamp, setWsTickTimestamp] = useState(null);

  useEffect(() => {
    setWsLivePrice(null);
    setWsTickKey(null);
    setWsTickTimestamp(null);
    lastWsEmitRef.current = 0;

    if (!selectedSymbol) return;

    let isActive = true;

    try {
      const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "subscribe",
            product_ids: [selectedSymbol],
            channels: ["ticker"],
          }),
        );
      };

      ws.onmessage = (event) => {
        if (!isActive) return;

        try {
          const data = JSON.parse(event.data);
          if (data?.type !== "ticker" || data?.product_id !== selectedSymbol) {
            return;
          }

          const price = Number(data.price);
          if (!Number.isFinite(price)) return;

          const now = Date.now();
          if (now - lastWsEmitRef.current < 500) return;
          lastWsEmitRef.current = now;

          const tickTs = data.time ? new Date(data.time).getTime() : now;

          setWsLivePrice(price);
          setWsTickKey(now);
          setWsTickTimestamp(tickTs);
        } catch (e) {
          // ignore parse errors from non-json frames
        }
      };

      ws.onerror = () => {
        // fallback polling tetap berjalan jika websocket gagal.
      };
    } catch (e) {
      // fallback polling tetap berjalan jika websocket tidak tersedia.
    }

    return () => {
      isActive = false;

      const ws = wsRef.current;
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "unsubscribe",
                product_ids: [selectedSymbol],
                channels: ["ticker"],
              }),
            );
          }
          ws.close();
        } catch (e) {
          // ignore close errors
        }
      }

      wsRef.current = null;
    };
  }, [selectedSymbol]);

  const liveTicker = useMemo(() => {
    if (!marketCapData?.success || !Array.isArray(marketCapData.data)) {
      return null;
    }
    return marketCapData.data.find((coin) => coin.symbol === selectedSymbol);
  }, [marketCapData, selectedSymbol]);

  const wsPrice = Number(wsLivePrice);
  const directLivePrice = Number(chartLiveTickerData?.data?.price);
  const liveOhlcvClose = Number(chartLiveOhlcvData?.data?.close);
  const fallbackLivePrice = Number(liveTicker?.price);
  const livePrice = Number.isFinite(liveOhlcvClose)
    ? liveOhlcvClose
    : Number.isFinite(wsPrice)
      ? wsPrice
      : Number.isFinite(directLivePrice)
        ? directLivePrice
        : fallbackLivePrice;

  const polledTickTs = Number(chartLiveTickerData?.data?.time);
  const marketTickTs = marketCapData?.timestamp
    ? new Date(marketCapData.timestamp).getTime()
    : null;

  const tickTimestampMs = Number.isFinite(Number(wsTickTimestamp))
    ? Number(wsTickTimestamp)
    : Number.isFinite(polledTickTs)
      ? polledTickTs
      : marketTickTs;

  const liveTickKey =
    wsTickKey ||
    chartLiveTickerData?.timestamp ||
    marketCapData?.timestamp ||
    null;

  useLiveRunningCandle({
    setCandles: setAllCandlesData,
    timeframe,
    livePrice,
    liveOhlcv: chartLiveOhlcvData?.data || null,
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

  // Kartu OHLCV/indikator dikunci ke data API agar konsisten saat refresh.
  const latestCandle =
    candlesData?.success && candlesData.data?.length > 0
      ? candlesData.data[0]
      : null;

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
