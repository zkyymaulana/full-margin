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

    // Explicitly disable watermark
    chart.applyOptions({
      watermark: {
        visible: false,
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

  return (
    <div
      ref={chartContainerRef}
      className="main-chart-container chart-sync-container"
    />
  );
}

export default MainChart;
