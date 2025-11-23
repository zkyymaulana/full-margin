import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { useDarkMode } from "../../contexts/DarkModeContext";
import {
  getBaseChartOptions,
  overlayIndicators,
  getIndicatorValueByPeriod,
  getIndicatorValue,
} from "../../utils/chartConfig";

/**
 * Main Chart Component
 * Displays candlestick chart with overlay indicators (SMA, EMA, Bollinger, PSAR)
 */
function MainChart({
  chartRef,
  seriesRef,
  allCandlesData,
  activeIndicators,
  chartSync,
  oscillatorChartsRef,
}) {
  const { isDarkMode } = useDarkMode();
  const chartContainerRef = useRef(null);
  const indicatorSeriesRef = useRef({});

  // Remove TradingView logos/watermarks - SAFE VERSION
  useEffect(() => {
    const removeTvLogo = () => {
      // ONLY remove actual TradingView logo images
      // DO NOT touch chart DOM elements (canvas, divs, etc.)
      document
        .querySelectorAll(
          'img[src*="tradingview"], img[alt*="TradingView"], img[alt*="tradingview"]'
        )
        .forEach((el) => {
          // Extra safety: only remove if it's actually an img element
          if (el.tagName === "IMG") {
            el.remove();
          }
        });
    };

    removeTvLogo();
    const interval = setInterval(removeTvLogo, 300);

    return () => clearInterval(interval);
  }, []);

  // Initialize main chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const containerWidth = chartContainerRef.current.clientWidth;
    const responsiveWidth = Math.max(containerWidth - 20, 300);

    const chartOptions = getBaseChartOptions(isDarkMode, 500, true);
    chartOptions.width = responsiveWidth;

    const chart = createChart(chartContainerRef.current, chartOptions);

    // ✅ Configure time formatting
    chart.applyOptions({
      watermark: {
        visible: false,
      },
      localization: {
        // 🕐 Format untuk crosshair tooltip SAJA (saat hover)
        // Output: "30 Okt 2025 14:00"
        timeFormatter: (time) => {
          const date = new Date(time * 1000);
          return date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        },
      },
      timeScale: {
        timeVisible: false, // ❌ Sembunyikan jam di time scale bawah
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        const newWidth = Math.max(
          chartContainerRef.current.clientWidth - 20,
          300
        );
        chart.applyOptions({ width: newWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    // Setup sync
    const allCharts = [
      chart,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);
    const cleanup = chartSync.setupChartSync(chart, allCharts, "main");

    return () => {
      window.removeEventListener("resize", handleResize);
      if (cleanup) cleanup();
      chart.remove();
    };
  }, [isDarkMode]);

  // Update overlay indicators
  useEffect(() => {
    if (!chartRef.current || !allCandlesData.length) return;

    // Clear existing overlay indicators
    Object.values(indicatorSeriesRef.current).forEach((series) => {
      if (Array.isArray(series)) {
        series.forEach((s) => chartRef.current.removeSeries(s));
      } else if (series) {
        chartRef.current.removeSeries(series);
      }
    });
    indicatorSeriesRef.current = {};

    // Add active overlay indicators
    overlayIndicators.forEach((indicator) => {
      if (!activeIndicators.includes(indicator.id)) return;

      if (indicator.periods && indicator.colors) {
        // Multiple periods (SMA/EMA)
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
      } else if (indicator.type === "bollinger") {
        // Bollinger Bands - Three separate lines (upper, middle, lower)
        const seriesArray = [];
        const bands = ["upper", "middle", "lower"];
        const labels = ["Upper", "Middle", "Lower"];

        bands.forEach((band, index) => {
          const chartData = allCandlesData
            .map((d) => ({
              time: Number(d.time) / 1000,
              value: d.indicators?.bollingerBands?.[band],
            }))
            .filter((d) => d.value !== null && d.value !== undefined)
            .sort((a, b) => a.time - b.time);

          if (chartData.length > 0) {
            const lineSeries = chartRef.current.addLineSeries({
              color: indicator.colors[index],
              lineWidth: 2,
              title: `BB ${labels[index]}`,
            });
            lineSeries.setData(chartData);
            seriesArray.push(lineSeries);
          }
        });

        indicatorSeriesRef.current[indicator.id] = seriesArray;
      } else if (indicator.type === "psar") {
        // Parabolic SAR - Render as dots (scatter points)
        const chartData = allCandlesData
          .map((d) => ({
            time: Number(d.time) / 1000,
            value: d.indicators?.parabolicSar?.value,
          }))
          .filter((d) => d.value !== null && d.value !== undefined)
          .sort((a, b) => a.time - b.time);

        if (chartData.length > 0) {
          // Create line series but configure as dots
          const dotSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 0, // No connecting line
            title: indicator.label,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            pointMarkersVisible: true,
          });

          // Apply additional options to ensure dots are visible
          dotSeries.applyOptions({
            lineStyle: 0,
            lineWidth: 0,
            crosshairMarkerRadius: 6,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          dotSeries.setData(chartData);
          indicatorSeriesRef.current[indicator.id] = dotSeries;
        }
      } else {
        // Fallback for other single series indicators
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

  // Update multi-indicator signal markers (BUY/SELL arrows)
  // ✅ ULTRA STRICT VALIDATION - Zero tolerance for non-DB signals
  useEffect(() => {
    if (!seriesRef.current || !allCandlesData.length) return;

    console.log("🔍 [MARKER SYNC] Starting validation...");
    console.log(`📊 Total candles received: ${allCandlesData.length}`);

    // 1️⃣ Filter ONLY DB-sourced signals (ultra strict validation)
    const validSignals = [];

    for (const candle of allCandlesData) {
      // ❌ Reject if no multiSignal at all
      if (!candle.multiSignal) {
        continue;
      }

      // ❌ Reject if source is not exactly "db"
      if (candle.multiSignal.source !== "db") {
        console.warn("⚠️ [REJECTED] Non-DB signal:", {
          time: new Date(Number(candle.time)).toISOString(),
          source: candle.multiSignal.source,
        });
        continue;
      }

      // ❌ CRITICAL: Reject ALL neutral signals
      if (candle.multiSignal.signal === "neutral") {
        // Don't even log this, it's expected behavior
        continue;
      }

      // ❌ Reject if signal is not exactly "buy" or "sell"
      if (
        candle.multiSignal.signal !== "buy" &&
        candle.multiSignal.signal !== "sell"
      ) {
        console.warn("⚠️ [REJECTED] Invalid signal value:", {
          time: new Date(Number(candle.time)).toISOString(),
          signal: candle.multiSignal.signal,
        });
        continue;
      }

      // ✅ Only accept if ALL conditions pass
      validSignals.push(candle);
    }

    console.log(
      `✅ [DB SIGNALS] ${validSignals.length} valid buy/sell signals from database`
    );
    console.log(
      `   Neutral signals filtered out: ${
        allCandlesData.filter((c) => c.multiSignal?.signal === "neutral").length
      }`
    );

    // 2️⃣ Sort by time ascending (oldest first)
    const sortedSignals = [...validSignals].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    // 3️⃣ Remove consecutive duplicates (keep only direction changes)
    const signalChanges = [];
    let previousSignal = null;

    sortedSignals.forEach((candle, index) => {
      const currentSignal = candle.multiSignal.signal;

      // Debug log for EVERY signal (not just first/last) to catch mismatch
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEBUG SIGNAL #${index}]`, {
          time: new Date(Number(candle.time)).toISOString(),
          timestamp: Number(candle.time),
          signal: currentSignal,
          source: candle.multiSignal.source,
          strength: candle.multiSignal.strength,
          rawSignal: candle.multiSignal.rawSignal,
          previous: previousSignal,
          willShow: currentSignal !== previousSignal,
        });
      }

      // Only add marker if signal CHANGED from previous
      if (currentSignal !== previousSignal) {
        signalChanges.push(candle);
        previousSignal = currentSignal;
      }
    });

    console.log(
      `📍 [SIGNAL CHANGES] ${signalChanges.length} direction changes detected`
    );
    console.log(
      `   BUY signals: ${
        signalChanges.filter((c) => c.multiSignal.signal === "buy").length
      }`
    );
    console.log(
      `   SELL signals: ${
        signalChanges.filter((c) => c.multiSignal.signal === "sell").length
      }`
    );

    // 4️⃣ Convert to lightweight-charts marker format
    const markers = signalChanges.map((c) => {
      const timeInSeconds = Number(c.time) / 1000; // ✅ Convert milliseconds to seconds
      const isBuy = c.multiSignal.signal === "buy";

      // ✅ VALIDATION: Ensure time is valid
      if (isNaN(timeInSeconds) || timeInSeconds <= 0) {
        console.error("❌ [INVALID TIME]", {
          original: c.time,
          converted: timeInSeconds,
        });
      }

      return {
        time: timeInSeconds,
        position: isBuy ? "belowBar" : "aboveBar",
        color: isBuy ? "#26a69a" : "#ef5350", // Green for BUY, Red for SELL
        shape: isBuy ? "arrowUp" : "arrowDown",
        text: isBuy ? "BUY" : "SELL",
      };
    });

    // 5️⃣ Apply markers to candlestick series
    seriesRef.current.setMarkers(markers);

    // 6️⃣ Final validation log
    if (markers.length > 0) {
      console.log(
        `✅ [MARKERS APPLIED] ${markers.length} markers successfully set`
      );
      console.log(
        `📊 [REDUCTION] ${sortedSignals.length} signals → ${
          markers.length
        } markers (${((markers.length / sortedSignals.length) * 100).toFixed(
          1
        )}% after deduplication)`
      );

      // Log ALL markers for debugging
      console.table(
        markers.map((m) => ({
          time: new Date(m.time * 1000).toISOString(),
          signal: m.text,
          position: m.position,
        }))
      );
    } else {
      console.log(
        `⚠️ [NO MARKERS] No signal changes detected - chart will be clean`
      );
      console.log(
        `   This is normal if all signals are neutral or consecutive duplicates`
      );
    }

    console.log("─────────────────────────────────────────────────────");
  }, [allCandlesData]);

  return (
    <div
      ref={chartContainerRef}
      className="main-chart-container chart-sync-container"
    />
  );
}

export default MainChart;
