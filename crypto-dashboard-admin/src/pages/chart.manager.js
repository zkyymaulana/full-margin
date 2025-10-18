/**
 * Enhanced Chart Manager - Full Interactive Implementation
 * Bidirectional pan sync + Real-time indicator updates
 */
import { createChart, ColorType } from "lightweight-charts";

export class CandlestickChart {
  constructor(containerId) {
    this.containerId = containerId;
    this.chart = null;
    this.candleSeries = null;
    this.subCharts = {}; // Separate charts for bottom indicators
    this.series = {}; // All chart series organized by type
    this.activeIndicators = new Set();
    this.currentData = [];
    this.latestValues = {};
    this.isInitialized = false;
    this.isFullscreen = false;
    this.resizeObserver = null;

    // ✅ Bidirectional sync control
    this.isSyncing = false;
    this.syncTimeout = null;

    // Ensure DOM is ready before initialization
    this.domReady =
      document.readyState === "complete" ||
      document.readyState === "interactive";
    if (!this.domReady) {
      document.addEventListener("DOMContentLoaded", () => {
        this.domReady = true;
      });
    }
  }

  init() {
    if (!this.domReady) {
      console.warn("⚠️ DOM not ready, deferring chart initialization");
      document.addEventListener("DOMContentLoaded", () => this.init());
      return false;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`❌ Container '${this.containerId}' not found!`);
      return false;
    }

    if (this.isInitialized) {
      console.log(`⚠️ Chart already initialized`);
      return true;
    }

    this.setupContainer(container);
    this.createMainChart(container);
    this.setupSubCharts(container);
    this.addFullscreenButton(container);
    this.setupResizeObserver(container);

    this.isInitialized = true;
    console.log(`✅ Chart initialized successfully`);
    return true;
  }

  setupContainer(container) {
    // Clear and setup main container - dynamic height based on active indicators
    container.innerHTML = "";
    this.updateContainerLayout(container);
  }

  updateContainerLayout(container = null) {
    if (!container) container = document.getElementById(this.containerId);
    if (!container) return;

    const activeSubIndicators = ["rsi", "macd", "stoch", "stochrsi"].filter(
      (type) => this.activeIndicators.has(type)
    );

    // Dynamic height calculation like TradingView
    const baseHeight = 500; // Main chart minimum height
    const subPanelHeight = activeSubIndicators.length * 120; // 120px per sub-indicator
    const totalHeight = baseHeight + subPanelHeight;

    Object.assign(container.style, {
      width: "100%",
      height: `${totalHeight}px`,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
    });
  }

  createMainChart(container) {
    // Create main chart container with seamless layout
    const mainChartDiv = document.createElement("div");
    mainChartDiv.id = "main-chart";
    this.updateMainChartSize(mainChartDiv);
    container.appendChild(mainChartDiv);

    const width = container.clientWidth || 800;
    const height = this.getMainChartHeight();

    this.chart = createChart(mainChartDiv, {
      width: width,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333333",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: {
          color: "#f0f0f0",
          style: 1,
          visible: true,
        },
        horzLines: {
          color: "#f0f0f0",
          style: 1,
          visible: true,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#4285f4",
          style: 2,
          labelVisible: true,
          labelBackgroundColor: "#4285f4",
        },
        horzLine: {
          width: 1,
          color: "#4285f4",
          style: 2,
          labelVisible: true,
          labelBackgroundColor: "#4285f4",
        },
      },
      rightPriceScale: {
        borderColor: "#e1e5e9",
        scaleMargins: { top: 0.02, bottom: 0.02 },
        textColor: "#6c757d",
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: "#e1e5e9",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 6,
        minBarSpacing: 2,
        fixLeftEdge: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });

    // Add candlestick series with professional colors
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: "#00C896", // Professional green
      downColor: "#FF3366", // Professional red
      borderVisible: false,
      wickUpColor: "#00C896",
      wickDownColor: "#FF3366",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      borderUpColor: "#00C896",
      borderDownColor: "#FF3366",
    });

    // ✅ Setup bidirectional synchronization - Main Chart → Sub Charts
    this.setupMainChartSync();

    // Add crosshair move handler for perfect synchronization
    this.chart.subscribeCrosshairMove((param) => {
      this.handleCrosshairMove(param);
    });
  }

  // ✅ Main Chart Synchronization Setup
  setupMainChartSync() {
    // Main chart → Sub charts synchronization
    this.chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      this.syncFromMainChart(range);
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      this.syncLogicalRangeFromMain(range);
    });

    console.log("✅ Main chart sync listeners established");
  }

  // ✅ Sync from main chart to all sub charts
  syncFromMainChart(range) {
    if (this.isSyncing || !range) return;

    this.isSyncing = true;

    // Clear any pending sync
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    try {
      Object.values(this.subCharts).forEach(({ chart }) => {
        if (chart && chart.timeScale) {
          try {
            chart.timeScale().setVisibleRange(range);
          } catch (e) {
            // Ignore sync errors
          }
        }
      });
    } catch (e) {
      console.warn("Main→Sub sync error:", e);
    }

    // Reset sync flag with slight delay to prevent sync loops
    this.syncTimeout = setTimeout(() => {
      this.isSyncing = false;
    }, 50);
  }

  // ✅ Sync logical range from main chart
  syncLogicalRangeFromMain(range) {
    if (this.isSyncing || !range) return;

    this.isSyncing = true;

    try {
      Object.values(this.subCharts).forEach(({ chart }) => {
        if (chart && chart.timeScale) {
          try {
            chart.timeScale().setVisibleLogicalRange(range);
          } catch (e) {
            // Ignore sync errors
          }
        }
      });
    } catch (e) {
      console.warn("Main→Sub logical sync error:", e);
    }

    setTimeout(() => {
      this.isSyncing = false;
    }, 50);
  }

  // ✅ Setup Sub Chart Synchronization (Sub Charts → Main Chart + Other Subs)
  setupSubChartSync(subChart, subChartKey) {
    if (!subChart || !subChart.timeScale) return;

    // Sub chart → Main chart + other sub charts synchronization
    subChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      this.syncFromSubChart(range, subChartKey);
    });

    subChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      this.syncLogicalRangeFromSub(range, subChartKey);
    });

    console.log(`✅ Sub chart sync listeners established for ${subChartKey}`);
  }

  // ✅ Sync from sub chart to main chart and other sub charts
  syncFromSubChart(range, sourceKey) {
    if (this.isSyncing || !range) return;

    this.isSyncing = true;

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    try {
      // Sync to main chart
      if (this.chart && this.chart.timeScale) {
        this.chart.timeScale().setVisibleRange(range);
      }

      // Sync to other sub charts
      Object.entries(this.subCharts).forEach(([key, { chart }]) => {
        if (key !== sourceKey && chart && chart.timeScale) {
          try {
            chart.timeScale().setVisibleRange(range);
          } catch (e) {
            // Ignore sync errors
          }
        }
      });
    } catch (e) {
      console.warn("Sub→Main/Sub sync error:", e);
    }

    this.syncTimeout = setTimeout(() => {
      this.isSyncing = false;
    }, 50);
  }

  // ✅ Sync logical range from sub chart
  syncLogicalRangeFromSub(range, sourceKey) {
    if (this.isSyncing || !range) return;

    this.isSyncing = true;

    try {
      // Sync to main chart
      if (this.chart && this.chart.timeScale) {
        this.chart.timeScale().setVisibleLogicalRange(range);
      }

      // Sync to other sub charts
      Object.entries(this.subCharts).forEach(([key, { chart }]) => {
        if (key !== sourceKey && chart && chart.timeScale) {
          try {
            chart.timeScale().setVisibleLogicalRange(range);
          } catch (e) {
            // Ignore sync errors
          }
        }
      });
    } catch (e) {
      console.warn("Sub→Main/Sub logical sync error:", e);
    }

    setTimeout(() => {
      this.isSyncing = false;
    }, 50);
  }

  getMainChartHeight() {
    const activeSubIndicators = ["rsi", "macd", "stoch", "stochrsi"].filter(
      (type) => this.activeIndicators.has(type)
    );
    const subPanelsHeight = activeSubIndicators.length * 120;
    return this.isFullscreen
      ? window.innerHeight - subPanelsHeight - 100
      : 500 - Math.min(subPanelsHeight, 200);
  }

  updateMainChartSize(mainChartDiv = null) {
    if (!mainChartDiv) mainChartDiv = document.getElementById("main-chart");
    if (!mainChartDiv) return;

    const height = this.getMainChartHeight();
    Object.assign(mainChartDiv.style, {
      width: "100%",
      height: `${height}px`,
      position: "relative",
      borderBottom:
        this.activeIndicators.size > 0 ? "1px solid #e5e7eb" : "none",
    });
  }

  setupSubCharts(container) {
    // Create seamless container for sub-panels
    const subPanelContainer = document.createElement("div");
    subPanelContainer.id = "sub-panels";
    Object.assign(subPanelContainer.style, {
      width: "100%",
      flex: "1",
      display: "flex",
      flexDirection: "column",
      background: "#ffffff", // Same as main chart
      borderTop: "none", // Remove gap
    });
    container.appendChild(subPanelContainer);

    // Professional color scheme - consistent and not too colorful
    const subChartConfigs = {
      rsi: {
        height: 120,
        title: "RSI (14)",
        colors: {
          line: "#6366f1", // Indigo
          bg: "#ffffff",
          accent: "#f1f5f9",
        },
        scale: { min: 0, max: 100 },
      },
      macd: {
        height: 120,
        title: "MACD (12,26,9)",
        colors: {
          line: "#10b981", // Emerald
          signal: "#f59e0b", // Amber
          hist: "#64748b", // Slate
          bg: "#ffffff",
          accent: "#f8fafc",
        },
        scale: { autoScale: true },
      },
      stoch: {
        height: 120,
        title: "Stochastic (14,3)",
        colors: {
          line: "#8b5cf6", // Violet
          bg: "#ffffff",
          accent: "#faf5ff",
        },
        scale: { min: 0, max: 100 },
      },
      stochrsi: {
        height: 120,
        title: "Stoch RSI (14,14,3,3)",
        colors: {
          line: "#ec4899", // Pink
          bg: "#ffffff",
          accent: "#fdf2f8",
        },
        scale: { min: 0, max: 100 },
      },
    };

    Object.entries(subChartConfigs).forEach(([key, config]) => {
      this.subCharts[key] = this.createSubChart(subPanelContainer, key, config);
    });
  }

  createSubChart(parentContainer, type, config) {
    const subDiv = document.createElement("div");
    subDiv.id = `${type}-chart`;
    Object.assign(subDiv.style, {
      width: "100%",
      height: `${config.height}px`,
      display: "none", // Hidden by default
      borderTop: "1px solid #e1e5e9", // Consistent border
      background: config.colors.bg,
      position: "relative",
      margin: "0", // Remove any margin gaps
      padding: "0", // Remove any padding gaps
    });

    // Add professional title overlay
    const titleDiv = document.createElement("div");
    titleDiv.className =
      "absolute top-2 left-3 text-sm font-medium text-gray-700 z-10 bg-white/95 px-2 py-1 rounded shadow-sm border border-gray-200";
    titleDiv.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" style="background-color: ${config.colors.line}"></span>
        ${config.title}
      </div>
    `;
    subDiv.appendChild(titleDiv);

    parentContainer.appendChild(subDiv);

    // Professional chart configuration with seamless integration
    const chartOptions = {
      width: parentContainer.clientWidth || 800,
      height: config.height,
      layout: {
        background: { type: ColorType.Solid, color: config.colors.bg },
        textColor: "#6c757d",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: {
          color: "#f0f0f0",
          style: 1,
          visible: true,
        },
        horzLines: {
          color: "#f0f0f0",
          style: 1,
          visible: true,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#4285f4",
          style: 2,
          labelVisible: false, // Hide labels on sub-charts to reduce clutter
        },
        horzLine: {
          width: 1,
          color: "#4285f4",
          style: 2,
          labelVisible: true,
          labelBackgroundColor: "#4285f4",
        },
      },
      rightPriceScale: {
        borderColor: "#e1e5e9",
        scaleMargins: { top: 0.05, bottom: 0.05 },
        textColor: "#6c757d",
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: "#e1e5e9",
        timeVisible: false, // Hide time on sub-charts to avoid duplication
        rightOffset: 10,
        barSpacing: 6,
        minBarSpacing: 2,
        fixLeftEdge: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    };

    // Apply scale configuration for bounded indicators
    if (config.scale.min !== undefined && config.scale.max !== undefined) {
      chartOptions.rightPriceScale.visible = true;
      chartOptions.rightPriceScale.mode = 1;
    }

    const subChart = createChart(subDiv, chartOptions);

    // ✅ Setup bidirectional sync for this sub chart
    this.setupSubChartSync(subChart, type);

    return { chart: subChart, container: subDiv, config };
  }

  handleCrosshairMove(param) {
    if (!param.time && param.logical === undefined) return;

    // Synchronize crosshair across all sub-charts with better precision
    Object.values(this.subCharts).forEach(({ chart }) => {
      if (chart && chart.timeScale) {
        try {
          if (param.time) {
            // Use time-based synchronization for better accuracy
            chart.setCrosshairPosition(
              param.point?.x || 0,
              param.time,
              param.seriesData
            );
          } else if (param.logical !== undefined) {
            chart.timeScale().scrollToPosition(param.logical, false);
          }
        } catch (e) {
          // Ignore synchronization errors
        }
      }
    });
  }

  addFullscreenButton(container) {
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.id = "fullscreen-btn";
    fullscreenBtn.className =
      "absolute top-2 right-2 bg-white/90 hover:bg-blue-50 rounded-lg p-2 shadow-md transition-all duration-200 z-30 border border-gray-200";
    fullscreenBtn.innerHTML = '<span class="text-base">⛶</span>';
    fullscreenBtn.title = "Toggle Fullscreen";
    fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    container.appendChild(fullscreenBtn);
  }

  toggleFullscreen() {
    const container = document.getElementById(this.containerId);
    const btn = container.querySelector("#fullscreen-btn span");

    if (this.isFullscreen) {
      // Exit fullscreen
      this.isFullscreen = false;
      if (btn) btn.textContent = "⛶";

      Object.assign(container.style, {
        position: "relative",
        inset: "",
        zIndex: "",
      });
      container.classList.remove("fixed", "inset-0", "z-50");
    } else {
      // Enter fullscreen
      this.isFullscreen = true;
      if (btn) btn.textContent = "❌";

      Object.assign(container.style, {
        position: "fixed",
        inset: "0",
        zIndex: "50",
      });
      container.classList.add("fixed", "inset-0", "z-50");
    }

    // Update layout and resize
    this.updateContainerLayout(container);
    this.updateMainChartSize();
    requestAnimationFrame(() => this.resizeCharts());
  }

  resizeCharts() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const newWidth = container.clientWidth;
    const mainHeight = this.getMainChartHeight();

    if (this.chart) {
      this.chart.applyOptions({ width: newWidth, height: mainHeight });
    }

    Object.values(this.subCharts).forEach(({ chart, config }) => {
      if (chart) {
        chart.applyOptions({ width: newWidth, height: config.height });
      }
    });
  }

  setupResizeObserver(container) {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.resizeCharts());
      });
      this.resizeObserver.observe(container);
    }
  }

  toggleIndicator(type) {
    if (!this.isInitialized) {
      console.warn(`⚠️ Chart not initialized`);
      return;
    }

    const isActive = this.activeIndicators.has(type);

    if (isActive) {
      this.activeIndicators.delete(type);
      this.removeIndicator(type);
    } else {
      this.activeIndicators.add(type);
      this.addIndicator(type);
    }

    // Update layout and container size
    this.updateContainerLayout();
    this.updateMainChartSize();

    // Update indicator data and resize
    this.updateIndicatorData();
    this.updateIndicatorValuesDisplay();

    requestAnimationFrame(() => {
      this.resizeCharts();
      this.syncSubChartsWithMain();
    });
  }

  addIndicator(type) {
    const configs = {
      sma: () =>
        this.addMainIndicator(type, [
          { key: "sma20", color: "#2563eb", title: "SMA 20", lineWidth: 2 },
          { key: "sma50", color: "#1e40af", title: "SMA 50", lineWidth: 2 },
        ]),
      ema: () =>
        this.addMainIndicator(type, [
          { key: "ema20", color: "#7c3aed", title: "EMA 20", lineWidth: 2 },
          { key: "ema50", color: "#5b21b6", title: "EMA 50", lineWidth: 2 },
        ]),
      bb: () =>
        this.addMainIndicator(type, [
          {
            key: "bbUpper",
            color: "#06b6d4",
            title: "BB Upper",
            lineWidth: 1,
            style: 2,
          },
          {
            key: "bbLower",
            color: "#06b6d4",
            title: "BB Lower",
            lineWidth: 1,
            style: 2,
          },
        ]),
      psar: () =>
        this.addMainIndicator(type, [
          { key: "psar", color: "#dc2626", title: "PSAR", type: "scatter" },
        ]),
      rsi: () =>
        this.addSubIndicator("rsi", [
          { key: "rsi", color: "#6366f1", title: "RSI", lineWidth: 2 },
          {
            key: "rsi70",
            color: "#ef4444",
            title: "70",
            style: 2,
            value: 70,
            lineWidth: 1,
          },
          {
            key: "rsi30",
            color: "#22c55e",
            title: "30",
            style: 2,
            value: 30,
            lineWidth: 1,
          },
        ]),
      macd: () =>
        this.addSubIndicator("macd", [
          { key: "macd", color: "#10b981", title: "MACD", lineWidth: 2 },
          {
            key: "macdSignal",
            color: "#f59e0b",
            title: "Signal",
            lineWidth: 2,
          },
          {
            key: "macdHist",
            color: "#64748b",
            title: "Histogram",
            type: "histogram",
          },
        ]),
      stoch: () =>
        this.addSubIndicator("stoch", [
          { key: "stochK", color: "#8b5cf6", title: "Stoch %K", lineWidth: 2 },
          { key: "stochD", color: "#a855f7", title: "Stoch %D", lineWidth: 2 },
          {
            key: "stoch80",
            color: "#ef4444",
            title: "80",
            style: 2,
            value: 80,
            lineWidth: 1,
          },
          {
            key: "stoch20",
            color: "#22c55e",
            title: "20",
            style: 2,
            value: 20,
            lineWidth: 1,
          },
        ]),
      stochrsi: () =>
        this.addSubIndicator("stochrsi", [
          {
            key: "stochRsiK",
            color: "#ec4899",
            title: "StochRSI %K",
            lineWidth: 2,
          },
          {
            key: "stochRsiD",
            color: "#db2777",
            title: "StochRSI %D",
            lineWidth: 2,
          },
          {
            key: "stochRsi80",
            color: "#ef4444",
            title: "80",
            style: 2,
            value: 80,
            lineWidth: 1,
          },
          {
            key: "stochRsi20",
            color: "#22c55e",
            title: "20",
            style: 2,
            value: 20,
            lineWidth: 1,
          },
        ]),
    };

    const configFunction = configs[type];
    if (configFunction) {
      configFunction();
    }
  }

  addMainIndicator(type, seriesConfigs) {
    if (!this.series[type]) this.series[type] = {};

    seriesConfigs.forEach((config) => {
      if (config.type === "scatter") {
        this.series[type][config.key] = this.chart.addLineSeries({
          color: config.color,
          lineWidth: 0,
          pointMarkersVisible: true,
          lineVisible: false,
          pointMarkersRadius: 2,
          title: config.title,
          priceScaleId: "right",
        });
      } else {
        this.series[type][config.key] = this.chart.addLineSeries({
          color: config.color,
          lineWidth: config.lineWidth || 2,
          lineStyle: config.style || 0,
          title: config.title,
          priceScaleId: "right",
        });
      }
    });
  }

  addSubIndicator(type, seriesConfigs) {
    if (!this.subCharts[type]) return;
    if (!this.series[type]) this.series[type] = {};

    // Show sub-chart with seamless animation
    const container = this.subCharts[type].container;
    container.style.display = "block";
    container.style.opacity = "0";

    requestAnimationFrame(() => {
      container.style.transition = "opacity 0.2s ease-out";
      container.style.opacity = "1";
    });

    seriesConfigs.forEach((config) => {
      if (config.type === "histogram") {
        this.series[type][config.key] = this.subCharts[
          type
        ].chart.addHistogramSeries({
          color: config.color,
          title: config.title,
          priceFormat: { type: "volume", precision: 2 },
        });
      } else {
        this.series[type][config.key] = this.subCharts[
          type
        ].chart.addLineSeries({
          color: config.color,
          lineWidth: config.lineWidth || (config.value ? 1 : 2),
          lineStyle: config.style || 0,
          title: config.title,
        });
      }
    });

    // Perfect synchronization after creation
    setTimeout(() => {
      this.syncSubChartsWithMain();
      this.syncSubChartsTimeRange();
    }, 50);
  }

  removeIndicator(type) {
    // Remove all series for this indicator
    if (this.series[type]) {
      Object.values(this.series[type]).forEach((series) => {
        const chart = ["rsi", "macd", "stoch", "stochrsi"].includes(type)
          ? this.subCharts[type]?.chart
          : this.chart;

        if (chart && series) {
          chart.removeSeries(series);
        }
      });
      delete this.series[type];
    }

    // Hide sub-chart with animation
    if (this.subCharts[type]) {
      const container = this.subCharts[type].container;
      container.style.transition = "all 0.2s ease-in";
      container.style.opacity = "0";
      container.style.transform = "translateY(-10px)";

      setTimeout(() => {
        container.style.display = "none";
        container.style.transform = "translateY(0)";
      }, 200);
    }
  }

  updateData(candleData) {
    if (!this.isInitialized || !Array.isArray(candleData)) {
      console.error(`❌ Cannot update chart: invalid data or not initialized`);
      return;
    }

    try {
      // Process and store data
      this.currentData = this.processDataWithIndicators(candleData);
      this.extractLatestIndicators();

      // Update candlestick data
      const candleChartData = this.currentData.map((item) => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      this.candleSeries.setData(candleChartData);

      // Set optimal initial view (last 300 candles for better visibility)
      setTimeout(() => {
        if (this.chart && this.chart.timeScale && candleChartData.length > 0) {
          const total = candleChartData.length;
          const visibleStart = Math.max(0, total - 300);

          if (total > 300) {
            this.chart.timeScale().setVisibleRange({
              from: candleChartData[visibleStart].time,
              to: candleChartData[total - 1].time,
            });
          } else {
            this.chart.timeScale().fitContent();
          }
        }
      }, 100);

      // Update all active indicators
      this.updateIndicatorData();
      this.updateIndicatorValuesDisplay();

      // Hide loading overlay
      requestAnimationFrame(() => {
        const loadingElement = document.querySelector(".chart-loading");
        if (loadingElement) {
          loadingElement.style.display = "none";
        }
      });

      console.log(
        `✅ Chart updated with ${this.currentData.length} data points, showing last 300 candles`
      );
    } catch (error) {
      console.error("❌ Error updating chart:", error);
    }
  }

  processDataWithIndicators(dataArray) {
    return dataArray
      .filter(
        (item) =>
          item &&
          typeof item.time !== "undefined" &&
          ["open", "high", "low", "close"].every(
            (prop) => typeof item[prop] === "number"
          )
      )
      .map((item) => {
        let time = Number(item.time);
        if (time > 9999999999) time = Math.floor(time / 1000); // Convert ms to seconds

        return {
          time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          indicators: item.indicators || {},
        };
      })
      .sort((a, b) => a.time - b.time);
  }

  extractLatestIndicators() {
    if (!this.currentData.length) return;

    const latest = this.currentData[this.currentData.length - 1];
    const ind = latest.indicators;

    this.latestValues = {
      // Moving Averages
      sma20: ind.sma && ind.sma[20],
      sma50: ind.sma && ind.sma[50],
      ema20: ind.ema && ind.ema[20],
      ema50: ind.ema && ind.ema[50],

      // Oscillators
      rsi: ind.rsi && ind.rsi[14],

      // MACD - all parameters
      macd: ind.macd && ind.macd.macd,
      macdSignal: ind.macd && ind.macd.signalLine,
      macdHist: ind.macd && ind.macd.histogram,
      macdFast: ind.macd && ind.macd.fast,
      macdSlow: ind.macd && ind.macd.slow,
      macdSignalPeriod: ind.macd && ind.macd.signal,

      // Bollinger Bands - all parameters
      bbUpper: ind.bollingerBands && ind.bollingerBands.upper,
      bbLower: ind.bollingerBands && ind.bollingerBands.lower,
      bbPeriod: ind.bollingerBands && ind.bollingerBands.period,
      bbMultiplier: ind.bollingerBands && ind.bollingerBands.multiplier,

      // Stochastic - all parameters
      stochK: ind.stochastic && ind.stochastic["%K"],
      stochD: ind.stochastic && ind.stochastic["%D"],
      stochKPeriod: ind.stochastic && ind.stochastic.kPeriod,
      stochDPeriod: ind.stochastic && ind.stochastic.dPeriod,

      // Stochastic RSI - all parameters
      stochRsiK: ind.stochasticRsi && ind.stochasticRsi["%K"],
      stochRsiD: ind.stochasticRsi && ind.stochasticRsi["%D"],
      stochRsiRsiPeriod: ind.stochasticRsi && ind.stochasticRsi.rsiPeriod,
      stochRsiStochPeriod: ind.stochasticRsi && ind.stochasticRsi.stochPeriod,
      stochRsiKPeriod: ind.stochasticRsi && ind.stochasticRsi.kPeriod,
      stochRsiDPeriod: ind.stochasticRsi && ind.stochasticRsi.dPeriod,

      // Parabolic SAR - all parameters
      psar: ind.parabolicSar && ind.parabolicSar.value,
      psarStep: ind.parabolicSar && ind.parabolicSar.step,
      psarMaxStep: ind.parabolicSar && ind.parabolicSar.maxStep,

      timestamp: latest.time,
    };

    // ✅ Trigger real-time indicator card updates
    this.updateIndicatorValuesDisplay();

    console.log(
      "✅ Real-time indicator values extracted and updated:",
      this.latestValues
    );
  }

  updateIndicatorData() {
    this.activeIndicators.forEach((type) => {
      const data = this.extractIndicatorData(type);
      this.updateIndicatorSeries(type, data);
    });
  }

  extractIndicatorData(type) {
    const result = {};

    this.currentData.forEach((item) => {
      if (!item.indicators) return;
      const time = item.time;
      const ind = item.indicators;

      switch (type) {
        case "sma":
          if (ind.sma) {
            if (!result.sma20) result.sma20 = [];
            if (!result.sma50) result.sma50 = [];
            if (ind.sma[20] != null)
              result.sma20.push({ time, value: ind.sma[20] });
            if (ind.sma[50] != null)
              result.sma50.push({ time, value: ind.sma[50] });
          }
          break;
        case "ema":
          if (ind.ema) {
            if (!result.ema20) result.ema20 = [];
            if (!result.ema50) result.ema50 = [];
            if (ind.ema[20] != null)
              result.ema20.push({ time, value: ind.ema[20] });
            if (ind.ema[50] != null)
              result.ema50.push({ time, value: ind.ema[50] });
          }
          break;
        case "bb":
          if (ind.bollingerBands) {
            if (!result.bbUpper) result.bbUpper = [];
            if (!result.bbLower) result.bbLower = [];
            if (ind.bollingerBands.upper != null)
              result.bbUpper.push({ time, value: ind.bollingerBands.upper });
            if (ind.bollingerBands.lower != null)
              result.bbLower.push({ time, value: ind.bollingerBands.lower });
          }
          break;
        case "psar":
          if (ind.parabolicSar && ind.parabolicSar.value != null) {
            if (!result.psar) result.psar = [];
            result.psar.push({ time, value: ind.parabolicSar.value });
          }
          break;
        case "rsi":
          if (ind.rsi && ind.rsi[14] != null) {
            if (!result.rsi) result.rsi = [];
            result.rsi.push({ time, value: ind.rsi[14] });
          }
          break;
        case "macd":
          if (ind.macd) {
            if (!result.macd) result.macd = [];
            if (!result.macdSignal) result.macdSignal = [];
            if (!result.macdHist) result.macdHist = [];
            if (ind.macd.macd != null)
              result.macd.push({ time, value: ind.macd.macd });
            if (ind.macd.signalLine != null)
              result.macdSignal.push({ time, value: ind.macd.signalLine });
            if (ind.macd.histogram != null)
              result.macdHist.push({ time, value: ind.macd.histogram });
          }
          break;
        case "stoch":
          if (ind.stochastic) {
            if (!result.stochK) result.stochK = [];
            if (!result.stochD) result.stochD = [];
            if (ind.stochastic["%K"] != null)
              result.stochK.push({ time, value: ind.stochastic["%K"] });
            if (ind.stochastic["%D"] != null)
              result.stochD.push({ time, value: ind.stochastic["%D"] });
          }
          break;
        case "stochrsi":
          if (ind.stochasticRsi) {
            if (!result.stochRsiK) result.stochRsiK = [];
            if (!result.stochRsiD) result.stochRsiD = [];
            if (ind.stochasticRsi["%K"] != null)
              result.stochRsiK.push({ time, value: ind.stochasticRsi["%K"] });
            if (ind.stochasticRsi["%D"] != null)
              result.stochRsiD.push({ time, value: ind.stochasticRsi["%D"] });
          }
          break;
      }
    });

    return result;
  }

  updateIndicatorSeries(type, data) {
    if (!this.series[type]) return;

    Object.entries(this.series[type]).forEach(([key, series]) => {
      if (data[key] && data[key].length) {
        series.setData(data[key]);
      } else if (key.includes("70") || key.includes("80")) {
        // Reference lines
        const value = parseInt(key.match(/\d+/)[0]);
        const refData = this.currentData.map((d) => ({ time: d.time, value }));
        series.setData(refData);
      } else if (key.includes("30") || key.includes("20")) {
        const value = parseInt(key.match(/\d+/)[0]);
        const refData = this.currentData.map((d) => ({ time: d.time, value }));
        series.setData(refData);
      }
    });
  }

  // ✅ Enhanced Real-time Indicator Values Display Update
  updateIndicatorValuesDisplay() {
    if (!this.latestValues || Object.keys(this.latestValues).length === 0) {
      return;
    }

    const values = this.latestValues;

    // Update timestamp
    const timestampEl = document.querySelector("[data-last-update]");
    if (timestampEl && values.timestamp) {
      const date = new Date(values.timestamp * 1000);
      timestampEl.textContent = date.toLocaleTimeString();
    }

    // Format number helper function
    const formatValue = (value, decimals = 2) => {
      if (value === undefined || value === null || isNaN(value)) return "–";
      return typeof value === "number"
        ? value.toFixed(decimals)
        : value.toString();
    };

    // ✅ SMA Values Update
    const sma20El = document.querySelector("[data-sma20]");
    const sma50El = document.querySelector("[data-sma50]");
    if (sma20El && values.sma20 !== undefined) {
      sma20El.textContent = `$${formatValue(values.sma20, 2)}`;
      this.animateValueUpdate(sma20El);
    }
    if (sma50El && values.sma50 !== undefined) {
      sma50El.textContent = `$${formatValue(values.sma50, 2)}`;
      this.animateValueUpdate(sma50El);
    }

    // ✅ EMA Values Update
    const ema20El = document.querySelector("[data-ema20]");
    const ema50El = document.querySelector("[data-ema50]");
    if (ema20El && values.ema20 !== undefined) {
      ema20El.textContent = `$${formatValue(values.ema20, 2)}`;
      this.animateValueUpdate(ema20El);
    }
    if (ema50El && values.ema50 !== undefined) {
      ema50El.textContent = `$${formatValue(values.ema50, 2)}`;
      this.animateValueUpdate(ema50El);
    }

    // ✅ RSI Values Update with Status
    const rsiEl = document.querySelector("[data-rsi]");
    const rsiStatusEl = document.querySelector("[data-rsi-status]");
    if (rsiEl && values.rsi !== undefined) {
      const rsiValue = parseFloat(values.rsi);
      rsiEl.textContent = formatValue(rsiValue, 2);
      this.animateValueUpdate(rsiEl);

      // Update RSI status with enhanced styling
      if (rsiStatusEl) {
        let statusText, statusClass, dotClass;
        if (rsiValue > 70) {
          statusText = "Overbought";
          statusClass = "bg-red-100 text-red-700 border border-red-200";
          dotClass = "bg-red-400";
        } else if (rsiValue < 30) {
          statusText = "Oversold";
          statusClass = "bg-green-100 text-green-700 border border-green-200";
          dotClass = "bg-green-400";
        } else {
          statusText = "Neutral";
          statusClass = "bg-gray-100 text-gray-700 border border-gray-200";
          dotClass = "bg-gray-400";
        }

        rsiStatusEl.innerHTML = `<div class="w-2 h-2 rounded-full mr-2 ${dotClass}"></div>${statusText}`;
        rsiStatusEl.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusClass}`;
      }
    }

    // ✅ MACD Values Update with Parameters
    const macdEl = document.querySelector("[data-macd]");
    const macdSignalEl = document.querySelector("[data-macd-signal]");
    const macdHistEl = document.querySelector("[data-macd-hist]");
    const macdFastEl = document.querySelector("[data-macd-fast]");
    const macdSlowEl = document.querySelector("[data-macd-slow]");
    const macdSignalPeriodEl = document.querySelector(
      "[data-macd-signal-period]"
    );

    if (macdEl && values.macd !== undefined) {
      macdEl.textContent = formatValue(values.macd, 3);
      this.animateValueUpdate(macdEl);
    }
    if (macdSignalEl && values.macdSignal !== undefined) {
      macdSignalEl.textContent = formatValue(values.macdSignal, 3);
      this.animateValueUpdate(macdSignalEl);
    }
    if (macdHistEl && values.macdHist !== undefined) {
      const histValue = parseFloat(values.macdHist);
      macdHistEl.textContent = formatValue(histValue, 3);
      macdHistEl.className =
        histValue >= 0
          ? "font-mono font-bold text-green-700 text-sm"
          : "font-mono font-bold text-red-700 text-sm";
      this.animateValueUpdate(macdHistEl);
    }
    if (macdFastEl && values.macdFast !== undefined) {
      macdFastEl.textContent = values.macdFast;
    }
    if (macdSlowEl && values.macdSlow !== undefined) {
      macdSlowEl.textContent = values.macdSlow;
    }
    if (macdSignalPeriodEl && values.macdSignalPeriod !== undefined) {
      macdSignalPeriodEl.textContent = values.macdSignalPeriod;
    }

    // ✅ Bollinger Bands Values Update
    const bbUpperEl = document.querySelector("[data-bb-upper]");
    const bbLowerEl = document.querySelector("[data-bb-lower]");
    const bbPeriodEl = document.querySelector("[data-bb-period]");
    const bbMultiplierEl = document.querySelector("[data-bb-multiplier]");

    if (bbUpperEl && values.bbUpper !== undefined) {
      bbUpperEl.textContent = `$${formatValue(values.bbUpper, 2)}`;
      this.animateValueUpdate(bbUpperEl);
    }
    if (bbLowerEl && values.bbLower !== undefined) {
      bbLowerEl.textContent = `$${formatValue(values.bbLower, 2)}`;
      this.animateValueUpdate(bbLowerEl);
    }
    if (bbPeriodEl && values.bbPeriod !== undefined) {
      bbPeriodEl.textContent = values.bbPeriod;
    }
    if (bbMultiplierEl && values.bbMultiplier !== undefined) {
      bbMultiplierEl.textContent = values.bbMultiplier;
    }

    // ✅ Stochastic Values Update
    const stochKEl = document.querySelector("[data-stoch-k]");
    const stochDEl = document.querySelector("[data-stoch-d]");
    const stochKPeriodEl = document.querySelector("[data-stoch-k-period]");
    const stochDPeriodEl = document.querySelector("[data-stoch-d-period]");

    if (stochKEl && values.stochK !== undefined) {
      stochKEl.textContent = formatValue(values.stochK, 2);
      this.animateValueUpdate(stochKEl);
    }
    if (stochDEl && values.stochD !== undefined) {
      stochDEl.textContent = formatValue(values.stochD, 2);
      this.animateValueUpdate(stochDEl);
    }
    if (stochKPeriodEl && values.stochKPeriod !== undefined) {
      stochKPeriodEl.textContent = values.stochKPeriod;
    }
    if (stochDPeriodEl && values.stochDPeriod !== undefined) {
      stochDPeriodEl.textContent = values.stochDPeriod;
    }

    // ✅ Stochastic RSI Values Update
    const stochRsiKEl = document.querySelector("[data-stochrsi-k]");
    const stochRsiDEl = document.querySelector("[data-stochrsi-d]");
    const stochRsiRsiPeriodEl = document.querySelector(
      "[data-stochrsi-rsi-period]"
    );
    const stochRsiStochPeriodEl = document.querySelector(
      "[data-stochrsi-stoch-period]"
    );
    const stochRsiKPeriodEl = document.querySelector(
      "[data-stochrsi-k-period]"
    );
    const stochRsiDPeriodEl = document.querySelector(
      "[data-stochrsi-d-period]"
    );

    if (stochRsiKEl && values.stochRsiK !== undefined) {
      stochRsiKEl.textContent = formatValue(values.stochRsiK, 2);
      this.animateValueUpdate(stochRsiKEl);
    }
    if (stochRsiDEl && values.stochRsiD !== undefined) {
      stochRsiDEl.textContent = formatValue(values.stochRsiD, 2);
      this.animateValueUpdate(stochRsiDEl);
    }
    if (stochRsiRsiPeriodEl && values.stochRsiRsiPeriod !== undefined) {
      stochRsiRsiPeriodEl.textContent = values.stochRsiRsiPeriod;
    }
    if (stochRsiStochPeriodEl && values.stochRsiStochPeriod !== undefined) {
      stochRsiStochPeriodEl.textContent = values.stochRsiStochPeriod;
    }
    if (stochRsiKPeriodEl && values.stochRsiKPeriod !== undefined) {
      stochRsiKPeriodEl.textContent = values.stochRsiKPeriod;
    }
    if (stochRsiDPeriodEl && values.stochRsiDPeriod !== undefined) {
      stochRsiDPeriodEl.textContent = values.stochRsiDPeriod;
    }

    // ✅ Parabolic SAR Values Update
    const psarEl = document.querySelector("[data-psar]");
    const psarStepEl = document.querySelector("[data-psar-step]");
    const psarMaxStepEl = document.querySelector("[data-psar-max-step]");
    const psarTrendEl = document.querySelector("[data-psar-trend]");

    if (psarEl && values.psar !== undefined) {
      psarEl.textContent = `$${formatValue(values.psar, 2)}`;
      this.animateValueUpdate(psarEl);
    }
    if (psarStepEl && values.psarStep !== undefined) {
      psarStepEl.textContent = values.psarStep;
    }
    if (psarMaxStepEl && values.psarMaxStep !== undefined) {
      psarMaxStepEl.textContent = values.psarMaxStep;
    }
    if (psarTrendEl) {
      psarTrendEl.textContent = "Active";
      psarTrendEl.className =
        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700";
    }

    console.log("✅ Indicator values display updated successfully");
  }

  // ✅ Smooth animation for value updates
  animateValueUpdate(element) {
    if (!element) return;

    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.15s ease-out";
    element.style.backgroundColor = "rgba(59, 130, 246, 0.1)";

    setTimeout(() => {
      element.style.transform = "scale(1)";
      element.style.backgroundColor = "";
    }, 150);
  }

  updateParameterDisplays() {
    if (!this.latestValues) return;

    const parameterUpdates = {
      // MACD parameters
      "[data-macd-fast]": this.latestValues.macdFast,
      "[data-macd-slow]": this.latestValues.macdSlow,
      "[data-macd-signal-period]": this.latestValues.macdSignalPeriod,

      // Bollinger Bands parameters
      "[data-bb-period]": this.latestValues.bbPeriod,
      "[data-bb-multiplier]": this.latestValues.bbMultiplier,

      // Stochastic parameters
      "[data-stoch-k-period]": this.latestValues.stochKPeriod,
      "[data-stoch-d-period]": this.latestValues.stochDPeriod,

      // Stochastic RSI parameters
      "[data-stochrsi-rsi-period]": this.latestValues.stochRsiRsiPeriod,
      "[data-stochrsi-stoch-period]": this.latestValues.stochRsiStochPeriod,
      "[data-stochrsi-k-period]": this.latestValues.stochRsiKPeriod,
      "[data-stochrsi-d-period]": this.latestValues.stochRsiDPeriod,

      // Parabolic SAR parameters
      "[data-psar-step]": this.latestValues.psarStep,
      "[data-psar-max-step]": this.latestValues.psarMaxStep,
    };

    Object.entries(parameterUpdates).forEach(([selector, value]) => {
      const el = document.querySelector(selector);
      if (el && value !== undefined && value !== null) {
        el.textContent = value;
      }
    });
  }

  destroy() {
    console.log("🗑️ Destroying chart with sync cleanup...");

    // Clear sync timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.isSyncing = false;
    this.activeIndicators.clear();
    this.series = {};
    this.currentData = [];
    this.latestValues = {};

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candleSeries = null;
    }

    Object.values(this.subCharts).forEach(({ chart }) => {
      if (chart) chart.remove();
    });
    this.subCharts = {};

    this.isInitialized = false;
    this.isFullscreen = false;
  }
}
