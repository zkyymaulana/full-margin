/**
 * Chart configuration utilities
 * Provides shared options for Lightweight Charts
 */

export const getBaseChartOptions = (
  isDarkMode,
  height,
  isMainChart = false
) => ({
  width: 0,
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
    minimumWidth: 80,
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
    mode: 1,
    vertLine: {
      width: 1,
      color: isDarkMode ? "#6b7280" : "#9ca3af",
      style: 2,
      visible: true,
      labelVisible: true,
      labelBackgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
    },
    horzLine: {
      width: 1,
      color: isDarkMode ? "#6b7280" : "#9ca3af",
      style: 2,
      visible: true,
      labelVisible: true,
      labelBackgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
    },
  },
  overlayPriceScales: {},
  timeScale: getTimeScaleOptions(isMainChart ? false : true),
  localization: {
    // ✅ Format untuk crosshair label bawah (HANYA saat crosshair aktif)
    timeFormatter: (businessDayOrTimestamp) => {
      if (
        typeof businessDayOrTimestamp === "object" &&
        businessDayOrTimestamp.year
      ) {
        const { year, month, day } = businessDayOrTimestamp;
        const date = new Date(year, month - 1, day);
        const monthName = date.toLocaleString("en-US", { month: "short" });
        return `${String(day).padStart(2, "0")} ${monthName} ${year}, 00:00`;
      } else if (typeof businessDayOrTimestamp === "number") {
        const date = new Date(businessDayOrTimestamp * 1000);
        const day = String(date.getDate()).padStart(2, "0");
        const month = date.toLocaleString("en-US", { month: "short" });
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${day} ${month} ${year}, ${hours}:${minutes}`;
      }
      return String(businessDayOrTimestamp);
    },
  },
  watermark: {
    visible: false,
  },
});

export const getTimeScaleOptions = (showTimeScale = true) => ({
  timeVisible: false, // ❌ Jangan tampilkan jam di time scale bawah
  secondsVisible: false,
  rightOffset: 20,
  barSpacing: 8,
  minBarSpacing: 1,
  fixLeftEdge: false,
  fixRightEdge: false,
  lockVisibleTimeRangeOnResize: true,
  rightBarStaysOnScroll: true,
  borderVisible: showTimeScale,
  borderColor: "#4b5563",
  visible: true,
});

// Available indicators configuration
export const overlayIndicators = [
  {
    id: "sma",
    label: "SMA (20, 50)",
    color: "#2962FF",
    type: "sma",
    periods: [20, 50],
    colors: ["#2962FF", "#4A90E2"],
  },
  {
    id: "ema",
    label: "EMA (20, 50)",
    color: "#9C27B0",
    type: "ema",
    periods: [20, 50],
    colors: ["#9C27B0", "#BA68C8"],
  },
  {
    id: "bollinger",
    label: "Bollinger B. (20, 2)",
    type: "bollinger",
    // Three separate bands with distinct cyan/teal colors
    bands: ["upper", "middle", "lower"],
    colors: ["#00BCD4", "#26C6DA", "#00ACC1"], // Upper, Middle, Lower
  },
  {
    id: "psar",
    label: "PSAR (0.02 / 0.2)",
    color: "#FF6A00",
    type: "psar",
    isDots: true, // Flag to render as dots instead of line
  },
];

export const oscillatorIndicators = [
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

// Helper functions
export const getIndicatorValue = (candle, type) => {
  if (!candle.indicators) return null;

  switch (type) {
    case "sma":
      return candle.indicators.sma?.[20];
    case "ema":
      return candle.indicators.ema?.[20];
    case "bollinger":
      // Return object with all three bands
      return candle.indicators.bollingerBands;
    case "psar":
      return candle.indicators.parabolicSar?.value;
    default:
      return null;
  }
};

export const getIndicatorValueByPeriod = (candle, type, period) => {
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

// Format utilities
export const formatPrice = (price) => {
  if (!price && price !== 0) return "N/A";
  if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(6)}`;
};

export const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  return num.toFixed(2);
};

export const formatVolume = (volume) => {
  if (!volume && volume !== 0) return "N/A";
  if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(2)}B`;
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
  return volume.toFixed(2);
};

// ✅ Series options to hide corner tooltip (black box)
export const getCleanSeriesOptions = () => ({
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: true,
});
