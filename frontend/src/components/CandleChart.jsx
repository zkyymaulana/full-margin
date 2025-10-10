import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { useCandles } from "../hooks/useCandles";

export default function CandleChart({ symbol = "BTC-USD" }) {
  const chartContainerRef = useRef();
  const candlestickChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const lastPriceLineRef = useRef(null);

  // State management
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [chartsInitialized, setChartsInitialized] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const [currentCandle, setCurrentCandle] = useState(null); // For OHLCV display
  const [hoveredCandle, setHoveredCandle] = useState(null); // For hover OHLCV

  const { data, isLoading: dataLoading, error } = useCandles(symbol);

  // 🔍 Debug function to update debug info
  const updateDebugInfo = (key, value) => {
    setDebugInfo((prev) => ({
      ...prev,
      [key]: value,
      lastUpdated: new Date().toLocaleTimeString(),
    }));
    console.log(`🔍 DEBUG [${key}]:`, value);
  };

  // ✅ Initialize chart with proper DOM readiness check
  useEffect(() => {
    console.log("🔧 Starting chart initialization...");
    updateDebugInfo("initStep", "Starting chart initialization");

    const initializeAfterDOMReady = () => {
      console.log("🔍 Checking DOM readiness...");
      updateDebugInfo("domCheck", {
        containerExists: !!chartContainerRef.current,
        containerWidth: chartContainerRef.current?.offsetWidth,
        containerHeight: chartContainerRef.current?.offsetHeight,
      });

      if (!chartContainerRef.current) {
        console.error("❌ Chart container ref still not available");
        updateDebugInfo(
          "initError",
          "Chart container ref not available after DOM check"
        );
        setTimeout(initializeAfterDOMReady, 100);
        return;
      }

      if (
        chartContainerRef.current.offsetWidth === 0 ||
        chartContainerRef.current.offsetHeight === 0
      ) {
        console.error("❌ Chart container has zero dimensions");
        updateDebugInfo("initError", "Chart container has zero dimensions");
        setTimeout(initializeAfterDOMReady, 100);
        return;
      }

      initializeCharts();
    };

    setTimeout(initializeAfterDOMReady, 50);

    return () => {
      if (candlestickChartRef.current) {
        candlestickChartRef.current.remove();
        candlestickChartRef.current = null;
      }
    };
  }, []);

  // ✅ Chart initialization function with crosshair event handlers
  const initializeCharts = () => {
    updateDebugInfo("containerSize", {
      width: chartContainerRef.current.offsetWidth,
      height: chartContainerRef.current.offsetHeight,
    });

    // Cleanup existing charts
    if (candlestickChartRef.current) {
      console.log("🧹 Cleaning up existing candlestick chart");
      candlestickChartRef.current.remove();
      candlestickChartRef.current = null;
    }

    try {
      console.log(
        "🔧 Creating TradingView-style chart with lightweight-charts v4.1.3"
      );
      updateDebugInfo("initStep", "Creating TradingView-style chart");

      // Create main candlestick chart - TradingView style
      const candlestickChart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.offsetWidth,
        height: chartContainerRef.current.offsetHeight,
        layout: {
          backgroundColor: "#1a1a1a",
          textColor: "#ffffff",
        },
        grid: {
          vertLines: { color: "#2a2a2a" },
          horzLines: { color: "#2a2a2a" },
        },
        crosshair: {
          mode: 1, // Normal crosshair
        },
        rightPriceScale: {
          borderColor: "#485158",
          textColor: "#ffffff",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "#485158",
          textColor: "#ffffff",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12, // Space for future candles
          barSpacing: 3, // TradingView-like spacing
          fixLeftEdge: false,
          lockVisibleTimeRangeOnResize: true,
        },
        localization: {
          timeFormatter: (time) => {
            return new Date(time * 1000).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          },
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

      console.log("✅ Candlestick chart created successfully");
      updateDebugInfo("candlestickChart", "Created successfully");
      candlestickChartRef.current = candlestickChart;

      // Add candlestick series - TradingView colors
      const candleSeries = candlestickChart.addCandlestickSeries({
        upColor: "#26a69a", // Green for bullish
        downColor: "#ef5350", // Red for bearish
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        priceFormat: {
          type: "price",
          precision: 2,
          minMove: 0.01,
        },
      });

      console.log("✅ Candlestick series created successfully");
      updateDebugInfo("candlestickSeries", "Created successfully");
      candleSeriesRef.current = candleSeries;

      // Add last price line (TradingView-style)
      const lastPriceLine = candlestickChart.addLineSeries({
        color: "#f7931a", // Bitcoin orange
        lineWidth: 2,
        crosshairMarkerVisible: false,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: {
          type: "price",
          precision: 2,
          minMove: 0.01,
        },
      });

      console.log("✅ Last price line created successfully");
      updateDebugInfo("lastPriceLine", "Created successfully");
      lastPriceLineRef.current = lastPriceLine;

      // ✅ Add crosshair move handler for OHLCV display
      candlestickChart.subscribeCrosshairMove((param) => {
        if (param.time) {
          const candleData = param.seriesData.get(candleSeries);
          if (candleData) {
            setHoveredCandle({
              time: param.time,
              open: candleData.open,
              high: candleData.high,
              low: candleData.low,
              close: candleData.close,
              // Volume would need to be added to the series data if available
            });
          }
        } else {
          setHoveredCandle(null);
        }
      });

      // Mark charts as initialized
      setChartsInitialized(true);
      console.log("✅ Charts initialized successfully");
      updateDebugInfo("initStep", "Charts initialized successfully");
      updateDebugInfo("initSuccess", true);

      // Handle window resize
      const handleResize = () => {
        if (candlestickChartRef.current && chartContainerRef.current) {
          candlestickChartRef.current.applyOptions({
            width: chartContainerRef.current.offsetWidth,
            height: chartContainerRef.current.offsetHeight,
          });
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      console.error("❌ Error initializing charts:", error);
      updateDebugInfo("initError", {
        message: error.message,
        stack: error.stack,
      });
      setConnectionStatus(`Init Error: ${error.message}`);
      setChartsInitialized(false);
    }
  };

  // ✅ Process backend data - handle the exact API response format
  const processBackendData = (response) => {
    console.log("🔍 Processing backend response...");
    updateDebugInfo("dataProcessing", "Starting data processing");

    if (!response || !response.success) {
      console.error("❌ Invalid response format:", response);
      updateDebugInfo("dataError", "Invalid response format");
      return [];
    }

    if (!Array.isArray(response.candles)) {
      console.error(
        "❌ Candles data is not an array:",
        typeof response.candles
      );
      updateDebugInfo("dataError", "Candles data is not an array");
      return [];
    }

    console.log(`📊 Response summary:`, {
      symbol: response.symbol,
      totalCandles: response.totalCandles,
      returned: response.returned,
      candlesLength: response.candles.length,
    });

    updateDebugInfo("responseData", {
      symbol: response.symbol,
      totalCandles: response.totalCandles,
      returned: response.returned,
      candlesLength: response.candles.length,
      firstCandle: response.candles[0],
      lastCandle: response.candles[response.candles.length - 1],
    });

    // Process each candle
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
        // Fix future timestamps if needed (your data shows year 2055)
        let fixedTime = candle.time;

        // If timestamp is in the far future, convert to current time range
        if (candle.time > 1800000000) {
          // After year 2027
          // Map future timestamps to current time range (last year)
          const currentEnd = Math.floor(Date.now() / 1000);
          const currentStart = currentEnd - 365 * 24 * 60 * 60; // 1 year ago

          // Simple mapping: distribute the data over the past year
          const dataStart = response.candles[0].time;
          const dataEnd = response.candles[response.candles.length - 1].time;
          const dataRange = dataEnd - dataStart;
          const ratio = (candle.time - dataStart) / dataRange;

          fixedTime = Math.floor(
            currentStart + ratio * (currentEnd - currentStart)
          );
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

    console.log(`📊 Processed ${processed.length} candles successfully`);
    updateDebugInfo("processedData", {
      length: processed.length,
      timeRange:
        processed.length > 0
          ? {
              start: new Date(processed[0].time * 1000).toISOString(),
              end: new Date(
                processed[processed.length - 1].time * 1000
              ).toISOString(),
            }
          : null,
      sampleCandles: processed.slice(0, 3),
    });

    return processed;
  };

  // ✅ Update chart data with OHLCV tracking
  useEffect(() => {
    console.log("📊 Data update effect triggered");
    updateDebugInfo("dataUpdateTrigger", {
      hasData: !!data,
      dataType: typeof data,
      chartsInitialized,
      timestamp: new Date().toISOString(),
    });

    if (!chartsInitialized) {
      console.log("⏳ Charts not initialized yet");
      updateDebugInfo("dataUpdateStatus", "Charts not initialized yet");
      return;
    }

    if (!candleSeriesRef.current) {
      console.log("⏳ Candle series not ready yet");
      updateDebugInfo("dataUpdateStatus", "Candle series not ready");
      return;
    }

    if (!data) {
      console.log("⏳ Data not available");
      updateDebugInfo("dataUpdateStatus", "Data not available");
      return;
    }

    console.log("📊 Processing API response:", data);

    try {
      const processedData = processBackendData(data);

      if (processedData.length > 0) {
        console.log("✅ Setting data to chart...");

        // Set candlestick data
        candleSeriesRef.current.setData(processedData);
        console.log("✅ Candlestick data set successfully");

        // Update last price and current candle info
        const latestCandle = processedData[processedData.length - 1];
        setLastPrice(latestCandle.close);
        setCurrentCandle(latestCandle);

        // Update last price line
        if (lastPriceLineRef.current) {
          lastPriceLineRef.current.setData([
            {
              time: latestCandle.time,
              value: latestCandle.close,
            },
          ]);
        }

        // Apply TradingView-style zoom (show recent data)
        setTimeout(() => {
          if (candlestickChartRef.current) {
            // Show last 200 hours (about 8 days) for 1h timeframe
            const visibleRange = Math.min(200, processedData.length);
            candlestickChartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, processedData.length - visibleRange),
              to: processedData.length - 1,
            });
            console.log("✅ Chart zoom applied");
          }
        }, 100);

        updateDebugInfo("dataSetSuccess", {
          candlesLoaded: processedData.length,
          lastPrice: latestCandle.close,
          timeRange: {
            start: new Date(processedData[0].time * 1000).toLocaleString(),
            end: new Date(latestCandle.time * 1000).toLocaleString(),
          },
        });

        setConnectionStatus(
          `Connected - $${latestCandle.close.toLocaleString()}`
        );
        console.log("✅ Chart updated successfully");
      } else {
        console.error("❌ No valid data to display");
        setConnectionStatus("No valid data");
        updateDebugInfo("dataUpdateError", "No valid data after processing");
      }
    } catch (error) {
      console.error("❌ Error updating chart data:", error);
      setConnectionStatus(`Error: ${error.message}`);
      updateDebugInfo("dataUpdateError", {
        message: error.message,
        stack: error.stack,
      });
    }
  }, [data, chartsInitialized]);

  // Loading state
  if (dataLoading) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-900">
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <h1 className="text-xl font-semibold text-white">
            📊 {symbol} Chart - 1 Hour
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400 text-lg">Loading chart data...</p>
            <p className="text-gray-500 text-sm">Fetching 1-hour candles</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-900">
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <h1 className="text-xl font-semibold text-white">
            📊 {symbol} Chart - 1 Hour
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">❌ Failed to load chart</p>
            <p className="text-gray-500 text-sm mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to format numbers
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  // Helper function to format volume
  const formatVolume = (volume) => {
    if (volume === null || volume === undefined) return "N/A";
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return formatNumber(volume, 2);
  };

  // Helper function to get price change color
  const getPriceChangeColor = (current, previous) => {
    if (!current || !previous) return "text-gray-300";
    return current >= previous ? "text-green-400" : "text-red-400";
  };

  // Calculate price change from current candle
  const priceChange = currentCandle
    ? currentCandle.close - currentCandle.open
    : 0;
  const priceChangePercent =
    currentCandle && currentCandle.open
      ? ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100
      : 0;

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* TradingView-style Header with OHLCV */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">
              📊 {symbol} Chart
            </h1>
            <div className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
              1 Hour
            </div>
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              {showDebugPanel ? "Hide Debug" : "Show Debug"}
            </button>
            <div
              className={`px-2 py-1 text-xs rounded ${
                chartsInitialized
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              Charts: {chartsInitialized ? "Ready" : "Initializing..."}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {data && (
              <div className="text-sm text-gray-300">
                <span className="text-yellow-400">Total:</span>{" "}
                {data.totalCandles?.toLocaleString()} candles
                <span className="ml-4 text-green-400">Loaded:</span>{" "}
                {data.returned} candles
              </div>
            )}
          </div>
        </div>

        {/* OHLCV Information Panel */}
        {(hoveredCandle || currentCandle) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              {/* Display hovered candle info if hovering, otherwise current candle */}
              {(() => {
                const displayCandle = hoveredCandle || currentCandle;
                const isLatest = !hoveredCandle && currentCandle;

                return (
                  <>
                    {/* Time */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Time
                      </span>
                      <span className="text-white font-medium">
                        {new Date(displayCandle.time * 1000).toLocaleString(
                          "id-ID",
                          {
                            timeZone: "Asia/Jakarta",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                        {isLatest && (
                          <span className="ml-1 text-xs text-green-400">
                            (Latest)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Open */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Open
                      </span>
                      <span className="text-white font-medium">
                        ${formatNumber(displayCandle.open)}
                      </span>
                    </div>

                    {/* High */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        High
                      </span>
                      <span className="text-green-400 font-medium">
                        ${formatNumber(displayCandle.high)}
                      </span>
                    </div>

                    {/* Low */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Low
                      </span>
                      <span className="text-red-400 font-medium">
                        ${formatNumber(displayCandle.low)}
                      </span>
                    </div>

                    {/* Close */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Close
                      </span>
                      <span
                        className={`font-medium ${getPriceChangeColor(
                          displayCandle.close,
                          displayCandle.open
                        )}`}
                      >
                        ${formatNumber(displayCandle.close)}
                      </span>
                    </div>

                    {/* Volume */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Volume
                      </span>
                      <span className="text-blue-400 font-medium">
                        {formatVolume(displayCandle.volume)}
                      </span>
                    </div>

                    {/* Price Change (only for current candle) */}
                    {isLatest && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">
                          Change
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${getPriceChangeColor(
                              displayCandle.close,
                              displayCandle.open
                            )}`}
                          >
                            {priceChange >= 0 ? "+" : ""}$
                            {formatNumber(priceChange)}
                          </span>
                          <span
                            className={`text-xs ${getPriceChangeColor(
                              displayCandle.close,
                              displayCandle.open
                            )}`}
                          >
                            ({priceChangePercent >= 0 ? "+" : ""}
                            {formatNumber(priceChangePercent)}%)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Range (High - Low) */}
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Range
                      </span>
                      <span className="text-yellow-400 font-medium">
                        ${formatNumber(displayCandle.high - displayCandle.low)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="bg-gray-800 border-b border-gray-700 p-4 max-h-60 overflow-y-auto">
          <h3 className="text-white font-semibold mb-2">
            🔍 Debug Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {Object.entries(debugInfo).map(([key, value]) => (
              <div key={key} className="bg-gray-700 p-2 rounded">
                <div className="text-yellow-400 font-medium">{key}:</div>
                <div className="text-gray-300 mt-1 max-h-20 overflow-y-auto">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="flex-1 flex flex-col relative">
        {/* Status Indicator */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-gray-800 bg-opacity-90 px-3 py-2 rounded-md">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus.includes("Connected")
                ? "bg-green-500 animate-pulse"
                : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs text-gray-300">{connectionStatus}</span>
        </div>

        {/* Main Chart */}
        <div className="flex-1 min-h-0">
          <div ref={chartContainerRef} className="w-full h-full bg-gray-900" />
        </div>
      </div>
    </div>
  );
}
