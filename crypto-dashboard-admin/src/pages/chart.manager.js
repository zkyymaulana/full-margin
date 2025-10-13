/**
 * Chart Manager Module - Handle Candlestick Chart
 */
import { createChart, ColorType } from "lightweight-charts";

export class CandlestickChart {
  constructor(containerId) {
    this.containerId = containerId;
    this.chart = null;
    this.candleSeries = null;
    this.isInitialized = false;
    this.resizeObserver = null;
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`❌ Container with ID '${this.containerId}' not found!`);
      return false;
    }

    if (this.isInitialized && this.chart) {
      console.log(`⚠️ Chart already initialized, skip duplicate init`);
      return true;
    }

    console.log(`🚀 Initializing chart in container:`, container);

    // Setup container
    container.style.width = "100%";
    container.style.height = "400px";
    container.style.position = "relative";
    container.style.display = "block";
    container.style.background = "#ffffff";

    // Remove loading overlay
    const loadingOverlay = container.querySelector(".chart-loading");
    if (loadingOverlay) {
      loadingOverlay.remove();
    }

    // Clear container content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    try {
      const width = container.clientWidth || 800;
      const height = 400;

      // Create chart
      this.chart = createChart(container, {
        width: width,
        height: height,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#333333",
        },
        grid: {
          vertLines: { color: "#e1e1e1" },
          horzLines: { color: "#e1e1e1" },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: "#cccccc",
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        timeScale: {
          borderColor: "#cccccc",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 6,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      // Add candlestick series
      this.candleSeries = this.chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        priceFormat: {
          type: "price",
          precision: 2,
          minMove: 0.01,
        },
      });

      // Setup resize observer
      this.resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || entries[0].target !== container) return;
        const newWidth = entries[0].contentRect.width;
        if (newWidth > 0 && this.chart) {
          this.chart.applyOptions({ width: newWidth });
        }
      });

      this.resizeObserver.observe(container);
      this.isInitialized = true;

      console.log(`🎉 Chart initialization completed successfully!`);
      return true;
    } catch (error) {
      console.error(`❌ Error creating chart:`, error);
      return false;
    }
  }

  processBackendData(response) {
    if (!response || !response.success || !Array.isArray(response.candles)) {
      return [];
    }

    const processed = response.candles
      .filter(
        (candle) =>
          candle &&
          typeof candle.time === "number" &&
          typeof candle.open === "number" &&
          typeof candle.high === "number" &&
          typeof candle.low === "number" &&
          typeof candle.close === "number"
      )
      .map((candle) => {
        let fixedTime = candle.time;

        // Convert milliseconds to seconds if needed
        if (candle.time > 1800000000) {
          fixedTime = Math.floor(candle.time / 1000);
        }

        return {
          time: fixedTime,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
        };
      })
      .sort((a, b) => a.time - b.time);

    return processed;
  }

  updateData(candleData) {
    if (!this.chart || !this.candleSeries) {
      console.error(`❌ Cannot update chart: chart not initialized`);
      return;
    }

    if (!candleData || !Array.isArray(candleData)) {
      console.error(`❌ Invalid candle data`);
      return;
    }

    try {
      const formattedData = this.processBackendData({
        success: true,
        candles: candleData,
      });

      if (formattedData.length === 0) {
        console.error(`❌ No valid data after formatting`);
        return;
      }

      this.candleSeries.setData(formattedData);

      setTimeout(() => {
        try {
          if (this.chart && this.chart.timeScale) {
            this.chart.timeScale().fitContent();
          }
        } catch (fitError) {
          console.error(`❌ Error fitting content:`, fitError);
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error updating chart data:", error);
    }
  }

  destroy() {
    console.log(`🗑️ Destroying chart...`);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candleSeries = null;
      this.isInitialized = false;
    }
  }
}
