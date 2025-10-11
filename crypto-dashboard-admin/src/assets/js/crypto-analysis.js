/**
 * Crypto Analysis Dashboard JavaScript
 * Handles data fetching, chart rendering, and UI updates
 */

class CryptoAnalysisDashboard {
  constructor() {
    this.currentSymbol = "BTC-USD";
    this.charts = {};
    this.apiBaseUrl = "http://localhost:8000/api";
    this.isLoading = false;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeCharts();
    this.fetchAnalysisData();

    // Auto-refresh every 30 seconds
    setInterval(() => {
      if (!this.isLoading) {
        this.fetchAnalysisData();
      }
    }, 30000);
  }

  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById("refreshBtn");
    refreshBtn.addEventListener("click", () => {
      this.fetchAnalysisData();
    });

    // Symbol selector
    const symbolOptions = document.querySelectorAll(".symbol-option");
    symbolOptions.forEach((option) => {
      option.addEventListener("click", (e) => {
        e.preventDefault();
        const symbol = e.target.getAttribute("data-symbol");
        this.changeSymbol(symbol);
      });
    });
  }

  changeSymbol(symbol) {
    this.currentSymbol = symbol;
    document.getElementById("symbolSelector").textContent = symbol;
    document.getElementById("chartTitle").textContent = `${symbol} Price Chart`;
    this.fetchAnalysisData();
  }

  async fetchAnalysisData() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoadingState();

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/analysis/${this.currentSymbol}`
      );
      const data = await response.json();

      if (data.success) {
        this.updateDashboard(data);
      } else {
        this.showError("Failed to fetch analysis data");
      }
    } catch (error) {
      console.error("Error fetching analysis data:", error);
      this.showError("Network error. Please check if the backend is running.");
    } finally {
      this.isLoading = false;
    }
  }

  showLoadingState() {
    const refreshBtn = document.getElementById("refreshBtn");
    const icon = refreshBtn.querySelector("i");
    icon.classList.add("animate-spin");

    // Show loading in signal card
    document.getElementById("signalLabel").textContent = "LOADING...";
    document.getElementById("signalLabel").className =
      "text-4xl font-bold text-gray-400 mb-2";
  }

  showError(message) {
    // Show error in signal card
    document.getElementById("signalLabel").textContent = "ERROR";
    document.getElementById("signalLabel").className =
      "text-4xl font-bold text-red-500 mb-2";
    document.getElementById("confidenceText").textContent = message;

    // Stop refresh icon animation
    const refreshBtn = document.getElementById("refreshBtn");
    const icon = refreshBtn.querySelector("i");
    icon.classList.remove("animate-spin");
  }

  updateDashboard(data) {
    // Stop refresh icon animation
    const refreshBtn = document.getElementById("refreshBtn");
    const icon = refreshBtn.querySelector("i");
    icon.classList.remove("animate-spin");

    // Update timestamps
    const timestamp = new Date(data.timestamp).toLocaleString();
    document.getElementById(
      "lastUpdate"
    ).textContent = `Last updated: ${timestamp}`;
    document.getElementById(
      "footerTimestamp"
    ).textContent = `Last updated: ${timestamp}`;

    // Update combined signal
    this.updateCombinedSignal(data.combinedSignal);

    // Update indicator values
    this.updateIndicatorValues(data.indicators);

    // Update charts
    this.updateCharts(data.indicators);
  }

  updateCombinedSignal(signal) {
    const signalLabel = document.getElementById("signalLabel");
    const confidenceBar = document.getElementById("confidenceBar");
    const confidenceText = document.getElementById("confidenceText");

    // Update signal label with appropriate colors
    signalLabel.textContent = signal.finalSignal;

    let signalClass, barClass;
    switch (signal.finalSignal) {
      case "BUY":
        signalClass = "text-4xl font-bold text-green-500 mb-2";
        barClass = "bg-green-500 h-2 rounded-full transition-all duration-300";
        break;
      case "SELL":
        signalClass = "text-4xl font-bold text-red-500 mb-2";
        barClass = "bg-red-500 h-2 rounded-full transition-all duration-300";
        break;
      default: // HOLD
        signalClass = "text-4xl font-bold text-yellow-500 mb-2";
        barClass = "bg-yellow-500 h-2 rounded-full transition-all duration-300";
    }

    signalLabel.className = signalClass;
    confidenceBar.className = barClass;

    // Update confidence
    const confidence = Math.abs(signal.confidence) * 100;
    confidenceBar.style.width = `${confidence}%`;
    confidenceText.textContent = `Confidence: ${confidence.toFixed(1)}%`;
  }

  updateIndicatorValues(indicators) {
    // Quick stats
    document.getElementById("quickRsi").textContent = indicators.rsi.toFixed(2);
    document.getElementById("quickMacd").textContent =
      indicators.macd.line.toFixed(2);
    document.getElementById("quickSma").textContent = this.formatPrice(
      indicators.sma20
    );

    // RSI
    document.getElementById("rsiValue").textContent = indicators.rsi.toFixed(2);
    const rsiStatus = this.getRSIStatus(indicators.rsi);
    document.getElementById("rsiStatus").textContent = rsiStatus.text;
    document.getElementById(
      "rsiStatus"
    ).className = `text-xs px-2 py-1 rounded-full ${rsiStatus.class}`;

    // MACD
    document.getElementById("macdLine").textContent =
      indicators.macd.line.toFixed(2);
    document.getElementById("macdSignal").textContent =
      indicators.macd.signal.toFixed(2);
    document.getElementById("macdHist").textContent =
      indicators.macd.hist.toFixed(2);

    // Stochastic
    document.getElementById("stochK").textContent =
      indicators.stochastic.k.toFixed(2);
    document.getElementById("stochD").textContent =
      indicators.stochastic.d.toFixed(2);

    // Bollinger Bands
    document.getElementById("bbUpper").textContent = this.formatPrice(
      indicators.bollinger.upper
    );
    document.getElementById("bbLower").textContent = this.formatPrice(
      indicators.bollinger.lower
    );

    // StochRSI
    document.getElementById("stochRsiK").textContent =
      indicators.stochRsi.k.toFixed(2);
    document.getElementById("stochRsiD").textContent =
      indicators.stochRsi.d.toFixed(2);

    // PSAR
    document.getElementById("psarValue").textContent = this.formatPrice(
      indicators.psar
    );
    const psarStatus = this.getPSARStatus();
    document.getElementById("psarStatus").textContent = psarStatus.text;
    document.getElementById(
      "psarStatus"
    ).className = `text-xs px-2 py-1 rounded-full ${psarStatus.class}`;

    // Moving Averages
    document.getElementById("smaValue").textContent = this.formatPrice(
      indicators.sma20
    );
    document.getElementById("emaValue").textContent = this.formatPrice(
      indicators.ema20
    );
  }

  getRSIStatus(rsi) {
    if (rsi > 70) {
      return { text: "Overbought", class: "bg-red-100 text-red-600" };
    } else if (rsi < 30) {
      return { text: "Oversold", class: "bg-green-100 text-green-600" };
    } else {
      return { text: "Neutral", class: "bg-gray-100 text-gray-600" };
    }
  }

  getPSARStatus() {
    return { text: "Active", class: "bg-teal-100 text-teal-600" };
  }

  formatPrice(price) {
    if (price >= 1000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    } else {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    }
  }

  initializeCharts() {
    // Initialize main price chart
    this.initPriceChart();

    // Initialize mini charts for indicators
    this.initRSIChart();
    this.initMACDChart();
    this.initStochasticChart();
    this.initBollingerChart();
    this.initStochRSIChart();
    this.initMovingAverageChart();
  }

  initPriceChart() {
    const options = {
      series: [
        {
          name: "Price",
          data: [],
        },
      ],
      chart: {
        type: "line",
        height: 320,
        toolbar: {
          show: false,
        },
        background: "transparent",
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      colors: ["#3B82F6"],
      grid: {
        show: true,
        borderColor: "#E5E7EB",
        strokeDashArray: 3,
        padding: {
          left: 0,
          right: 0,
        },
      },
      xaxis: {
        type: "datetime",
        labels: {
          style: {
            colors: "#9CA3AF",
            fontSize: "12px",
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: "#9CA3AF",
            fontSize: "12px",
          },
          formatter: (value) => this.formatPrice(value),
        },
      },
      tooltip: {
        theme: "light",
        y: {
          formatter: (value) => this.formatPrice(value),
        },
      },
      legend: {
        show: false,
      },
    };

    this.charts.priceChart = new ApexCharts(
      document.querySelector("#priceChart"),
      options
    );
    this.charts.priceChart.render();
  }

  initRSIChart() {
    const options = {
      series: [
        {
          name: "RSI",
          data: [32.47], // Sample data
        },
      ],
      chart: {
        type: "line",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      colors: ["#3B82F6"],
      tooltip: {
        enabled: false,
      },
    };

    this.charts.rsiChart = new ApexCharts(
      document.querySelector("#rsiChart"),
      options
    );
    this.charts.rsiChart.render();
  }

  initMACDChart() {
    const options = {
      series: [
        {
          name: "MACD",
          data: [-2267.23, -2208.88, -58.34], // Sample data
        },
      ],
      chart: {
        type: "bar",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      colors: ["#10B981"],
      tooltip: {
        enabled: false,
      },
    };

    this.charts.macdChart = new ApexCharts(
      document.querySelector("#macdChart"),
      options
    );
    this.charts.macdChart.render();
  }

  initStochasticChart() {
    const options = {
      series: [
        {
          name: "%K",
          data: [46.3],
        },
        {
          name: "%D",
          data: [40.48],
        },
      ],
      chart: {
        type: "line",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      colors: ["#8B5CF6", "#A78BFA"],
      tooltip: {
        enabled: false,
      },
    };

    this.charts.stochChart = new ApexCharts(
      document.querySelector("#stochChart"),
      options
    );
    this.charts.stochChart.render();
  }

  initBollingerChart() {
    const options = {
      series: [
        {
          name: "Bollinger",
          data: [119926.96, 114000, 108639.34], // Sample data: upper, middle, lower
        },
      ],
      chart: {
        type: "line",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      stroke: {
        curve: "smooth",
        width: 1,
      },
      colors: ["#F59E0B"],
      fill: {
        type: "gradient",
        gradient: {
          shade: "light",
          type: "vertical",
          shadeIntensity: 0.2,
          gradientToColors: ["#FEF3C7"],
          inverseColors: false,
          opacityFrom: 0.3,
          opacityTo: 0.1,
        },
      },
      tooltip: {
        enabled: false,
      },
    };

    this.charts.bollingerChart = new ApexCharts(
      document.querySelector("#bollingerChart"),
      options
    );
    this.charts.bollingerChart.render();
  }

  initStochRSIChart() {
    const options = {
      series: [
        {
          name: "%K",
          data: [86.83],
        },
        {
          name: "%D",
          data: [83.28],
        },
      ],
      chart: {
        type: "line",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      colors: ["#EF4444", "#F87171"],
      tooltip: {
        enabled: false,
      },
    };

    this.charts.stochRsiChart = new ApexCharts(
      document.querySelector("#stochRsiChart"),
      options
    );
    this.charts.stochRsiChart.render();
  }

  initMovingAverageChart() {
    const options = {
      series: [
        {
          name: "SMA20",
          data: [114283.15],
        },
        {
          name: "EMA20",
          data: [114166.21],
        },
      ],
      chart: {
        type: "line",
        height: 80,
        sparkline: {
          enabled: true,
        },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      colors: ["#6366F1", "#8B5CF6"],
      tooltip: {
        enabled: false,
      },
    };

    this.charts.maChart = new ApexCharts(
      document.querySelector("#maChart"),
      options
    );
    this.charts.maChart.render();
  }

  updateCharts(indicators) {
    // For demo purposes, we'll update with sample data
    // In a real implementation, you would fetch historical data for proper charts

    // Update main price chart with sample data
    const now = new Date().getTime();
    const samplePriceData = [];
    for (let i = 29; i >= 0; i--) {
      samplePriceData.push({
        x: now - i * 24 * 60 * 60 * 1000, // Last 30 days
        y: 114000 + (Math.random() - 0.5) * 10000, // Sample price variation
      });
    }

    this.charts.priceChart.updateSeries([
      {
        name: "Price",
        data: samplePriceData,
      },
    ]);

    // Update mini charts with current indicator values
    this.charts.rsiChart.updateSeries([
      {
        name: "RSI",
        data: [indicators.rsi],
      },
    ]);

    this.charts.macdChart.updateSeries([
      {
        name: "MACD",
        data: [
          indicators.macd.line,
          indicators.macd.signal,
          indicators.macd.hist,
        ],
      },
    ]);

    this.charts.stochChart.updateSeries([
      {
        name: "%K",
        data: [indicators.stochastic.k],
      },
      {
        name: "%D",
        data: [indicators.stochastic.d],
      },
    ]);

    this.charts.bollingerChart.updateSeries([
      {
        name: "Bollinger",
        data: [
          indicators.bollinger.upper,
          (indicators.bollinger.upper + indicators.bollinger.lower) / 2,
          indicators.bollinger.lower,
        ],
      },
    ]);

    this.charts.stochRsiChart.updateSeries([
      {
        name: "%K",
        data: [indicators.stochRsi.k],
      },
      {
        name: "%D",
        data: [indicators.stochRsi.d],
      },
    ]);

    this.charts.maChart.updateSeries([
      {
        name: "SMA20",
        data: [indicators.sma20],
      },
      {
        name: "EMA20",
        data: [indicators.ema20],
      },
    ]);
  }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new CryptoAnalysisDashboard();
});
