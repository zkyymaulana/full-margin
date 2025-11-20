import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { useDarkMode } from "../../contexts/DarkModeContext";
import { getBaseChartOptions } from "../../utils/chartConfig";

/**
 * Oscillator Charts Component
 * Displays RSI, Stochastic, Stochastic RSI, and MACD charts
 */
function OscillatorCharts({
  activeIndicators,
  allCandlesData,
  chartSync,
  oscillatorChartsRef,
  mainChartRef,
}) {
  const { isDarkMode } = useDarkMode();

  // Refs for each oscillator
  const rsiContainerRef = useRef(null);
  const stochasticContainerRef = useRef(null);
  const stochRsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);

  // Series refs
  const seriesRefs = useRef({});

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

  // Helper function to create oscillator chart
  const createOscillatorChart = (containerRef, height, isLast, chartKey) => {
    if (!containerRef.current) return null;

    const chartOptions = getBaseChartOptions(isDarkMode, height, isLast);
    chartOptions.width = Math.max(containerRef.current.clientWidth - 20, 300);

    const chart = createChart(containerRef.current, chartOptions);

    // Explicitly disable watermark
    chart.applyOptions({
      watermark: {
        visible: false,
      },
    });

    oscillatorChartsRef.current[chartKey] = chart;

    return chart;
  };

  // Update chart data helper
  const updateChartData = (seriesRef, data) => {
    if (seriesRef && data.length > 0) {
      seriesRef.setData(data);
    }
  };

  // RSI Chart
  useEffect(() => {
    if (!activeIndicators.includes("rsi")) {
      if (oscillatorChartsRef.current.rsi) {
        oscillatorChartsRef.current.rsi.remove();
        delete oscillatorChartsRef.current.rsi;
      }
      return;
    }

    if (!rsiContainerRef.current || oscillatorChartsRef.current.rsi) return;

    const isLast =
      !activeIndicators.includes("stochasticRsi") &&
      !activeIndicators.includes("macd") &&
      !activeIndicators.includes("stochastic");

    const chart = createOscillatorChart(rsiContainerRef, 150, isLast, "rsi");
    if (!chart) return;

    const series = chart.addLineSeries({
      color: "#FF6D00",
      lineWidth: 2,
      title: "RSI",
    });

    seriesRefs.current.rsi = series;

    // Setup sync
    const allCharts = [
      mainChartRef.current,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);
    const cleanup = chartSync.setupChartSync(chart, allCharts, "rsi");

    return () => {
      if (cleanup) cleanup();
      chart.remove();
      delete oscillatorChartsRef.current.rsi;
    };
  }, [activeIndicators, isDarkMode]);

  // Stochastic Chart
  useEffect(() => {
    if (!activeIndicators.includes("stochastic")) {
      if (oscillatorChartsRef.current.stochastic) {
        oscillatorChartsRef.current.stochastic.remove();
        delete oscillatorChartsRef.current.stochastic;
      }
      return;
    }

    if (
      !stochasticContainerRef.current ||
      oscillatorChartsRef.current.stochastic
    )
      return;

    const isLast =
      !activeIndicators.includes("stochasticRsi") &&
      !activeIndicators.includes("macd");

    const chart = createOscillatorChart(
      stochasticContainerRef,
      150,
      isLast,
      "stochastic"
    );
    if (!chart) return;

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

    seriesRefs.current.stochasticK = kSeries;
    seriesRefs.current.stochasticD = dSeries;

    const allCharts = [
      mainChartRef.current,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);
    const cleanup = chartSync.setupChartSync(chart, allCharts, "stochastic");

    return () => {
      if (cleanup) cleanup();
      chart.remove();
      delete oscillatorChartsRef.current.stochastic;
    };
  }, [activeIndicators, isDarkMode]);

  // Stochastic RSI Chart
  useEffect(() => {
    if (!activeIndicators.includes("stochasticRsi")) {
      if (oscillatorChartsRef.current.stochRsi) {
        oscillatorChartsRef.current.stochRsi.remove();
        delete oscillatorChartsRef.current.stochRsi;
      }
      return;
    }

    if (!stochRsiContainerRef.current || oscillatorChartsRef.current.stochRsi)
      return;

    const isLast = !activeIndicators.includes("macd");

    const chart = createOscillatorChart(
      stochRsiContainerRef,
      150,
      isLast,
      "stochRsi"
    );
    if (!chart) return;

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

    seriesRefs.current.stochRsiK = kSeries;
    seriesRefs.current.stochRsiD = dSeries;

    const allCharts = [
      mainChartRef.current,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);
    const cleanup = chartSync.setupChartSync(chart, allCharts, "stochRsi");

    return () => {
      if (cleanup) cleanup();
      chart.remove();
      delete oscillatorChartsRef.current.stochRsi;
    };
  }, [activeIndicators, isDarkMode]);

  // MACD Chart
  useEffect(() => {
    if (!activeIndicators.includes("macd")) {
      if (oscillatorChartsRef.current.macd) {
        oscillatorChartsRef.current.macd.remove();
        delete oscillatorChartsRef.current.macd;
      }
      return;
    }

    if (!macdContainerRef.current || oscillatorChartsRef.current.macd) return;

    const chart = createOscillatorChart(macdContainerRef, 150, true, "macd");
    if (!chart) return;

    const macdLine = chart.addLineSeries({
      color: "#00C853",
      lineWidth: 2,
      title: "MACD",
    });

    const signalLine = chart.addLineSeries({
      color: "#FF5252",
      lineWidth: 2,
      title: "Signal",
    });

    const histogram = chart.addHistogramSeries({
      title: "Histogram",
    });

    seriesRefs.current.macdLine = macdLine;
    seriesRefs.current.macdSignal = signalLine;
    seriesRefs.current.macdHistogram = histogram;

    const allCharts = [
      mainChartRef.current,
      ...Object.values(oscillatorChartsRef.current),
    ].filter(Boolean);
    const cleanup = chartSync.setupChartSync(chart, allCharts, "macd");

    return () => {
      if (cleanup) cleanup();
      chart.remove();
      delete oscillatorChartsRef.current.macd;
    };
  }, [activeIndicators, isDarkMode]);

  // Update all oscillator data
  useEffect(() => {
    if (!allCandlesData.length) return;

    // RSI data
    if (seriesRefs.current.rsi && activeIndicators.includes("rsi")) {
      const rsiData = allCandlesData
        .map((d) => ({
          time: Number(d.time) / 1000,
          value: d.indicators?.rsi?.[14],
        }))
        .filter((d) => d.value !== null && d.value !== undefined)
        .sort((a, b) => a.time - b.time);

      updateChartData(seriesRefs.current.rsi, rsiData);
    }

    // Stochastic data
    if (
      seriesRefs.current.stochasticK &&
      activeIndicators.includes("stochastic")
    ) {
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

      updateChartData(seriesRefs.current.stochasticK, kData);
      updateChartData(seriesRefs.current.stochasticD, dData);
    }

    // Stochastic RSI data
    if (
      seriesRefs.current.stochRsiK &&
      activeIndicators.includes("stochasticRsi")
    ) {
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

      updateChartData(seriesRefs.current.stochRsiK, kData);
      updateChartData(seriesRefs.current.stochRsiD, dData);
    }

    // MACD data
    if (seriesRefs.current.macdLine && activeIndicators.includes("macd")) {
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

      updateChartData(seriesRefs.current.macdLine, macdData);
      updateChartData(seriesRefs.current.macdSignal, signalData);
      updateChartData(seriesRefs.current.macdHistogram, histogramData);
    }

    console.log(`📊 Oscillators updated: ${allCandlesData.length} points`);
  }, [allCandlesData, activeIndicators]);

  return (
    <>
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
    </>
  );
}

export default OscillatorCharts;
