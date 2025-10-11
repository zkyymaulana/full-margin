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
  const [currentCandle, setCurrentCandle] = useState(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  const {
    data,
    isLoading: dataLoading,
    error,
    isFetching,
  } = useCandles(symbol);

  // 🔍 Debug function
  const updateDebugInfo = (key, value) => {
    setDebugInfo((prev) => ({
      ...prev,
      [key]: value,
      lastUpdated: new Date().toLocaleTimeString(),
    }));
    console.log(`🔍 DEBUG [${key}]:`, value);
  };

  // ✅ Initialize chart - TAMBAHKAN symbol ke dependency array
  useEffect(() => {
    console.log(`🔧 Initializing chart for symbol: ${symbol}`);
    updateDebugInfo("initStep", `Initializing for ${symbol}`);

    const initializeAfterDOMReady = () => {
      if (!chartContainerRef.current) {
        setTimeout(initializeAfterDOMReady, 100);
        return;
      }

      if (
        chartContainerRef.current.offsetWidth === 0 ||
        chartContainerRef.current.offsetHeight === 0
      ) {
        setTimeout(initializeAfterDOMReady, 100);
        return;
      }

      initializeCharts();
    };

    setTimeout(initializeAfterDOMReady, 50);

    return () => {
      // Cleanup saat symbol berubah atau unmount
      if (candlestickChartRef.current) {
        console.log(`🧹 Cleaning up chart for ${symbol}`);
        candlestickChartRef.current.remove();
        candlestickChartRef.current = null;
      }
      setChartsInitialized(false);
    };
  }, [symbol]); // ⚠️ PERBAIKAN: Tambahkan symbol ke dependency

  // Chart initialization
  const initializeCharts = () => {
    // Cleanup existing charts
    if (candlestickChartRef.current) {
      candlestickChartRef.current.remove();
      candlestickChartRef.current = null;
    }

    try {
      console.log("🔧 Creating chart...");

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
          mode: 1,
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
          rightOffset: 12,
          barSpacing: 3,
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

      candlestickChartRef.current = candlestickChart;

      const candleSeries = candlestickChart.addCandlestickSeries({
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

      candleSeriesRef.current = candleSeries;

      const lastPriceLine = candlestickChart.addLineSeries({
        color: "#f7931a",
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

      lastPriceLineRef.current = lastPriceLine;

      // Crosshair handler
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
            });
          }
        } else {
          setHoveredCandle(null);
        }
      });

      setChartsInitialized(true);
      console.log("✅ Chart initialized");

      // Window resize handler
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
      console.error("❌ Error initializing chart:", error);
      setConnectionStatus(`Init Error: ${error.message}`);
      setChartsInitialized(false);
    }
  };

  // Process backend data
  const processBackendData = (response) => {
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

        if (candle.time > 1800000000) {
          const currentEnd = Math.floor(Date.now() / 1000);
          const currentStart = currentEnd - 365 * 24 * 60 * 60;
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

    return processed;
  };

  // Update chart data
  useEffect(() => {
    if (!chartsInitialized || !candleSeriesRef.current || !data) {
      return;
    }

    try {
      const processedData = processBackendData(data);

      if (processedData.length > 0) {
        // Clear previous data first
        candleSeriesRef.current.setData([]);

        // Set new data
        candleSeriesRef.current.setData(processedData);

        const latestCandle = processedData[processedData.length - 1];
        setLastPrice(latestCandle.close);
        setCurrentCandle(latestCandle);

        if (lastPriceLineRef.current) {
          lastPriceLineRef.current.setData([
            {
              time: latestCandle.time,
              value: latestCandle.close,
            },
          ]);
        }

        setTimeout(() => {
          if (candlestickChartRef.current) {
            const visibleRange = Math.min(200, processedData.length);
            candlestickChartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, processedData.length - visibleRange),
              to: processedData.length - 1,
            });
          }
        }, 100);

        setConnectionStatus(
          `Connected - $${latestCandle.close.toLocaleString()}`
        );
      } else {
        setConnectionStatus("No valid data");
      }
    } catch (error) {
      console.error("❌ Error updating chart:", error);
      setConnectionStatus(`Error: ${error.message}`);
    }
  }, [data, chartsInitialized]);

  // Helper functions
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatVolume = (volume) => {
    if (volume === null || volume === undefined) return "N/A";
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return formatNumber(volume, 2);
  };

  const getPriceChangeColor = (current, previous) => {
    if (!current || !previous) return "text-gray-300";
    return current >= previous ? "text-green-400" : "text-red-400";
  };

  const priceChange = currentCandle
    ? currentCandle.close - currentCandle.open
    : 0;
  const priceChangePercent =
    currentCandle && currentCandle.open
      ? ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100
      : 0;

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

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">
              📊 {symbol} Chart
            </h1>
            <div className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
              1 Hour
            </div>
            {isFetching && (
              <div className="px-3 py-1 text-xs bg-orange-600 text-white rounded animate-pulse">
                🔄 Updating...
              </div>
            )}
            <div className="px-2 py-1 text-xs bg-green-600 text-white rounded">
              Auto-refresh: 5s
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

        {/* OHLCV Panel */}
        {(hoveredCandle || currentCandle) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              {(() => {
                const displayCandle = hoveredCandle || currentCandle;
                const isLatest = !hoveredCandle && currentCandle;

                return (
                  <>
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

                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Open
                      </span>
                      <span className="text-white font-medium">
                        ${formatNumber(displayCandle.open)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        High
                      </span>
                      <span className="text-green-400 font-medium">
                        ${formatNumber(displayCandle.high)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Low
                      </span>
                      <span className="text-red-400 font-medium">
                        ${formatNumber(displayCandle.low)}
                      </span>
                    </div>

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

                    <div className="flex flex-col">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Volume
                      </span>
                      <span className="text-blue-400 font-medium">
                        {formatVolume(displayCandle.volume)}
                      </span>
                    </div>

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

      {/* Chart Container */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-gray-800 bg-opacity-90 px-3 py-2 rounded-md">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus.includes("Connected")
                ? "bg-green-500 animate-pulse"
                : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs text-gray-300">{connectionStatus}</span>
          {isFetching && (
            <span className="text-xs text-orange-400 ml-2">🔄</span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <div ref={chartContainerRef} className="w-full h-full bg-gray-900" />
        </div>
      </div>
    </div>
  );
}
