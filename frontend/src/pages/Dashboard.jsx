import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMarketCapLive } from "../hooks/useMarketcap";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { createChart } from "lightweight-charts";
import { Link } from "react-router-dom";
import {
  fetchCandlesByUrl,
  fetchCandlesWithPagination,
} from "../services/api.service";

function Dashboard() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const [timeframe, setTimeframe] = useState("1h");
  const [activeIndicators, setActiveIndicators] = useState([]);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});

  // 🔥 PAGINATION STATE untuk Infinite Scroll
  const [allCandlesData, setAllCandlesData] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    currentPage: 1,
    totalPages: 1,
    nextUrl: null,
    prevUrl: null,
    isLoading: false,
    hasMore: true,
  });

  // Refs untuk pagination logic
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const visibleRangeSubscriptionRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const nextUrlRef = useRef(null);

  // Refs untuk oscillator charts
  const rsiChartRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiSeriesRef = useRef(null);

  const stochasticChartRef = useRef(null);
  const stochasticContainerRef = useRef(null);
  const stochasticKSeriesRef = useRef(null);
  const stochasticDSeriesRef = useRef(null);

  const stochRsiChartRef = useRef(null);
  const stochRsiContainerRef = useRef(null);
  const stochRsiKSeriesRef = useRef(null);
  const stochRsiDSeriesRef = useRef(null);

  const macdChartRef = useRef(null);
  const macdContainerRef = useRef(null);
  const macdLineSeriesRef = useRef(null);
  const macdSignalSeriesRef = useRef(null);
  const macdHistogramSeriesRef = useRef(null);

  // Tambahkan ref untuk tracking sync state
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef(null);

  // Ref untuk menyimpan data range
  const dataRangeRef = useRef(null);

  // Ref untuk menyimpan visible range yang sedang aktif
  const currentVisibleRangeRef = useRef(null);

  // Ref untuk tracking sync state yang lebih robust
  const syncDebounceRef = useRef(null);

  // Fungsi untuk membatasi visible range agar tidak melewati candle terakhir
  const limitVisibleRange = (range) => {
    if (!dataRangeRef.current || !range) return range;

    const { from, to } = range;
    const { minTime, maxTime } = dataRangeRef.current;

    // Hitung durasi visible range
    const visibleDuration = to - from;

    // Batas maksimal: candle terakhir + rightOffset yang wajar
    const maxAllowedTo = maxTime + visibleDuration * 0.05; // 5% buffer untuk rightOffset

    // Jika range.to melewati batas maksimal, geser range
    if (to > maxAllowedTo) {
      const adjustedTo = maxAllowedTo;
      const adjustedFrom = adjustedTo - visibleDuration;

      // Pastikan from tidak kurang dari minTime
      if (adjustedFrom < minTime) {
        return { from: minTime, to: minTime + visibleDuration };
      }

      return { from: adjustedFrom, to: adjustedTo };
    }

    // Jika from kurang dari minTime, geser range
    if (from < minTime) {
      return { from: minTime, to: minTime + visibleDuration };
    }

    return range;
  };

  // Fungsi utama untuk sinkronisasi semua chart
  const syncAllCharts = (sourceChart = null, immediate = false) => {
    // Prevent recursive syncing
    if (isSyncingRef.current) return;

    const allCharts = [
      chartRef.current,
      rsiChartRef.current,
      stochasticChartRef.current,
      stochRsiChartRef.current,
      macdChartRef.current,
    ].filter(Boolean);

    if (allCharts.length <= 1) return;

    // Gunakan chart utama sebagai source jika tidak ditentukan
    const masterChart = sourceChart || chartRef.current;
    if (!masterChart) return;

    const masterTimeScale = masterChart.timeScale();
    let visibleRange = masterTimeScale.getVisibleRange();

    if (!visibleRange) return;

    // Terapkan pembatasan untuk mencegah ruang kosong berlebihan
    visibleRange = limitVisibleRange(visibleRange);

    // Update current visible range
    currentVisibleRangeRef.current = visibleRange;

    isSyncingRef.current = true;

    try {
      // Sync ke semua chart kecuali source chart
      allCharts.forEach((chart) => {
        if (chart !== masterChart) {
          try {
            const targetTimeScale = chart.timeScale();

            // Terapkan options yang sama untuk konsistensi
            targetTimeScale.applyOptions({
              lockVisibleTimeRangeOnResize: true,
              rightBarStaysOnScroll: true,
              fixLeftEdge: false,
              fixRightEdge: false,
            });

            // Set visible range dengan precision yang tinggi
            targetTimeScale.setVisibleRange(visibleRange);
          } catch (e) {
            console.warn("Sync error for individual chart:", e);
          }
        }
      });
    } catch (error) {
      console.warn("General sync error:", error);
    }

    // Reset sync flag
    if (immediate) {
      isSyncingRef.current = false;
    } else {
      // Clear previous timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        isSyncingRef.current = false;
      }, 50); // Increased delay for better stability
    }
  };

  // Fungsi untuk setup event listeners yang lebih comprehensive
  const setupChartSync = (chart, chartType = "unknown") => {
    if (!chart) return;

    console.log(`Setting up sync for ${chartType} chart`); // Debug log

    const timeScale = chart.timeScale();

    // Apply consistent timeScale options
    timeScale.applyOptions({
      lockVisibleTimeRangeOnResize: true,
      rightBarStaysOnScroll: true,
      fixLeftEdge: false,
      fixRightEdge: false,
    });

    // Subscribe to visible time range changes dengan debouncing
    const handleVisibleTimeRangeChange = () => {
      // Clear previous debounce
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }

      // Debounce sync calls untuk performa yang lebih baik
      syncDebounceRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          syncAllCharts(chart, false);
        });
      }, 10);
    };

    const unsubscribeTimeRange = timeScale.subscribeVisibleTimeRangeChange(
      handleVisibleTimeRangeChange
    );

    // Enhanced wheel event handler untuk zoom sync
    const handleWheel = (event) => {
      // Immediate sync untuk zoom yang responsive
      requestAnimationFrame(() => {
        syncAllCharts(chart, true);
      });
    };

    // Enhanced mouse event handlers untuk drag sync
    const handleMouseDown = () => {
      // Start sync tracking saat drag dimulai
      requestAnimationFrame(() => {
        syncAllCharts(chart, true);
      });
    };

    const handleMouseMove = (event) => {
      // Sync selama drag dengan throttling
      if (event.buttons === 1) {
        // Left mouse button pressed
        requestAnimationFrame(() => {
          syncAllCharts(chart, false);
        });
      }
    };

    const handleMouseUp = () => {
      // Final sync saat drag selesai
      requestAnimationFrame(() => {
        syncAllCharts(chart, true);
      });
    };

    // Attach event listeners ke chart element
    const chartElement = chart.chartElement();
    if (chartElement) {
      chartElement.addEventListener("wheel", handleWheel, { passive: true });
      chartElement.addEventListener("mousedown", handleMouseDown);
      chartElement.addEventListener("mousemove", handleMouseMove);
      chartElement.addEventListener("mouseup", handleMouseUp);
    }

    // Cleanup function
    return () => {
      console.log(`Cleaning up sync for ${chartType} chart`); // Debug log

      if (unsubscribeTimeRange) {
        unsubscribeTimeRange();
      }

      if (chartElement) {
        chartElement.removeEventListener("wheel", handleWheel);
        chartElement.removeEventListener("mousedown", handleMouseDown);
        chartElement.removeEventListener("mousemove", handleMouseMove);
        chartElement.removeEventListener("mouseup", handleMouseUp);
      }

      // Clear timeouts
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  };

  // Shared chart options untuk responsive design
  const getBaseChartOptions = (height, isMainChart = false) => ({
    width: 0, // Will be set dynamically
    height: height,
    layout: {
      background: { color: isDarkMode ? "#1f2937" : "#ffffff" },
      textColor: isDarkMode ? "#9ca3af" : "#6b7280",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: 12,
    },
    grid: {
      vertLines: {
        color: isDarkMode ? "#374151" : "#e5e7eb",
        style: 0,
        visible: true,
      },
      horzLines: {
        color: isDarkMode ? "#374151" : "#e5e7eb",
        style: 0,
        visible: true,
      },
    },
    rightPriceScale: {
      visible: true,
      borderVisible: true,
      borderColor: isDarkMode ? "#4b5563" : "#d1d5db",
      textColor: isDarkMode ? "#9ca3af" : "#6b7280",
      entireTextOnly: false,
      ticksVisible: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
      autoScale: true,
      alignLabels: true,
      minimumWidth: 80, // Pastikan ada ruang minimum untuk label
    },
    leftPriceScale: {
      visible: false,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
      axisDoubleClickReset: {
        time: true,
        price: true,
      },
      mouseWheel: true,
      pinch: true,
    },
    crosshair: {
      mode: 1, // Normal crosshair
      vertLine: {
        width: 1,
        color: isDarkMode ? "#6b7280" : "#9ca3af",
        style: 2, // Dashed line
        visible: true,
        labelVisible: true,
        labelBackgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
      },
      horzLine: {
        width: 1,
        color: isDarkMode ? "#6b7280" : "#9ca3af",
        style: 2, // Dashed line
        visible: true,
        labelVisible: true,
        labelBackgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
      },
    },
    overlayPriceScales: {},
    timeScale: getTimeScaleOptions(isMainChart ? false : true), // Main chart tidak menampilkan timeScale jika ada oscillator
  });

  // Shared timeScale options untuk konsistensi
  const getTimeScaleOptions = (showTimeScale = true) => ({
    timeVisible: showTimeScale,
    secondsVisible: false,
    rightOffset: 20, // Increased offset untuk memberikan lebih banyak ruang
    barSpacing: 8, // Increased spacing untuk readability yang lebih baik
    minBarSpacing: 1,
    fixLeftEdge: false,
    fixRightEdge: false,
    lockVisibleTimeRangeOnResize: true,
    rightBarStaysOnScroll: true,
    borderVisible: showTimeScale,
    borderColor: isDarkMode ? "#4b5563" : "#d1d5db",
    visible: true,
    tickMarkFormatter: (time, tickMarkType, locale) => {
      const date = new Date(time * 1000);
      switch (tickMarkType) {
        case 0: // Year
          return date.getFullYear().toString();
        case 1: // Month
          return date.toLocaleDateString(locale, { month: "short" });
        case 2: // DayOfMonth
          return date.getDate().toString();
        case 3: // Time
          return date.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        default:
          return "";
      }
    },
  });

  // Fetch data - GUNAKAN fetchCandlesWithPagination untuk initial load
  const {
    data: candlesData,
    isLoading: candlesLoading,
    refetch,
  } = useQuery({
    queryKey: ["candles", selectedSymbol, timeframe],
    queryFn: () =>
      fetchCandlesWithPagination(selectedSymbol, timeframe, 1, 1000),
    staleTime: 60000,
    enabled: !!selectedSymbol,
  });
  const { data: marketCapData } = useMarketCapLive();

  // 🔥 INFINITE SCROLL: Fungsi untuk merge data candles tanpa duplikasi
  const mergeCandlesData = useCallback((existingData, newData) => {
    // Buat Set dari existing times untuk cek duplikasi
    const existingTimes = new Set(existingData.map((d) => d.time.toString()));

    // Filter data baru yang belum ada
    const uniqueNewData = newData.filter(
      (d) => !existingTimes.has(d.time.toString())
    );

    // Gabungkan dan sort berdasarkan time (ascending - oldest first)
    const merged = [...existingData, ...uniqueNewData];
    merged.sort((a, b) => {
      const timeA = typeof a.time === "string" ? Number(a.time) : a.time;
      const timeB = typeof b.time === "string" ? Number(b.time) : b.time;
      return timeA - timeB;
    });

    console.log(
      `📊 Merged data: ${existingData.length} + ${uniqueNewData.length} = ${merged.length} candles`
    );
    return merged;
  }, []);

  // 🔥 INFINITE SCROLL: Fungsi untuk fetch page berikutnya
  const fetchMoreData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (
      isLoadingMoreRef.current ||
      !hasMoreDataRef.current ||
      !nextUrlRef.current
    ) {
      return;
    }

    // Debouncing: prevent too frequent requests (minimum 500ms between fetches)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 500) {
      console.log("⏸️ Debounced: Too soon since last fetch");
      return;
    }

    isLoadingMoreRef.current = true;
    lastFetchTimeRef.current = now;

    setPageInfo((prev) => ({ ...prev, isLoading: true }));

    console.log(`🔄 Fetching more data from: ${nextUrlRef.current}`);

    try {
      // 📊 STEP 1: Simpan state sebelum fetch
      const prevTotal = allCandlesData.length;
      const currentLogicalRange = chartRef.current
        ?.timeScale()
        .getVisibleLogicalRange();

      console.log(
        `📊 Before fetch: ${prevTotal} candles, logical range: ${
          currentLogicalRange
            ? `${currentLogicalRange.from.toFixed(
                2
              )} → ${currentLogicalRange.to.toFixed(2)}`
            : "null"
        }`
      );

      // 🌐 STEP 2: Fetch data baru
      const response = await fetchCandlesByUrl(nextUrlRef.current);

      if (response?.success && response.data?.length > 0) {
        console.log(
          `✅ Fetched ${response.data.length} new candles (Page ${response.page}/${response.totalPages})`
        );

        // 🔧 STEP 3: Matikan autoscale sementara
        if (chartRef.current) {
          chartRef.current.applyOptions({
            rightPriceScale: {
              autoScale: false,
            },
          });
          console.log("🔒 AutoScale disabled temporarily");
        }

        // 📦 STEP 4: Merge new data dengan existing data
        const mergedData = mergeCandlesData(allCandlesData, response.data);
        const addedBars = mergedData.length - prevTotal;

        console.log(
          `🧮 Bars added: ${addedBars} (${prevTotal} → ${mergedData.length})`
        );

        // 💾 STEP 5: Update state dengan merged data
        setAllCandlesData(mergedData);

        // 📍 STEP 6: Restore scroll position dengan offset untuk bars baru
        if (currentLogicalRange && chartRef.current && addedBars > 0) {
          // Tunggu React render data baru ke chart
          setTimeout(() => {
            try {
              // Hitung range baru dengan offset
              const newLogicalRange = {
                from: currentLogicalRange.from + addedBars,
                to: currentLogicalRange.to + addedBars,
              };

              console.log(
                `📍 Adjusting logical range: ${currentLogicalRange.from.toFixed(
                  2
                )} → ${newLogicalRange.from.toFixed(
                  2
                )}, ${currentLogicalRange.to.toFixed(
                  2
                )} → ${newLogicalRange.to.toFixed(2)}`
              );

              // Set range baru
              chartRef.current
                .timeScale()
                .setVisibleLogicalRange(newLogicalRange);
              console.log("✅ Scroll position preserved with offset");

              // Re-enable autoscale setelah delay
              setTimeout(() => {
                if (chartRef.current) {
                  chartRef.current.applyOptions({
                    rightPriceScale: {
                      autoScale: true,
                    },
                  });
                  console.log("🔓 AutoScale re-enabled");
                }
              }, 200);
            } catch (e) {
              console.warn("Failed to adjust scroll position:", e);

              // Fallback: re-enable autoscale
              if (chartRef.current) {
                chartRef.current.applyOptions({
                  rightPriceScale: {
                    autoScale: true,
                  },
                });
              }
            }
          }, 100); // Delay untuk memastikan setData() selesai
        }

        // 🔄 STEP 7: Update pagination info
        const hasNext = response.pagination?.next?.url != null;
        nextUrlRef.current = response.pagination?.next?.url || null;
        hasMoreDataRef.current = hasNext;

        setPageInfo({
          currentPage: response.page,
          totalPages: response.totalPages,
          nextUrl: response.pagination?.next?.url || null,
          prevUrl: response.pagination?.prev?.url || null,
          isLoading: false,
          hasMore: hasNext,
        });

        console.log(
          `✅ Pagination updated: Page ${response.page}/${response.totalPages}, hasMore: ${hasNext}`
        );
      } else {
        console.log("⚠️ No more data available");
        hasMoreDataRef.current = false;
        setPageInfo((prev) => ({ ...prev, hasMore: false, isLoading: false }));

        // Re-enable autoscale jika fetch gagal
        if (chartRef.current) {
          chartRef.current.applyOptions({
            rightPriceScale: {
              autoScale: true,
            },
          });
        }
      }
    } catch (error) {
      console.error("❌ Error fetching more data:", error);
      setPageInfo((prev) => ({ ...prev, isLoading: false }));

      // Re-enable autoscale jika error
      if (chartRef.current) {
        chartRef.current.applyOptions({
          rightPriceScale: {
            autoScale: true,
          },
        });
      }
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [mergeCandlesData, allCandlesData]);

  // 🔥 INFINITE SCROLL: Setup pagination listener untuk detect scroll ke edge kiri
  const setupPaginationListener = useCallback(
    (chart, series) => {
      if (!chart || !series) {
        console.warn("⚠️ setupPaginationListener: chart or series is null");
        return;
      }

      const timeScale = chart.timeScale();

      const handleVisibleLogicalRangeChange = (logicalRange) => {
        if (!logicalRange) return;

        // 🔍 PERBAIKAN: Gunakan barsInLogicalRange untuk deteksi akurat
        const barsInfo = series.barsInLogicalRange(logicalRange);

        if (!barsInfo) {
          console.log("⚠️ barsInfo is null");
          return;
        }

        const { barsBefore, barsAfter } = barsInfo;

        // 📊 Debug logs untuk monitoring
        console.log(
          `📍 Scroll Position: barsBefore=${barsBefore}, barsAfter=${barsAfter}, from=${logicalRange.from.toFixed(
            2
          )}, to=${logicalRange.to.toFixed(2)}`
        );

        // 🎯 Deteksi jika user scroll mendekati edge kiri (older data)
        // barsBefore < 50 = ada kurang dari 50 candles sebelum visible range
        const isNearLeftEdge = barsBefore !== null && barsBefore < 50;

        if (
          isNearLeftEdge &&
          hasMoreDataRef.current &&
          !isLoadingMoreRef.current
        ) {
          console.log(
            `🟢 Trigger fetchMoreData() | barsBefore: ${barsBefore}, hasMore: ${hasMoreDataRef.current}, isLoading: ${isLoadingMoreRef.current}`
          );

          // Debounce dengan timer
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            console.log("🚀 Executing fetchMoreData()...");
            fetchMoreData();
          }, 300); // 300ms debounce
        } else {
          // Debug info kenapa tidak trigger
          if (!isNearLeftEdge) {
            console.log(`⏸️ Not near edge: barsBefore=${barsBefore} >= 50`);
          }
          if (!hasMoreDataRef.current) {
            console.log("⏸️ No more data available");
          }
          if (isLoadingMoreRef.current) {
            console.log("⏸️ Already loading...");
          }
        }
      };

      // Subscribe to logical range changes
      console.log("🎯 Subscribing to visible logical range changes...");
      const unsubscribe = timeScale.subscribeVisibleLogicalRangeChange(
        handleVisibleLogicalRangeChange
      );
      visibleRangeSubscriptionRef.current = unsubscribe;

      // Test initial state
      const initialRange = timeScale.getVisibleLogicalRange();
      if (initialRange) {
        const initialBarsInfo = series.barsInLogicalRange(initialRange);
        console.log(
          `📊 Initial bars: barsBefore=${initialBarsInfo?.barsBefore}, barsAfter=${initialBarsInfo?.barsAfter}`
        );
      }

      return unsubscribe;
    },
    [fetchMoreData]
  );

  // 🔥 INFINITE SCROLL: Effect untuk load initial data dan setup pagination
  useEffect(() => {
    if (!candlesData?.success || !candlesData.data?.length) return;

    console.log(`📊 Initial data loaded: ${candlesData.data.length} candles`);
    console.log(`📄 Page ${candlesData.page}/${candlesData.totalPages}`);

    // Set initial data
    setAllCandlesData(candlesData.data);

    // Update pagination info dari response
    const hasNext = candlesData.pagination?.next?.url != null;
    nextUrlRef.current = candlesData.pagination?.next?.url || null;
    hasMoreDataRef.current = hasNext;

    setPageInfo({
      currentPage: candlesData.page || 1,
      totalPages: candlesData.totalPages || 1,
      nextUrl: candlesData.pagination?.next?.url || null,
      prevUrl: candlesData.pagination?.prev?.url || null,
      isLoading: false,
      hasMore: hasNext,
    });

    console.log(
      `🔗 Next URL: ${candlesData.pagination?.next?.url ? "Available" : "None"}`
    );
    console.log(`📊 Has more data: ${hasNext}`);
  }, [candlesData]);

  // 🔥 INFINITE SCROLL: Setup pagination listener ketika chart ready
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    console.log("🎯 Setting up pagination listener...");
    const cleanup = setupPaginationListener(
      chartRef.current,
      seriesRef.current
    );

    return () => {
      if (cleanup) cleanup();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [setupPaginationListener]);

  // 🔥 INFINITE SCROLL: Update chart data ketika allCandlesData berubah
  useEffect(() => {
    if (!seriesRef.current || !allCandlesData.length) return;

    console.log(
      `📈 Updating chart with ${allCandlesData.length} total candles`
    );

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

    // Update data range untuk limit zoom
    if (chartData.length > 0) {
      dataRangeRef.current = {
        minTime: chartData[0].time,
        maxTime: chartData[chartData.length - 1].time,
      };
    }

    // Fit content hanya untuk initial load, tidak untuk pagination
    if (
      chartRef.current &&
      allCandlesData.length === candlesData?.data?.length
    ) {
      chartRef.current.timeScale().fitContent();
      const visibleRange = chartRef.current.timeScale().getVisibleRange();
      if (visibleRange) {
        currentVisibleRangeRef.current = visibleRange;
      }
    }
  }, [allCandlesData, candlesData?.data?.length]);

  // Available indicators - pisahkan overlay dan oscillator
  const overlayIndicators = [
    {
      id: "sma",
      label: "SMA (20, 50)",
      color: "#2962FF",
      type: "sma",
      periods: [20, 50],
      colors: ["#2962FF", "#4A90E2"], // Warna utama dan warna lebih terang
    },
    {
      id: "ema",
      label: "EMA (20, 50)",
      color: "#9C27B0",
      type: "ema",
      periods: [20, 50],
      colors: ["#9C27B0", "#BA68C8"], // Warna utama dan warna lebih terang
    },
    {
      id: "bollinger",
      label: "Bollinger B. (20, 2)",
      color: "#00BCD4",
      type: "bollinger",
    },
    {
      id: "psar",
      label: "PSAR (0.02 / 0.2)",
      color: "#FF5722",
      type: "psar",
    },
  ];

  const oscillatorIndicators = [
    { id: "rsi", label: "RSI (14)", color: "#FF6D00", type: "rsi" },
    { id: "macd", label: "MACD (12, 26, 9)", color: "#00C853", type: "macd" },
    {
      id: "stochastic",
      label: "Stochastic (14, 3)",
      color: "#4CAF50",
      type: "stochastic",
    },
    {
      id: "stochasticRsi",
      label: "Stochastic RSI",
      color: "#FFC107",
      type: "stochasticRsi",
    },
  ];

  const availableIndicators = [...overlayIndicators, ...oscillatorIndicators];

  // Get latest candle data for indicator values
  const latestCandle =
    candlesData?.success && candlesData.data?.length > 0
      ? candlesData.data[0]
      : null;

  const formatPrice = (price) => {
    if (!price && price !== 0) return "N/A";
    if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return num.toFixed(2);
  };

  const formatVolume = (volume) => {
    if (!volume && volume !== 0) return "N/A";
    if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(2)}B`;
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  const topCoins = marketCapData?.success ? marketCapData.data.slice(0, 5) : [];

  // Initialize main chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Tentukan apakah ini chart terakhir (untuk menampilkan timeScale)
    const hasOscillators = activeIndicators.some((ind) =>
      ["rsi", "macd", "stochastic", "stochasticRsi"].includes(ind)
    );

    // Calculate responsive width dengan memperhitungkan padding
    const containerWidth = chartContainerRef.current.clientWidth;
    const responsiveWidth = Math.max(containerWidth - 20, 300); // Minimum width 300px, subtract padding

    const chartOptions = getBaseChartOptions(500, true);
    chartOptions.width = responsiveWidth;

    const chart = createChart(chartContainerRef.current, chartOptions);

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Setup chart sync
    const cleanupSync = setupChartSync(chart, "main");

    const handleResize = () => {
      const newContainerWidth = chartContainerRef.current.clientWidth;
      const newResponsiveWidth = Math.max(newContainerWidth - 20, 300);
      chart.applyOptions({ width: newResponsiveWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      if (cleanupSync) cleanupSync();
    };
  }, [isDarkMode]);

  // Initialize RSI chart
  useEffect(() => {
    if (!activeIndicators.includes("rsi")) {
      // Cleanup jika RSI di-remove
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
      return;
    }

    // Jangan buat chart baru jika sudah ada
    if (rsiChartRef.current) return;

    if (!rsiContainerRef.current) return;

    console.log("Creating RSI chart..."); // Debug log

    // Cek apakah ini chart terakhir
    const isLastChart =
      !activeIndicators.includes("stochastic") &&
      !activeIndicators.includes("stochasticRsi") &&
      !activeIndicators.includes("macd");

    try {
      const chart = createChart(
        rsiContainerRef.current,
        getBaseChartOptions(150, isLastChart)
      );

      const rsiSeries = chart.addLineSeries({
        color: "#FF6D00",
        lineWidth: 2,
        title: "RSI (14)",
      });

      rsiChartRef.current = chart;
      rsiSeriesRef.current = rsiSeries;

      console.log("RSI chart created successfully"); // Debug log

      // Setup chart sync
      setupChartSync(chart, "RSI");

      // Panggil syncAllCharts setelah chart dibuat
      setTimeout(() => {
        syncAllCharts(chartRef.current, true);
      }, 100);

      const handleResize = () => {
        if (rsiContainerRef.current && chart) {
          chart.applyOptions({ width: rsiContainerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);

      // Cleanup function
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      console.error("Error creating RSI chart:", error);
    }
  }, [activeIndicators, isDarkMode]);

  // Initialize Stochastic chart
  useEffect(() => {
    if (!activeIndicators.includes("stochastic")) {
      // Cleanup jika Stochastic di-remove
      if (stochasticChartRef.current) {
        stochasticChartRef.current.remove();
        stochasticChartRef.current = null;
        stochasticKSeriesRef.current = null;
        stochasticDSeriesRef.current = null;
      }
      return;
    }

    // Jangan buat chart baru jika sudah ada
    if (stochasticChartRef.current) return;

    if (!stochasticContainerRef.current) return;

    console.log("Creating Stochastic chart..."); // Debug log

    // Cek apakah ini chart terakhir
    const isLastChart =
      !activeIndicators.includes("stochasticRsi") &&
      !activeIndicators.includes("macd");

    try {
      const chart = createChart(
        stochasticContainerRef.current,
        getBaseChartOptions(150, isLastChart)
      );

      const kSeries = chart.addLineSeries({
        color: "#4CAF50",
        lineWidth: 2,
        title: "Stochastic %K",
      });

      const dSeries = chart.addLineSeries({
        color: "#2196F3",
        lineWidth: 2,
        title: "Stochastic %D",
      });

      stochasticChartRef.current = chart;
      stochasticKSeriesRef.current = kSeries;
      stochasticDSeriesRef.current = dSeries;

      console.log("Stochastic chart created successfully"); // Debug log

      // Setup chart sync
      setupChartSync(chart, "Stochastic");

      // Panggil syncAllCharts setelah chart dibuat
      setTimeout(() => {
        syncAllCharts(chartRef.current, true);
      }, 100);

      const handleResize = () => {
        if (stochasticContainerRef.current && chart) {
          chart.applyOptions({
            width: stochasticContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);

      // Cleanup function
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      console.error("Error creating Stochastic chart:", error);
    }
  }, [activeIndicators, isDarkMode]);

  // Initialize Stochastic RSI chart
  useEffect(() => {
    if (!activeIndicators.includes("stochasticRsi")) {
      // Cleanup jika Stochastic RSI di-remove
      if (stochRsiChartRef.current) {
        stochRsiChartRef.current.remove();
        stochRsiChartRef.current = null;
        stochRsiKSeriesRef.current = null;
        stochRsiDSeriesRef.current = null;
      }
      return;
    }

    // Jangan buat chart baru jika sudah ada
    if (stochRsiChartRef.current) return;

    if (!stochRsiContainerRef.current) return;

    console.log("Creating Stochastic RSI chart..."); // Debug log

    // Cek apakah ini chart terakhir
    const isLastChart = !activeIndicators.includes("macd");

    try {
      const chart = createChart(
        stochRsiContainerRef.current,
        getBaseChartOptions(150, isLastChart)
      );

      const kSeries = chart.addLineSeries({
        color: "#FFC107",
        lineWidth: 2,
        title: "Stoch RSI %K",
      });

      const dSeries = chart.addLineSeries({
        color: "#FF9800",
        lineWidth: 2,
        title: "Stoch RSI %D",
      });

      stochRsiChartRef.current = chart;
      stochRsiKSeriesRef.current = kSeries;
      stochRsiDSeriesRef.current = dSeries;

      console.log("Stochastic RSI chart created successfully"); // Debug log

      // Setup chart sync
      setupChartSync(chart, "Stochastic RSI");

      // Panggil syncAllCharts setelah chart dibuat
      setTimeout(() => {
        syncAllCharts(chartRef.current, true);
      }, 100);

      const handleResize = () => {
        if (stochRsiContainerRef.current && chart) {
          chart.applyOptions({
            width: stochRsiContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);

      // Cleanup function
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      console.error("Error creating Stochastic RSI chart:", error);
    }
  }, [activeIndicators, isDarkMode]);

  // Initialize MACD chart
  useEffect(() => {
    if (!activeIndicators.includes("macd")) {
      // Cleanup jika MACD di-remove
      if (macdChartRef.current) {
        macdChartRef.current.remove();
        macdChartRef.current = null;
        macdLineSeriesRef.current = null;
        macdSignalSeriesRef.current = null;
        macdHistogramSeriesRef.current = null;
      }
      return;
    }

    // Jangan buat chart baru jika sudah ada
    if (macdChartRef.current) return;

    if (!macdContainerRef.current) return;

    console.log("Creating MACD chart..."); // Debug log

    try {
      // MACD selalu jadi chart terakhir (menampilkan timeScale)
      const chart = createChart(
        macdContainerRef.current,
        getBaseChartOptions(150, true)
      );

      const macdLine = chart.addLineSeries({
        color: "#00C853",
        lineWidth: 2,
        title: "MACD",
      });

      const signalLine = chart.addLineSeries({
        color: "#FF5722",
        lineWidth: 2,
        title: "Signal",
      });

      const histogram = chart.addHistogramSeries({
        color: "#2196F3",
        title: "Histogram",
      });

      macdChartRef.current = chart;
      macdLineSeriesRef.current = macdLine;
      macdSignalSeriesRef.current = signalLine;
      macdHistogramSeriesRef.current = histogram;

      console.log("MACD chart created successfully"); // Debug log

      // Setup chart sync
      setupChartSync(chart, "MACD");

      // Panggil syncAllCharts setelah chart dibuat
      setTimeout(() => {
        syncAllCharts(chartRef.current, true);
      }, 100);

      const handleResize = () => {
        if (macdContainerRef.current && chart) {
          chart.applyOptions({ width: macdContainerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);

      // Cleanup function
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      console.error("Error creating MACD chart:", error);
    }
  }, [activeIndicators, isDarkMode]);

  // 🔥 PAGINATION FIX: Update RSI chart data dari allCandlesData
  useEffect(() => {
    if (
      !rsiSeriesRef.current ||
      !allCandlesData.length ||
      !activeIndicators.includes("rsi")
    ) {
      return;
    }

    const rsiData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.rsi?.[14],
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    if (rsiData.length > 0) {
      rsiSeriesRef.current.setData(rsiData);
      console.log(`📊 RSI updated: ${rsiData.length} points`);
    }
  }, [allCandlesData, activeIndicators]);

  // 🔥 PAGINATION FIX: Update Stochastic chart data dari allCandlesData
  useEffect(() => {
    if (
      !stochasticKSeriesRef.current ||
      !allCandlesData.length ||
      !activeIndicators.includes("stochastic")
    ) {
      return;
    }

    const kData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.stochastic?.["%K"],
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    const dData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.stochastic?.["%D"],
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    if (kData.length > 0) {
      stochasticKSeriesRef.current.setData(kData);
      stochasticDSeriesRef.current.setData(dData);
      console.log(`📊 Stochastic updated: ${kData.length} points`);
    }
  }, [allCandlesData, activeIndicators]);

  // 🔥 PAGINATION FIX: Update Stochastic RSI chart data dari allCandlesData
  useEffect(() => {
    if (
      !stochRsiKSeriesRef.current ||
      !allCandlesData.length ||
      !activeIndicators.includes("stochasticRsi")
    ) {
      return;
    }

    const kData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.stochasticRsi?.["%K"],
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    const dData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.stochasticRsi?.["%D"],
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    if (kData.length > 0) {
      stochRsiKSeriesRef.current.setData(kData);
      stochRsiDSeriesRef.current.setData(dData);
      console.log(`📊 Stochastic RSI updated: ${kData.length} points`);
    }
  }, [allCandlesData, activeIndicators]);

  // 🔥 PAGINATION FIX: Update MACD chart data dari allCandlesData
  useEffect(() => {
    if (
      !macdLineSeriesRef.current ||
      !allCandlesData.length ||
      !activeIndicators.includes("macd")
    ) {
      return;
    }

    const macdData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.macd?.macd,
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    const signalData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: parseFloat(d.indicators?.macd?.signalLine),
      }))
      .filter(
        (d) => d.value !== null && d.value !== undefined && !isNaN(d.value)
      )
      .sort((a, b) => a.time - b.time);

    const histogramData = allCandlesData
      .map((d) => ({
        time: Number(d.time) / 1000,
        value: d.indicators?.macd?.histogram,
        color: d.indicators?.macd?.histogram >= 0 ? "#26a69a" : "#ef5350",
      }))
      .filter((d) => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.time - b.time);

    if (macdData.length > 0) {
      macdLineSeriesRef.current.setData(macdData);
      macdSignalSeriesRef.current.setData(signalData);
      macdHistogramSeriesRef.current.setData(histogramData);
      console.log(`📊 MACD updated: ${macdData.length} points`);
    }
  }, [allCandlesData, activeIndicators]);

  // 🔥 PAGINATION FIX: Update overlay indicators dari allCandlesData
  useEffect(() => {
    if (!chartRef.current || !allCandlesData.length) return;

    // Clear existing overlay indicator series
    Object.values(indicatorSeriesRef.current).forEach((series) => {
      if (Array.isArray(series)) {
        series.forEach((s) => chartRef.current.removeSeries(s));
      } else if (series) {
        chartRef.current.removeSeries(series);
      }
    });
    indicatorSeriesRef.current = {};

    // Add active overlay indicators to chart
    overlayIndicators.forEach((indicator) => {
      if (!activeIndicators.includes(indicator.id)) return;

      // Check jika indikator memiliki multiple periods (SMA/EMA)
      if (indicator.periods && indicator.colors) {
        const seriesArray = [];

        indicator.periods.forEach((period, index) => {
          const chartData = allCandlesData
            .map((d) => ({
              time: Number(d.time) / 1000,
              value: getIndicatorValueByPeriod(d, indicator.type, period),
            }))
            .filter((d) => d.value !== null && d.value !== undefined)
            .sort((a, b) => a.time - b.time);

          if (chartData.length > 0) {
            const lineSeries = chartRef.current.addLineSeries({
              color: indicator.colors[index],
              lineWidth: 2,
              title: `${indicator.type.toUpperCase()} ${period}`,
            });
            lineSeries.setData(chartData);
            seriesArray.push(lineSeries);
          }
        });

        indicatorSeriesRef.current[indicator.id] = seriesArray;
      } else {
        // Single series untuk Bollinger Bands dan PSAR
        const chartData = allCandlesData
          .map((d) => ({
            time: Number(d.time) / 1000,
            value: getIndicatorValue(d, indicator.type),
          }))
          .filter((d) => d.value !== null && d.value !== undefined)
          .sort((a, b) => a.time - b.time);

        if (chartData.length > 0) {
          const lineSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: indicator.label,
          });
          lineSeries.setData(chartData);
          indicatorSeriesRef.current[indicator.id] = lineSeries;
        }
      }
    });

    console.log(
      `📊 Overlay indicators updated from ${allCandlesData.length} candles`
    );
  }, [activeIndicators, allCandlesData]);

  // Update main chart data
  useEffect(() => {
    if (
      candlesData?.success &&
      seriesRef.current &&
      Array.isArray(candlesData.data)
    ) {
      const chartData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          open: Number(d.open),
          high: Number(d.high),
          low: Number(d.low),
          close: Number(d.close),
        }))
        .sort((a, b) => a.time - b.time);

      seriesRef.current.setData(chartData);

      // Update data range untuk limit zoom
      if (chartData.length > 0) {
        dataRangeRef.current = {
          minTime: chartData[0].time,
          maxTime: chartData[chartData.length - 1].time,
        };
      }

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
        // Simpan visible range setelah fitContent
        const visibleRange = chartRef.current.timeScale().getVisibleRange();
        if (visibleRange) {
          currentVisibleRangeRef.current = visibleRange;
        }
      }
    }
  }, [candlesData]);

  // Effect untuk sync semua chart saat data berubah atau indikator ditambah
  useEffect(() => {
    // Tunggu semua chart siap
    const timer = setTimeout(() => {
      const allCharts = [
        chartRef.current,
        rsiChartRef.current,
        stochasticChartRef.current,
        stochRsiChartRef.current,
        macdChartRef.current,
      ].filter(Boolean);

      if (allCharts.length > 0 && chartRef.current) {
        const mainTimeScale = chartRef.current.timeScale();
        const visibleRange =
          currentVisibleRangeRef.current || mainTimeScale.getVisibleRange();

        if (visibleRange) {
          // Sync ke semua chart indikator
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
    }, 100); // Delay kecil untuk memastikan semua chart sudah ter-render

    return () => clearTimeout(timer);
  }, [candlesData, activeIndicators]);

  // Update RSI chart data
  useEffect(() => {
    if (
      candlesData?.success &&
      rsiSeriesRef.current &&
      activeIndicators.includes("rsi")
    ) {
      const rsiData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.rsi?.[14],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (rsiData.length > 0) {
        rsiSeriesRef.current.setData(rsiData);
        if (rsiChartRef.current) {
          rsiChartRef.current.timeScale().fitContent();
        }
      }
    }
  }, [candlesData, activeIndicators]);

  // Update Stochastic chart data
  useEffect(() => {
    if (
      candlesData?.success &&
      stochasticKSeriesRef.current &&
      activeIndicators.includes("stochastic")
    ) {
      const kData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochastic?.["%K"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const dData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochastic?.["%D"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (kData.length > 0) {
        stochasticKSeriesRef.current.setData(kData);
        stochasticDSeriesRef.current.setData(dData);
        if (stochasticChartRef.current) {
          stochasticChartRef.current.timeScale().fitContent();
        }
      }
    }
  }, [candlesData, activeIndicators]);

  // Update Stochastic RSI chart data
  useEffect(() => {
    if (
      candlesData?.success &&
      stochRsiKSeriesRef.current &&
      activeIndicators.includes("stochasticRsi")
    ) {
      const kData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochasticRsi?.["%K"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const dData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochasticRsi?.["%D"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (kData.length > 0) {
        stochRsiKSeriesRef.current.setData(kData);
        stochRsiDSeriesRef.current.setData(dData);
        if (stochRsiChartRef.current) {
          stochRsiChartRef.current.timeScale().fitContent();
        }
      }
    }
  }, [candlesData, activeIndicators]);

  // Update MACD chart data
  useEffect(() => {
    if (
      candlesData?.success &&
      macdLineSeriesRef.current &&
      activeIndicators.includes("macd")
    ) {
      const macdData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.macd?.macd,
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const signalData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: parseFloat(d.indicators?.macd?.signalLine),
        }))
        .filter(
          (d) => d.value !== null && d.value !== undefined && !isNaN(d.value)
        )
        .sort((a, b) => a.time - b.time);

      const histogramData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.macd?.histogram,
          color: d.indicators?.macd?.histogram >= 0 ? "#26a69a" : "#ef5350",
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (macdData.length > 0) {
        macdLineSeriesRef.current.setData(macdData);
        macdSignalSeriesRef.current.setData(signalData);
        macdHistogramSeriesRef.current.setData(histogramData);
        if (macdChartRef.current) {
          macdChartRef.current.timeScale().fitContent();
        }
      }
    }
  }, [candlesData, activeIndicators]);

  // Effect khusus untuk memuat data ke chart indikator yang baru dibuat
  useEffect(() => {
    // Load data ke RSI chart jika sudah dibuat
    if (
      candlesData?.success &&
      rsiSeriesRef.current &&
      rsiChartRef.current &&
      activeIndicators.includes("rsi")
    ) {
      const rsiData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.rsi?.[14],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (rsiData.length > 0) {
        rsiSeriesRef.current.setData(rsiData);
        console.log("RSI data loaded:", rsiData.length, "points");

        // Sync dengan chart utama
        if (chartRef.current && currentVisibleRangeRef.current) {
          try {
            rsiChartRef.current
              .timeScale()
              .setVisibleRange(currentVisibleRangeRef.current);
          } catch (e) {
            rsiChartRef.current.timeScale().fitContent();
          }
        }
      }
    }

    // Load data ke Stochastic chart jika sudah dibuat
    if (
      candlesData?.success &&
      stochasticKSeriesRef.current &&
      stochasticChartRef.current &&
      activeIndicators.includes("stochastic")
    ) {
      const kData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochastic?.["%K"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const dData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochastic?.["%D"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (kData.length > 0) {
        stochasticKSeriesRef.current.setData(kData);
        stochasticDSeriesRef.current.setData(dData);
        console.log("Stochastic data loaded:", kData.length, "points");

        // Sync dengan chart utama
        if (chartRef.current && currentVisibleRangeRef.current) {
          try {
            stochasticChartRef.current
              .timeScale()
              .setVisibleRange(currentVisibleRangeRef.current);
          } catch (e) {
            stochasticChartRef.current.timeScale().fitContent();
          }
        }
      }
    }

    // Load data ke Stochastic RSI chart jika sudah dibuat
    if (
      candlesData?.success &&
      stochRsiKSeriesRef.current &&
      stochRsiChartRef.current &&
      activeIndicators.includes("stochasticRsi")
    ) {
      const kData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochasticRsi?.["%K"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const dData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.stochasticRsi?.["%D"],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (kData.length > 0) {
        stochRsiKSeriesRef.current.setData(kData);
        stochRsiDSeriesRef.current.setData(dData);
        console.log("Stochastic RSI data loaded:", kData.length, "points");

        // Sync dengan chart utama
        if (chartRef.current && currentVisibleRangeRef.current) {
          try {
            stochRsiChartRef.current
              .timeScale()
              .setVisibleRange(currentVisibleRangeRef.current);
          } catch (e) {
            stochRsiChartRef.current.timeScale().fitContent();
          }
        }
      }
    }

    // Load data ke MACD chart jika sudah dibuat
    if (
      candlesData?.success &&
      macdLineSeriesRef.current &&
      macdChartRef.current &&
      activeIndicators.includes("macd")
    ) {
      const macdData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.macd?.macd,
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      const signalData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: parseFloat(d.indicators?.macd?.signalLine),
        }))
        .filter(
          (d) => d.value !== null && d.value !== undefined && !isNaN(d.value)
        )
        .sort((a, b) => a.time - b.time);

      const histogramData = candlesData.data
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.macd?.histogram,
          color: d.indicators?.macd?.histogram >= 0 ? "#26a69a" : "#ef5350",
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      if (macdData.length > 0) {
        macdLineSeriesRef.current.setData(macdData);
        macdSignalSeriesRef.current.setData(signalData);
        macdHistogramSeriesRef.current.setData(histogramData);
        console.log("MACD data loaded:", macdData.length, "points");

        // Sync dengan chart utama
        if (chartRef.current && currentVisibleRangeRef.current) {
          try {
            macdChartRef.current
              .timeScale()
              .setVisibleRange(currentVisibleRangeRef.current);
          } catch (e) {
            macdChartRef.current.timeScale().fitContent();
          }
        }
      }
    }
  }, [candlesData, activeIndicators]);

  // Toggle indicator
  const toggleIndicator = (indicatorId) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  // Update overlay indicators on main chart
  useEffect(() => {
    if (!chartRef.current || !candlesData?.success) return;

    // Clear existing overlay indicator series
    Object.values(indicatorSeriesRef.current).forEach((series) => {
      if (Array.isArray(series)) {
        // Jika series adalah array (untuk SMA/EMA dengan multiple periods)
        series.forEach((s) => chartRef.current.removeSeries(s));
      } else if (series) {
        // Jika series adalah single series
        chartRef.current.removeSeries(series);
      }
    });
    indicatorSeriesRef.current = {};

    // Add active overlay indicators to chart
    overlayIndicators.forEach((indicator) => {
      if (!activeIndicators.includes(indicator.id)) return;

      // Check jika indikator memiliki multiple periods (SMA/EMA)
      if (indicator.periods && indicator.colors) {
        const seriesArray = [];

        indicator.periods.forEach((period, index) => {
          const chartData = candlesData.data
            .map((d) => ({
              time: Number(d.time) / 1000,
              value: getIndicatorValueByPeriod(d, indicator.type, period),
            }))
            .filter((d) => d.value !== null && d.value !== undefined)
            .sort((a, b) => a.time - b.time);

          if (chartData.length > 0) {
            const lineSeries = chartRef.current.addLineSeries({
              color: indicator.colors[index],
              lineWidth: 2,
              title: `${indicator.type.toUpperCase()} ${period}`,
            });
            lineSeries.setData(chartData);
            seriesArray.push(lineSeries);
          }
        });

        indicatorSeriesRef.current[indicator.id] = seriesArray;
      } else {
        // Single series untuk Bollinger Bands dan PSAR
        const chartData = candlesData.data
          .map((d) => ({
            time: Number(d.time) / 1000,
            value: getIndicatorValue(d, indicator.type),
          }))
          .filter((d) => d.value !== null && d.value !== undefined)
          .sort((a, b) => a.time - b.time);

        if (chartData.length > 0) {
          const lineSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: indicator.label,
          });
          lineSeries.setData(chartData);
          indicatorSeriesRef.current[indicator.id] = lineSeries;
        }
      }
    });
  }, [activeIndicators, candlesData]);

  // Get indicator value from candle data (for overlay indicators)
  const getIndicatorValue = (candle, type) => {
    if (!candle.indicators) return null;

    switch (type) {
      case "sma":
        return candle.indicators.sma?.[20]; // Default period 20
      case "ema":
        return candle.indicators.ema?.[20]; // Default period 20
      case "bollinger":
        return candle.indicators.bollingerBands?.upper;
      case "psar":
        return candle.indicators.parabolicSar?.value;
      default:
        return null;
    }
  };

  // Fungsi baru untuk mendapatkan nilai indikator berdasarkan periode tertentu
  const getIndicatorValueByPeriod = (candle, type, period) => {
    if (!candle.indicators) return null;

    switch (type) {
      case "sma":
        return candle.indicators.sma?.[period];
      case "ema":
        return candle.indicators.ema?.[period];
      default:
        return null;
    }
  };

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

          {/* OHLCV Card - Data Candle */}
          {latestCandle && !candlesLoading && (
            <div
              className={`mb-4 p-4 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-900 border-gray-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Open */}
                <div>
                  <div
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Open
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {formatPrice(latestCandle.open)}
                  </div>
                </div>

                {/* High */}
                <div>
                  <div
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    High
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${
                      isDarkMode ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    {formatPrice(latestCandle.high)}
                  </div>
                </div>

                {/* Low */}
                <div>
                  <div
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Low
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${
                      isDarkMode ? "text-red-400" : "text-red-600"
                    }`}
                  >
                    {formatPrice(latestCandle.low)}
                  </div>
                </div>

                {/* Close */}
                <div>
                  <div
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Close
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${
                      latestCandle.close >= latestCandle.open
                        ? isDarkMode
                          ? "text-green-400"
                          : "text-green-600"
                        : isDarkMode
                        ? "text-red-400"
                        : "text-red-600"
                    }`}
                  >
                    {formatPrice(latestCandle.close)}
                  </div>
                </div>

                {/* Volume */}
                <div>
                  <div
                    className={`text-xs mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Volume
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    {formatVolume(latestCandle.volume)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            ref={chartContainerRef}
            className="main-chart-container chart-sync-container"
          />

          {/* Oscillator Charts di bawah chart utama */}
          {activeIndicators.includes("rsi") && (
            <div className="mt-4 chart-wrapper">
              <div className="chart-label">RSI (14)</div>
              <div
                ref={rsiContainerRef}
                className="indicator-chart-container chart-sync-container"
              />
            </div>
          )}

          {activeIndicators.includes("stochastic") && (
            <div className="mt-4 chart-wrapper">
              <div className="chart-label">Stochastic (14, 3)</div>
              <div
                ref={stochasticContainerRef}
                className="indicator-chart-container chart-sync-container"
              />
            </div>
          )}

          {activeIndicators.includes("stochasticRsi") && (
            <div className="mt-4 chart-wrapper">
              <div className="chart-label">Stochastic RSI</div>
              <div
                ref={stochRsiContainerRef}
                className="indicator-chart-container chart-sync-container"
              />
            </div>
          )}

          {activeIndicators.includes("macd") && (
            <div className="mt-4 chart-wrapper">
              <div className="chart-label">MACD (12, 26, 9)</div>
              <div
                ref={macdContainerRef}
                className="indicator-chart-container chart-sync-container"
              />
            </div>
          )}
        </div>
      </div>

      {/* Technical Indicators Toggle Panel */}
      <div className="card">
        <div className={`card-body ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <h4
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Technical Indicators
              </h4>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Toggle Panel - 8 Indicators Available
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {availableIndicators.map((indicator) => (
              <button
                key={indicator.id}
                onClick={() => toggleIndicator(indicator.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeIndicators.includes(indicator.id)
                    ? isDarkMode
                      ? "bg-blue-900 text-blue-300 border-2 border-blue-700 shadow-sm"
                      : "bg-blue-100 text-blue-600 border-2 border-blue-300 shadow-sm"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: indicator.color }}
                  ></div>
                  <span className="truncate">{indicator.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Indicators Values */}
      {activeIndicators.length > 0 && latestCandle && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeIndicators.map((indicatorId) => {
            const indicator = availableIndicators.find(
              (i) => i.id === indicatorId
            );
            if (!indicator) return null;

            const indicators = latestCandle.indicators;

            return (
              <div
                key={indicatorId}
                className={`card-body ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } rounded-lg border `}
              >
                <div
                  className={`card-body ${
                    isDarkMode ? "bg-gray-800" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: indicator.color + "20" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      ></div>
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={`font-semibold text-sm truncate ${
                          isDarkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {indicator.label}
                      </h3>
                      <p
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        Real-time values
                      </p>
                    </div>
                  </div>

                  {/* SMA Values */}
                  {indicator.type === "sma" && indicators?.sma && (
                    <div className="space-y-2">
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-blue-900" : "bg-blue-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          SMA 20:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-blue-300" : "text-blue-700"
                          }`}
                        >
                          {formatPrice(indicators.sma[20])}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-blue-900" : "bg-blue-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          SMA 50:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-blue-300" : "text-blue-700"
                          }`}
                        >
                          {formatPrice(indicators.sma[50])}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* EMA Values */}
                  {indicator.type === "ema" && indicators?.ema && (
                    <div className="space-y-2">
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-purple-900" : "bg-purple-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          EMA 20:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-purple-300" : "text-purple-700"
                          }`}
                        >
                          {formatPrice(indicators.ema[20])}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-purple-900" : "bg-purple-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          EMA 50:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-purple-300" : "text-purple-700"
                          }`}
                        >
                          {formatPrice(indicators.ema[50])}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* RSI Values */}
                  {indicator.type === "rsi" && indicators?.rsi && (
                    <div className="text-center">
                      <div
                        className="text-3xl font-black mb-2"
                        style={{ color: indicator.color }}
                      >
                        {formatNumber(indicators.rsi[14])}
                      </div>
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          indicators.rsi[14] > 70
                            ? isDarkMode
                              ? "bg-red-900 text-red-300"
                              : "bg-red-100 text-red-700"
                            : indicators.rsi[14] < 30
                            ? isDarkMode
                              ? "bg-green-900 text-green-300"
                              : "bg-green-100 text-green-700"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {indicators.rsi[14] > 70
                          ? "Overbought"
                          : indicators.rsi[14] < 30
                          ? "Oversold"
                          : "Neutral"}
                      </div>
                    </div>
                  )}

                  {/* MACD Values */}
                  {indicator.type === "macd" && indicators?.macd && (
                    <div className="space-y-2">
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Fast:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-green-300" : "text-green-700"
                          }`}
                        >
                          {indicators.macd.fast}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Slow:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-green-300" : "text-green-700"
                          }`}
                        >
                          {indicators.macd.slow}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Signal:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-green-300" : "text-green-700"
                          }`}
                        >
                          {indicators.macd.signal}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          MACD:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-green-300" : "text-green-700"
                          }`}
                        >
                          {formatNumber(indicators.macd.macd)}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Signal Line:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-green-300" : "text-green-700"
                          }`}
                        >
                          {indicators.macd.signalLine}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-green-900" : "bg-green-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Histogram:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            indicators.macd.histogram >= 0
                              ? isDarkMode
                                ? "text-green-300"
                                : "text-green-700"
                              : isDarkMode
                              ? "text-red-300"
                              : "text-red-700"
                          }`}
                        >
                          {formatNumber(indicators.macd.histogram)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bollinger Bands Values */}
                  {indicator.type === "bollinger" &&
                    indicators?.bollingerBands && (
                      <div className="space-y-2">
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-cyan-900" : "bg-cyan-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-cyan-300" : "text-cyan-700"
                            }`}
                          >
                            {indicators.bollingerBands.period}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-cyan-900" : "bg-cyan-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            Multiplier:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-cyan-300" : "text-cyan-700"
                            }`}
                          >
                            {indicators.bollingerBands.multiplier}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-cyan-900" : "bg-cyan-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            Upper:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-cyan-300" : "text-cyan-700"
                            }`}
                          >
                            {formatPrice(indicators.bollingerBands.upper)}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-cyan-900" : "bg-cyan-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            Lower:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-cyan-300" : "text-cyan-700"
                            }`}
                          >
                            {formatPrice(indicators.bollingerBands.lower)}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Stochastic Values */}
                  {indicator.type === "stochastic" &&
                    indicators?.stochastic && (
                      <div className="space-y-2">
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-green-900" : "bg-green-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            K Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-green-300" : "text-green-700"
                            }`}
                          >
                            {indicators.stochastic.kPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-green-900" : "bg-green-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            D Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-green-300" : "text-green-700"
                            }`}
                          >
                            {indicators.stochastic.dPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-green-900" : "bg-green-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            %K:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-green-300" : "text-green-700"
                            }`}
                          >
                            {formatNumber(indicators.stochastic["%K"])}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-green-900" : "bg-green-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            %D:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-green-300" : "text-green-700"
                            }`}
                          >
                            {formatNumber(indicators.stochastic["%D"])}
                          </span>
                        </div>
                        <div
                          className={`text-center text-xs font-medium mt-2 px-2 py-1 rounded-full ${
                            indicators.stochastic["%K"] > 80
                              ? isDarkMode
                                ? "bg-red-900 text-red-300"
                                : "bg-red-100 text-red-700"
                              : indicators.stochastic["%K"] < 20
                              ? isDarkMode
                                ? "bg-green-900 text-green-300"
                                : "bg-green-100 text-green-700"
                              : isDarkMode
                              ? "bg-gray-700 text-gray-300"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {indicators.stochastic["%K"] > 80
                            ? "Overbought"
                            : indicators.stochastic["%K"] < 20
                            ? "Oversold"
                            : "Neutral"}
                        </div>
                      </div>
                    )}

                  {/* Stochastic RSI Values */}
                  {indicator.type === "stochasticRsi" &&
                    indicators?.stochasticRsi && (
                      <div className="space-y-2">
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            RSI Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {indicators.stochasticRsi.rsiPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            Stoch Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {indicators.stochasticRsi.stochPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            K Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {indicators.stochasticRsi.kPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            D Period:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {indicators.stochasticRsi.dPeriod}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            %K:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {formatNumber(indicators.stochasticRsi["%K"])}
                          </span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            isDarkMode ? "bg-amber-900" : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            %D:
                          </span>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isDarkMode ? "text-amber-300" : "text-amber-700"
                            }`}
                          >
                            {formatNumber(indicators.stochasticRsi["%D"])}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* PSAR Values */}
                  {indicator.type === "psar" && indicators?.parabolicSar && (
                    <div className="space-y-2">
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-orange-900" : "bg-orange-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Step:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-orange-300" : "text-orange-700"
                          }`}
                        >
                          {indicators.parabolicSar.step}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          isDarkMode ? "bg-orange-900" : "bg-orange-50"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Max Step:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? "text-orange-300" : "text-orange-700"
                          }`}
                        >
                          {indicators.parabolicSar.maxStep}
                        </span>
                      </div>
                      <div className="text-center mt-2">
                        <div
                          className={`text-xs mb-1 ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          Current Value
                        </div>
                        <div
                          className="text-2xl font-black"
                          style={{ color: indicator.color }}
                        >
                          {formatPrice(indicators.parabolicSar.value)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top 5 Coins */}
      <div className="card">
        <div className={`card-body ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                <span className="text-lg">🪙</span>
              </div>
              <div>
                <h4
                  className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Top 5 Cryptocurrencies
                </h4>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Live market data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topCoins.map((coin, index) => {
              const change = coin.open
                ? ((coin.price - coin.open) / coin.open) * 100
                : 0;
              const isPositive = change >= 0;
              const gradients = [
                "from-yellow-500 to-orange-500",
                "from-gray-400 to-gray-600",
                "from-amber-600 to-amber-800",
                "from-blue-500 to-purple-500",
                "from-green-500 to-teal-500",
              ];

              return (
                <div
                  key={coin.symbol}
                  className={`p-4 rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 hover:scale-105 ${
                    isDarkMode
                      ? "bg-gray-900 border-gray-700"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={`w-6 h-6 bg-gradient-to-r ${gradients[index]} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {coin.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-semibold text-sm truncate ${
                          isDarkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {coin.name}
                      </div>
                      <div
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {coin.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className={`font-mono text-lg font-bold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {formatPrice(coin.price)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        24h:
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isPositive
                            ? isDarkMode
                              ? "bg-green-900 text-green-300"
                              : "bg-green-100 text-green-600"
                            : isDarkMode
                            ? "bg-red-900 text-red-300"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/marketcap"
              className={`inline-block px-4 py-2 text-sm font-medium rounded-lg shadow transition-colors ${
                isDarkMode
                  ? "bg-blue-900 text-blue-300 hover:bg-blue-800"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              View All Markets
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
