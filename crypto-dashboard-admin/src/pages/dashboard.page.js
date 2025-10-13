/**
 * Dashboard Page Module
 */
import { ApiService } from "../services/api.service.js";
import { CandlestickChart } from "./chart.manager.js";

export class DashboardPage {
  constructor() {
    this.apiService = new ApiService();
    this.chartManager = null;
    this.dataPoller = null;
    this.currentTimeframe = "1h";
    this.isActive = false;
  }

  async initialize() {
    console.log("🚀 Initializing Dashboard page...");
    this.isActive = true;

    // Initialize chart after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeCandlestickChart();
      this.startDataPolling();
    }, 500);
  }

  destroy() {
    console.log("🧹 Destroying Dashboard page...");
    this.isActive = false;

    if (this.dataPoller) {
      clearInterval(this.dataPoller);
      this.dataPoller = null;
    }

    if (this.chartManager) {
      this.chartManager.destroy();
      this.chartManager = null;
    }
  }

  initializeCandlestickChart() {
    const chartContainer = document.getElementById("candlestick-chart");
    if (!chartContainer) {
      console.error("❌ Chart container not found!");
      return;
    }

    // Destroy previous chart if exists
    if (this.chartManager) {
      this.chartManager.destroy();
    }

    this.chartManager = new CandlestickChart("candlestick-chart");
    const initSuccess = this.chartManager.init();

    if (!initSuccess) {
      console.error("❌ Chart initialization failed");
      return;
    }

    // Setup timeframe buttons
    this.setupTimeframeButtons();

    // Fetch initial data
    setTimeout(() => {
      this.fetchCandleDataAndUpdate();
    }, 500);
  }

  setupTimeframeButtons() {
    const timeframeButtons = document.querySelectorAll("[data-timeframe]");

    timeframeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const newTimeframe = e.target.dataset.timeframe;

        if (newTimeframe !== this.currentTimeframe) {
          this.currentTimeframe = newTimeframe;

          // Update button styles
          timeframeButtons.forEach((btn) => {
            btn.classList.remove("bg-blue-100", "text-blue-600");
            btn.classList.add("bg-gray-100", "text-gray-600");
          });
          e.target.classList.remove("bg-gray-100", "text-gray-600");
          e.target.classList.add("bg-blue-100", "text-blue-600");

          // Fetch new data
          this.fetchCandleDataAndUpdate();
        }
      });
    });
  }

  async fetchCandleDataAndUpdate() {
    try {
      const candleData = await this.apiService.fetchCandles(
        "BTC-USD",
        this.currentTimeframe
      );

      if (candleData?.success && this.chartManager) {
        this.chartManager.updateData(candleData.candles || candleData.data);
      }
    } catch (error) {
      console.error("❌ Error fetching candle data:", error);
    }
  }

  startDataPolling() {
    // Stop existing polling
    if (this.dataPoller) {
      clearInterval(this.dataPoller);
    }

    // Fetch immediately
    this.fetchAllData();

    // Poll every 5 seconds
    this.dataPoller = setInterval(() => {
      if (this.isActive) {
        this.fetchAllData();
      }
    }, 5000);
  }

  async fetchAllData() {
    try {
      const [btcAnalysis, ethAnalysis, candleData] = await Promise.allSettled([
        this.apiService.fetchAnalysis("BTC-USD"),
        this.apiService.fetchAnalysis("ETH-USD"),
        this.apiService.fetchCandles("BTC-USD", this.currentTimeframe),
      ]);

      if (btcAnalysis.status === "fulfilled" && btcAnalysis.value?.success) {
        this.updateDashboardData(btcAnalysis.value);
      }

      if (ethAnalysis.status === "fulfilled" && ethAnalysis.value?.success) {
        this.updateEthereumCard(ethAnalysis.value);
      }

      if (
        candleData.status === "fulfilled" &&
        candleData.value?.success &&
        this.chartManager
      ) {
        this.chartManager.updateData(
          candleData.value.candles || candleData.value.data
        );
      }
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
    }
  }

  updateDashboardData(data) {
    requestAnimationFrame(() => {
      this.updateTradingSignals(data);
      this.updateMarketPerformance(data);
      this.updatePortfolioValue(data);
      this.updateMarketCards(data);
      this.updateTechnicalIndicators(data);
      this.updateLiveAnalysis(data);
    });
  }

  updateTradingSignals(data) {
    const signalElement = document.querySelector("[data-trading-signals]");
    if (!signalElement) return;

    const signal = data.combinedSignal.finalSignal;
    const confidence = (data.combinedSignal.confidence * 100).toFixed(1);

    const signalColor =
      signal === "BUY"
        ? "text-green-600"
        : signal === "SELL"
        ? "text-red-600"
        : "text-yellow-600";

    signalElement.innerHTML = `
      <h4 class="text-gray-500 text-lg font-semibold mb-4">🎯 Trading Signals</h4>
      <div class="flex flex-col gap-3">
        <div>
          <h3 class="text-xl font-semibold ${signalColor} mb-2">${signal}</h3>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs text-gray-400">Confidence: ${confidence}%</span>
          </div>
        </div>
      </div>
    `;
  }

  updateMarketPerformance(data) {
    const elements = {
      "[data-sma20]": data.indicators.sma20?.toFixed(0),
      "[data-ema20]": data.indicators.ema20?.toFixed(0),
      "[data-rsi]": data.indicators.rsi?.toFixed(1),
      "[data-psar]": data.indicators.psar?.toFixed(0),
    };

    Object.entries(elements).forEach(([selector, value]) => {
      const el = document.querySelector(selector);
      if (el && value !== undefined) {
        el.textContent = value;
      }
    });
  }

  updatePortfolioValue(data) {
    const portfolioElement = document.querySelector("[data-portfolio-value]");
    if (!portfolioElement) return;

    const btcPrice = data.indicators.sma20;
    const portfolioValue = (btcPrice * 0.75).toFixed(0);
    const changeColor =
      data.combinedSignal.combinedScore > 0 ? "text-green-500" : "text-red-500";

    portfolioElement.innerHTML = `
      <h4 class="text-gray-500 text-lg font-semibold mb-4">💰 Portfolio Value</h4>
      <div class="flex flex-col gap-3">
        <h3 class="text-xl font-semibold text-gray-500">$${portfolioValue}</h3>
      </div>
    `;
  }

  updateMarketCards(btcData) {
    // Update BTC card
    const btcPriceEl = document.querySelector("[data-btc-price]");
    const btcChangeEl = document.querySelector("[data-btc-change]");
    if (btcPriceEl && btcChangeEl) {
      const price = btcData.indicators.sma20;
      const changePercent = (
        btcData.combinedSignal.combinedScore * 100
      ).toFixed(2);

      btcPriceEl.textContent = `$${price.toFixed(0)}`;
      btcChangeEl.textContent = `${
        btcData.combinedSignal.combinedScore >= 0 ? "+" : ""
      }${changePercent}%`;
      btcChangeEl.className = `text-xs truncate ${
        btcData.combinedSignal.combinedScore >= 0
          ? "text-green-500"
          : "text-red-500"
      }`;
    }

    // Update other market cards
    const rsiValueEl = document.querySelector("[data-rsi-value]");
    if (rsiValueEl) {
      rsiValueEl.textContent = btcData.indicators.rsi.toFixed(1);
    }
  }

  updateEthereumCard(ethData) {
    const ethPriceEl = document.querySelector("[data-eth-price]");
    const ethChangeEl = document.querySelector("[data-eth-change]");

    if (ethPriceEl && ethChangeEl && ethData.success) {
      const price = ethData.indicators.sma20;
      const changePercent = (
        ethData.combinedSignal.combinedScore * 100
      ).toFixed(2);

      ethPriceEl.textContent = `$${price.toFixed(0)}`;
      ethChangeEl.textContent = `${
        ethData.combinedSignal.combinedScore >= 0 ? "+" : ""
      }${changePercent}%`;
      ethChangeEl.className = `text-xs truncate ${
        ethData.combinedSignal.combinedScore >= 0
          ? "text-green-500"
          : "text-red-500"
      }`;
    }
  }

  updateTechnicalIndicators(data) {
    const indicatorsEl = document.querySelector("[data-technical-indicators]");
    if (!indicatorsEl) return;

    const indicators = data.indicators;

    indicatorsEl.innerHTML = `
      <div class="space-y-3">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
          <h5 class="font-semibold text-gray-700 mb-2 text-sm">Moving Averages</h5>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div><span class="text-gray-500">SMA20:</span> <span class="font-semibold ml-1">${indicators.sma20.toFixed(
              0
            )}</span></div>
            <div><span class="text-gray-500">EMA20:</span> <span class="font-semibold ml-1">${indicators.ema20.toFixed(
              0
            )}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  updateLiveAnalysis(data) {
    const analysisEl = document.querySelector("[data-live-analysis]");
    if (!analysisEl) return;

    const signal = data.combinedSignal;
    const signalColor =
      signal.finalSignal === "BUY"
        ? "text-green-600"
        : signal.finalSignal === "SELL"
        ? "text-red-600"
        : "text-yellow-600";

    analysisEl.innerHTML = `
      <div class="space-y-3">
        <div class="bg-gradient-to-r from-gray-50 to-slate-50 p-3 rounded-lg">
          <h5 class="font-semibold text-gray-700 text-sm mb-2">Current Signal</h5>
          <span class="text-lg font-bold ${signalColor}">${
      signal.finalSignal
    }</span>
          <div class="text-xs text-gray-600 mt-1">
            Confidence: ${(signal.confidence * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    `;
  }
}
