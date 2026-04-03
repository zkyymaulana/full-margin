import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { useDarkMode } from "../../contexts/DarkModeContext";
import {
  getBaseChartOptions,
  overlayIndicators,
  getIndicatorValueByPeriod,
  getIndicatorValue,
  getCleanSeriesOptions,
} from "../../utils/chartConfig";

/**
 * 🛡️ AGGRESSIVE TradingView Logo Removal Hook
 * Uses multiple strategies to completely remove logo
 */
const useSafeTradingViewLogoRemoval = () => {
  useEffect(() => {
    // ✅ Strategy 1: Remove IMG elements
    const removeTradingViewLogo = () => {
      // Remove all TradingView logo images
      document
        .querySelectorAll(
          'img[src*="tradingview"], img[alt*="TradingView"], img[alt*="tradingview"]'
        )
        .forEach((el) => {
          if (el.tagName === "IMG") {
            el.remove();
          }
        });

      // ✅ Strategy 2: Remove SVG elements (icon might be SVG)
      document
        .querySelectorAll('svg[class*="tv-"], svg[class*="tradingview"]')
        .forEach((el) => {
          if (el.tagName === "SVG") {
            el.remove();
          }
        });

      // ✅ Strategy 3: Remove anchor links to TradingView
      document.querySelectorAll('a[href*="tradingview"]').forEach((el) => {
        // Only remove if it contains an img or svg child
        if (el.querySelector("img, svg")) {
          el.remove();
        }
      });

      // ✅ Strategy 4: Hide elements with specific classes/attributes
      document
        .querySelectorAll('[class*="tv-attr"], [class*="attribution"]')
        .forEach((el) => {
          const text = el.textContent?.toLowerCase() || "";
          if (text.includes("tradingview") || text.includes("trading view")) {
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.opacity = "0";
          }
        });
    };

    // Initial cleanup (run immediately)
    removeTradingViewLogo();

    // Run after short delay to catch delayed renders
    setTimeout(removeTradingViewLogo, 100);
    setTimeout(removeTradingViewLogo, 500);

    // ✅ MutationObserver - watches for dynamic logo injection
    const observer = new MutationObserver((mutations) => {
      let shouldRemove = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            const tagName = node.tagName;

            // Check for IMG elements
            if (tagName === "IMG") {
              const src = node.getAttribute("src") || "";
              const alt = node.getAttribute("alt") || "";
              if (
                src.includes("tradingview") ||
                alt.toLowerCase().includes("tradingview")
              ) {
                shouldRemove = true;
              }
            }

            // Check for SVG elements
            if (tagName === "SVG") {
              const className = node.getAttribute("class") || "";
              if (
                className.includes("tv-") ||
                className.includes("tradingview")
              ) {
                shouldRemove = true;
              }
            }

            // Check for anchor elements
            if (tagName === "A") {
              const href = node.getAttribute("href") || "";
              if (href.includes("tradingview")) {
                shouldRemove = true;
              }
            }
          }
        });
      });

      if (shouldRemove) {
        removeTradingViewLogo();
      }
    });

    // Start observing with aggressive config
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "alt", "href", "class"],
    });

    // Cleanup on unmount
    return () => {
      observer.disconnect();
    };
  }, []);
};

/**
 * Main Chart Component
 * Displays candlestick chart with overlay indicators (SMA, EMA, Bollinger, PSAR)
 */
// MainChart: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
function MainChart({
  chartRef,
  seriesRef,
  allCandlesData,
  activeIndicators,
  chartSync,
  oscillatorChartsRef,
  onCrosshairMove,
}) {
  const { isDarkMode } = useDarkMode();
  const chartContainerRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  // 🆕 simpan { seriesObj, priceLine }[] agar bisa di-remove saat indikator berubah
  const priceLinesRef = useRef([]);

  // ✅ USE SAFE LOGO REMOVAL HOOK
  useSafeTradingViewLogoRemoval();

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
      ...getCleanSeriesOptions(), // ✅ Hide corner tooltip
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

    // ⚠️ REMOVED: Don't setup sync here - will be done in Dashboard after all charts are ready

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [isDarkMode]);

  // 🆕 Subscribe crosshairMove → emit hovered candle OHLCV to parent
  useEffect(() => {
    if (!chartRef.current || !onCrosshairMove) return;

    const handler = (param) => {
      if (!param || !param.time || !param.seriesData) {
        onCrosshairMove(null);
        return;
      }
      const seriesData = param.seriesData.get(seriesRef.current);
      if (seriesData) {
        const timeMs = param.time * 1000;
        const rawCandle = allCandlesData.find((c) => Number(c.time) === timeMs);
        onCrosshairMove({
          open: seriesData.open,
          high: seriesData.high,
          low: seriesData.low,
          close: seriesData.close,
          volume: rawCandle ? rawCandle.volume : null,
        });
      } else {
        onCrosshairMove(null);
      }
    };

    chartRef.current.subscribeCrosshairMove(handler);

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(handler);
      }
    };
  }, [chartRef.current, onCrosshairMove, allCandlesData]);

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

    // 🆕 Hapus semua price line lama
    priceLinesRef.current.forEach(({ seriesObj, priceLine }) => {
      try {
        seriesObj.removePriceLine(priceLine);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Helper: buat price line pada series dengan nilai terakhir
    const addPriceLine = (lineSeries, label, color, lastValue) => {
      if (lastValue === null || lastValue === undefined) return;
      const priceStr = lastValue >= 1000 ? `${label}` : `${label}`;
      const pl = lineSeries.createPriceLine({
        price: lastValue,
        color: color,
        lineWidth: 1,
        lineStyle: 2, // LineStyle.Dashed
        axisLabelVisible: true,
        title: priceStr,
        axisLabelColor: color,
        axisLabelTextColor: "#ffffff",
      });
      priceLinesRef.current.push({ seriesObj: lineSeries, priceLine: pl });
    };

    // Ambil candle terakhir untuk nilai awal price line
    const sorted = [...allCandlesData].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );
    const lastCandle = sorted[sorted.length - 1];

    // Add active overlay indicators
    overlayIndicators.forEach((indicator) => {
      if (!activeIndicators.includes(indicator.id)) return;

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
              ...getCleanSeriesOptions(),
            });
            lineSeries.setData(chartData);
            seriesArray.push(lineSeries);

            // 🆕 Price line
            const lastVal = getIndicatorValueByPeriod(
              lastCandle,
              indicator.type,
              period
            );
            addPriceLine(
              lineSeries,
              `${indicator.type.toUpperCase()} ${period}`,
              indicator.colors[index],
              lastVal
            );
          }
        });
        indicatorSeriesRef.current[indicator.id] = seriesArray;
      } else if (indicator.type === "bollinger") {
        const seriesArray = [];
        const bands = ["upper", "middle", "lower"];
        const bbLabels = ["BB Upper", "BB Mid", "BB Lower"];

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
              ...getCleanSeriesOptions(),
            });
            lineSeries.setData(chartData);
            seriesArray.push(lineSeries);

            // 🆕 Price line
            const lastVal = lastCandle?.indicators?.bollingerBands?.[band];
            addPriceLine(
              lineSeries,
              bbLabels[index],
              indicator.colors[index],
              lastVal
            );
          }
        });
        indicatorSeriesRef.current[indicator.id] = seriesArray;
      } else if (indicator.type === "psar") {
        const chartData = allCandlesData
          .map((d) => ({
            time: Number(d.time) / 1000,
            value: d.indicators?.parabolicSar?.value,
          }))
          .filter((d) => d.value !== null && d.value !== undefined)
          .sort((a, b) => a.time - b.time);

        if (chartData.length > 0) {
          const dotSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 0,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            pointMarkersVisible: true,
            ...getCleanSeriesOptions(),
          });
          dotSeries.applyOptions({
            lineStyle: 0,
            lineWidth: 0,
            crosshairMarkerRadius: 6,
          });
          dotSeries.setData(chartData);
          indicatorSeriesRef.current[indicator.id] = dotSeries;

          // 🆕 Price line
          const lastVal = lastCandle?.indicators?.parabolicSar?.value;
          addPriceLine(dotSeries, "PSAR", indicator.color, lastVal);
        }
      } else {
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
            ...getCleanSeriesOptions(),
          });
          lineSeries.setData(chartData);
          indicatorSeriesRef.current[indicator.id] = lineSeries;

          // 🆕 Price line
          const lastVal = getIndicatorValue(lastCandle, indicator.type);
          addPriceLine(lineSeries, indicator.label, indicator.color, lastVal);
        }
      }
    });

    console.log(
      `📊 Overlay indicators updated from ${allCandlesData.length} candles`
    );
  }, [activeIndicators, allCandlesData]);

  // 🆕 Update nilai price line saat crosshair hover, kembalikan ke lastCandle saat keluar
  useEffect(() => {
    if (!chartRef.current) return;

    const handler = (param) => {
      if (!priceLinesRef.current.length) return;

      const sorted = [...allCandlesData].sort(
        (a, b) => Number(a.time) - Number(b.time)
      );
      const lastCandle = sorted[sorted.length - 1];

      // Kumpulkan metadata dari indicatorSeriesRef untuk update priceLine
      const updateLine = (
        lineSeries,
        priceLine,
        label,
        color,
        hoveredValue,
        lastValue
      ) => {
        const value =
          hoveredValue !== null && hoveredValue !== undefined
            ? hoveredValue
            : lastValue;
        if (value === null || value === undefined) return;
        const priceStr = value >= 1000 ? `${label}` : `${label}`;
        try {
          priceLine.applyOptions({ price: value, title: priceStr });
        } catch (e) {}
      };

      overlayIndicators.forEach((indicator) => {
        if (!activeIndicators.includes(indicator.id)) return;

        if (indicator.periods && indicator.colors) {
          const seriesArray = indicatorSeriesRef.current[indicator.id];
          if (!Array.isArray(seriesArray)) return;
          indicator.periods.forEach((period, index) => {
            const s = seriesArray[index];
            if (!s) return;
            const entry = priceLinesRef.current.find((e) => e.seriesObj === s);
            if (!entry) return;
            const hovered = param?.time
              ? param.seriesData?.get(s)?.value ?? null
              : null;
            const last = getIndicatorValueByPeriod(
              lastCandle,
              indicator.type,
              period
            );
            updateLine(
              s,
              entry.priceLine,
              `${indicator.type.toUpperCase()} ${period}`,
              indicator.colors[index],
              hovered,
              last
            );
          });
        } else if (indicator.type === "bollinger") {
          const seriesArray = indicatorSeriesRef.current[indicator.id];
          if (!Array.isArray(seriesArray)) return;
          const bbLabels = ["BB Upper", "BB Mid", "BB Lower"];
          const bands = ["upper", "middle", "lower"];
          seriesArray.forEach((s, i) => {
            const entry = priceLinesRef.current.find((e) => e.seriesObj === s);
            if (!entry) return;
            const hovered = param?.time
              ? param.seriesData?.get(s)?.value ?? null
              : null;
            const last = lastCandle?.indicators?.bollingerBands?.[bands[i]];
            updateLine(
              s,
              entry.priceLine,
              bbLabels[i],
              indicator.colors[i],
              hovered,
              last
            );
          });
        } else {
          const s = indicatorSeriesRef.current[indicator.id];
          if (!s) return;
          const entry = priceLinesRef.current.find((e) => e.seriesObj === s);
          if (!entry) return;
          const hovered = param?.time
            ? param.seriesData?.get(s)?.value ?? null
            : null;
          const last =
            indicator.type === "psar"
              ? lastCandle?.indicators?.parabolicSar?.value
              : getIndicatorValue(lastCandle, indicator.type);
          updateLine(
            s,
            entry.priceLine,
            indicator.label,
            indicator.color,
            hovered,
            last
          );
        }
      });
    };

    chartRef.current.subscribeCrosshairMove(handler);
    return () => {
      if (chartRef.current) chartRef.current.unsubscribeCrosshairMove(handler);
    };
  }, [chartRef.current, activeIndicators, allCandlesData]);

  // Update multi-indicator signal markers (BUY/SELL arrows)
  // ✅ PURE DATABASE SIGNALS - NO FRONTEND CALCULATION
  // ✅ Only render if source === "db"
  useEffect(() => {
    if (!seriesRef.current || !allCandlesData.length) return;

    console.log("🔍 [MARKER] Rendering database signals...");
    console.log(`📊 Total candles: ${allCandlesData.length}`);

    // 1️⃣ Filter ONLY database signals (strict validation)
    const validSignals = allCandlesData.filter((candle) => {
      // ❌ Reject if no multiSignal
      if (!candle.multiSignal) return false;

      // ❌ CRITICAL: Reject if source is NOT "db"
      if (candle.multiSignal.source !== "db") {
        console.warn("⚠️ [REJECTED] Non-database signal detected:", {
          time: new Date(Number(candle.time)).toISOString(),
          source: candle.multiSignal.source,
        });
        return false;
      }

      // ❌ Skip neutral signals
      if (candle.multiSignal.signal === "neutral") return false;

      // ❌ Skip weak signals (strength < 0.05) - Performance filter
      if (Math.abs(candle.multiSignal.strength) < 0.05) return false;

      // ✅ Only accept buy/sell with sufficient strength from database
      return (
        candle.multiSignal.signal === "buy" ||
        candle.multiSignal.signal === "sell"
      );
    });

    console.log(
      `✅ [DB SIGNALS] ${validSignals.length} valid signals from database`
    );
    console.log(
      `   Filtered out: ${
        allCandlesData.length - validSignals.length
      } (neutral + weak + non-db)`
    );

    // 2️⃣ Sort by time ascending (oldest first)
    const sortedSignals = [...validSignals].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    // 3️⃣ Remove consecutive duplicates (keep only direction changes)
    const signalChanges = [];
    let previousSignal = null;

    sortedSignals.forEach((candle) => {
      const currentSignal = candle.multiSignal.signal;

      // Only add marker if signal CHANGED from previous
      if (currentSignal !== previousSignal) {
        signalChanges.push(candle);
        previousSignal = currentSignal;
      }
    });

    console.log(
      `📍 [SIGNAL CHANGES] ${signalChanges.length} direction changes`
    );
    console.log(
      `   BUY: ${
        signalChanges.filter((c) => c.multiSignal.signal === "buy").length
      } | SELL: ${
        signalChanges.filter((c) => c.multiSignal.signal === "sell").length
      }`
    );

    // 4️⃣ Convert to lightweight-charts marker format
    const markers = signalChanges.map((c) => {
      const timeInSeconds = Number(c.time) / 1000;
      const isBuy = c.multiSignal.signal === "buy";

      return {
        time: timeInSeconds,
        position: isBuy ? "belowBar" : "aboveBar",
        color: isBuy ? "#26a69a" : "#ef5350",
        shape: isBuy ? "arrowUp" : "arrowDown",
        text: isBuy ? "BUY" : "SELL",
      };
    });

    // 5️⃣ Apply markers
    seriesRef.current.setMarkers(markers);

    if (markers.length > 0) {
      console.log(`✅ [MARKERS APPLIED] ${markers.length} markers rendered`);
    } else {
      console.log(`⚠️ [NO MARKERS] All signals filtered out`);
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

export { MainChart };
export default MainChart;
