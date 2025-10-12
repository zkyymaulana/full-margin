import "./index.css";
import { createChart, ColorType } from "lightweight-charts";

console.log("✅ Vite + Tailwind setup works!");

// API Configuration
const API_BASE_URL = "http://localhost:8000/api";

// Chart instance dan state management
let chartInstance = null;
let candleSeries = null;
let currentTimeframe = "1h";
let lastUpdateTime = null;
let isPolling = false;

// Cache untuk menghindari request berlebihan
const cache = new Map();
const CACHE_DURATION = 4000; // 4 detik cache

/**
 * Dynamic HTML Loader untuk Vite
 * Memuat file HTML eksternal dan menyuntikkannya ke halaman utama.
 */
async function loadComponent(targetId, filePath) {
  const el = document.getElementById(targetId);
  if (!el) {
    console.error(`Element dengan ID '${targetId}' tidak ditemukan`);
    return;
  }

  try {
    const response = await fetch(filePath);
    if (!response.ok)
      throw new Error(`Gagal memuat ${filePath} - Status: ${response.status}`);
    const html = await response.text();
    el.innerHTML = html;
    console.log(`✅ Berhasil memuat komponen: ${filePath}`);
  } catch (err) {
    const errorMsg = `❌ Error loading ${filePath}: ${err.message}`;
    el.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">${errorMsg}</div>`;
    console.error(errorMsg);
  }
}

/**
 * Optimized API Service dengan caching dan error handling
 */
class ApiService {
  static async fetchWithCache(url, cacheKey) {
    const now = Date.now();
    const cached = cache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Using cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`🌐 Fetching fresh data from ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10 detik timeout
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      console.log(`✅ Data fetched successfully for ${cacheKey}:`, data);
      cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`❌ Error fetching ${cacheKey}:`, error);
      return cached ? cached.data : null; // Return cached data jika ada error
    }
  }

  static async fetchAnalysis(symbol = "BTC-USD") {
    return this.fetchWithCache(
      `${API_BASE_URL}/analysis/${symbol}`,
      `analysis_${symbol}`
    );
  }

  static async fetchCandles(symbol = "BTC-USD", timeframe = "1h") {
    return this.fetchWithCache(
      `${API_BASE_URL}/chart/${symbol}`,
      `candles_${symbol}_${timeframe}`
    );
  }

  static async fetchMarketCap() {
    return this.fetchWithCache(`${API_BASE_URL}/marketcap`, "marketcap");
  }
}

/**
 * Fixed Lightweight Chart Implementation - Vanilla JS
 */
class CandlestickChart {
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
      console.error(
        `❌ Container dengan ID '${this.containerId}' tidak ditemukan!`
      );
      return false;
    }

    // 🔥 CRITICAL: Cek apakah sudah diinisialisasi
    if (this.isInitialized && this.chart) {
      console.log(`⚠️ Chart sudah diinisialisasi, skip duplicate init`);
      return true;
    }

    console.log(`🚀 Initializing chart in container:`, container);

    // 🔧 PASTIKAN CONTAINER SIAP
    container.style.width = "100%";
    container.style.height = "400px";
    container.style.position = "relative";
    container.style.display = "block";
    container.style.background = "#ffffff";

    // 🧹 HAPUS LOADING OVERLAY
    const loadingOverlay = container.querySelector(".chart-loading");
    if (loadingOverlay) {
      console.log(`🧹 Removing loading overlay`);
      loadingOverlay.remove();
    }

    // 🧹 CLEAR CONTAINER CONTENT (JANGAN HAPUS CONTAINER)
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    try {
      const width = container.clientWidth || 800;
      const height = 400;

      console.log(`📊 Creating chart with dimensions: ${width}x${height}`);

      // 🎯 CREATE CHART
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
          fixLeftEdge: false,
          lockVisibleTimeRangeOnResize: true,
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

      console.log(`✅ Chart created successfully`);

      // 🕯️ ADD CANDLESTICK SERIES
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

      console.log(`✅ Candlestick series added`);

      // 📏 RESIZE OBSERVER
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

    console.log(`📊 Updating chart with ${candleData.length} candles`);

    try {
      const formattedData = this.processBackendData({
        success: true,
        candles: candleData,
      });

      console.log(`🔄 Formatted ${formattedData.length} candles`);

      if (formattedData.length === 0) {
        console.error(`❌ No valid data after formatting`);
        return;
      }

      // 🔄 SET DATA
      this.candleSeries.setData(formattedData);

      // 🎯 FIT CONTENT AFTER A SHORT DELAY
      setTimeout(() => {
        try {
          if (this.chart && this.chart.timeScale) {
            this.chart.timeScale().fitContent();
            console.log(`✅ Chart updated and fitted successfully!`);
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
      console.log(`✅ Chart destroyed successfully`);
    }
  }
}

// Global chart instance
let chartManager = null;

/**
 * Initialize Sidebar Toggle Functionality
 */
function initSidebarToggle() {
  const sidebarToggle = document.getElementById("headerCollapse");
  const sidebar = document.getElementById("application-sidebar-brand");
  const overlay = document.getElementById("sidebar-overlay");

  function toggleSidebar() {
    if (!sidebar) return;
    const isOpen = !sidebar.classList.contains("-translate-x-full");

    if (isOpen) {
      sidebar.classList.add("-translate-x-full");
      if (overlay) overlay.classList.add("hidden");
    } else {
      sidebar.classList.remove("-translate-x-full");
      if (overlay) overlay.classList.remove("hidden");
    }
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.add("-translate-x-full");
    if (overlay) overlay.classList.add("hidden");
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });
}

/**
 * Optimized polling dengan backoff strategy
 */
class DataPoller {
  constructor() {
    this.intervalId = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.baseInterval = 5000;
    this.isActive = false;
  }

  start() {
    if (this.isActive) {
      console.log("⚠️ Polling already active, skipping start");
      return;
    }

    this.isActive = true;
    this.retryCount = 0;

    console.log("🔄 Starting data polling (5 second interval)");

    // Fetch immediately
    this.fetchData();

    // Then poll every 5 seconds
    this.intervalId = setInterval(() => {
      this.fetchData();
    }, this.baseInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    console.log("⏸️ Data polling stopped");
  }

  async fetchData() {
    try {
      console.log("🔄 Fetching data from APIs...");

      const [btcAnalysis, ethAnalysis, candleData] = await Promise.allSettled([
        ApiService.fetchAnalysis("BTC-USD"),
        ApiService.fetchAnalysis("ETH-USD"),
        ApiService.fetchCandles("BTC-USD", currentTimeframe),
      ]);

      if (btcAnalysis.status === "fulfilled" && btcAnalysis.value?.success) {
        console.log("📊 Updating dashboard with BTC analysis");
        updateDashboardData(btcAnalysis.value);
      }

      if (ethAnalysis.status === "fulfilled" && ethAnalysis.value?.success) {
        console.log("📊 Updating ETH data");
        updateEthereumCard(ethAnalysis.value);
      }

      if (candleData.status === "fulfilled" && candleData.value?.success) {
        console.log("🕯️ Updating candlestick chart");
        updateCandlestickChart(
          candleData.value.candles || candleData.value.data
        );
      }

      this.retryCount = 0;
    } catch (error) {
      console.error("❌ Polling error:", error);
      this.retryCount++;

      if (this.retryCount >= this.maxRetries) {
        console.warn("⚠️ Max retries reached, stopping polling");
        this.stop();
      }
    }
  }
}

const dataPoller = new DataPoller();

/**
 * Update candlestick chart
 */
function updateCandlestickChart(candleData) {
  if (!chartManager) {
    console.error("❌ Chart manager not initialized");
    return;
  }

  if (!candleData || !Array.isArray(candleData)) {
    console.error("❌ Invalid candle data:", candleData);
    return;
  }

  chartManager.updateData(candleData);
}

/**
 * 🔥 FIXED: Chart initialization - Prevent duplicate initialization
 */
function initializeCandlestickChart() {
  console.log("🚀 initializeCandlestickChart called");

  // 🔥 CRITICAL: Cek apakah chart sudah ada
  if (chartManager && chartManager.isInitialized) {
    console.log("✅ Chart already initialized, skipping...");
    return;
  }

  const chartContainer = document.getElementById("candlestick-chart");
  if (!chartContainer) {
    console.error("❌ Chart container not found!");
    return;
  }

  console.log("✅ Chart container found:", chartContainer);

  try {
    // 🔥 DESTROY PREVIOUS CHART IF EXISTS
    if (chartManager) {
      console.log("🧹 Destroying previous chart instance");
      chartManager.destroy();
    }

    chartManager = new CandlestickChart("candlestick-chart");
    const initSuccess = chartManager.init();

    if (!initSuccess) {
      console.error("❌ Chart initialization failed");
      return;
    }

    // Setup timeframe buttons
    const timeframeButtons = document.querySelectorAll("[data-timeframe]");
    console.log(`🔘 Found ${timeframeButtons.length} timeframe buttons`);

    timeframeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const newTimeframe = e.target.dataset.timeframe;
        console.log(`🔘 Timeframe changed to: ${newTimeframe}`);

        if (newTimeframe !== currentTimeframe) {
          currentTimeframe = newTimeframe;

          // Update button styles
          timeframeButtons.forEach((btn) => {
            btn.classList.remove("bg-blue-100", "text-blue-600");
            btn.classList.add("bg-gray-100", "text-gray-600");
          });
          e.target.classList.remove("bg-gray-100", "text-gray-600");
          e.target.classList.add("bg-blue-100", "text-blue-600");

          // Fetch new data
          fetchCandleDataAndUpdate();
        }
      });
    });

    console.log("✅ Candlestick chart initialized successfully");

    // Fetch initial data
    setTimeout(() => {
      console.log("🚀 Fetching initial chart data...");
      fetchCandleDataAndUpdate();
    }, 500);
  } catch (error) {
    console.error("❌ Error initializing chart:", error);
  }
}

/**
 * Fetch candle data dan update chart
 */
async function fetchCandleDataAndUpdate() {
  try {
    console.log(`🔄 Fetching candle data for ${currentTimeframe}...`);
    const candleData = await ApiService.fetchCandles(
      "BTC-USD",
      currentTimeframe
    );

    if (candleData?.success) {
      console.log("✅ Candle data received:", candleData);
      updateCandlestickChart(candleData.candles || candleData.data);
    } else {
      console.error("❌ Failed to fetch candle data:", candleData);
    }
  } catch (error) {
    console.error("❌ Error fetching candle data:", error);
  }
}

/**
 * Update dashboard dengan data optimized
 */
function updateDashboardData(data) {
  requestAnimationFrame(() => {
    updateTradingSignals(data);
    updateMarketPerformance(data);
    updatePortfolioValue(data);
    updateMarketCards(data);
    updateTechnicalIndicators(data);
    updateLiveAnalysis(data);
  });
}

/**
 * Update Trading Signals Section
 */
function updateTradingSignals(data) {
  const signalElement = document.querySelector("[data-trading-signals]");
  if (!signalElement) return;

  const signal = data.combinedSignal.finalSignal;
  const confidence = (data.combinedSignal.confidence * 100).toFixed(1);
  const score = data.combinedSignal.combinedScore.toFixed(4);

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
          <span class="flex items-center justify-center w-4 h-4 rounded-full ${
            signal === "BUY"
              ? "bg-green-400"
              : signal === "SELL"
              ? "bg-red-400"
              : "bg-yellow-400"
          }">
            <svg class="w-2 h-2 ${
              signal === "BUY"
                ? "text-green-600"
                : signal === "SELL"
                ? "text-red-600"
                : "text-yellow-600"
            }" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
            </svg>
          </span>
          <p class="text-gray-500 text-sm font-normal">${confidence}%</p>
        </div>
        <div class="text-xs text-gray-400">
          <div>RSI: ${data.indicators.rsi.toFixed(2)}</div>
          <div>Score: ${score}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update Market Performance Section
 */
function updateMarketPerformance(data) {
  const smaEl = document.querySelector("[data-sma20]");
  const emaEl = document.querySelector("[data-ema20]");
  const rsiEl = document.querySelector("[data-rsi]");
  const psarEl = document.querySelector("[data-psar]");

  if (smaEl) smaEl.textContent = data.indicators.sma20.toFixed(0);
  if (emaEl) emaEl.textContent = data.indicators.ema20.toFixed(0);
  if (rsiEl) rsiEl.textContent = data.indicators.rsi.toFixed(1);
  if (psarEl) psarEl.textContent = data.indicators.psar.toFixed(0);
}

/**
 * Update Portfolio Value
 */
function updatePortfolioValue(data) {
  const portfolioElement = document.querySelector("[data-portfolio-value]");
  if (!portfolioElement) return;

  const btcPrice = data.indicators.sma20;
  const portfolioValue = (btcPrice * 0.75).toFixed(0);
  const monthlyChange =
    data.combinedSignal.combinedScore > 0 ? "+12.5%" : "-5.2%";
  const changeColor =
    data.combinedSignal.combinedScore > 0 ? "text-green-500" : "text-red-500";

  portfolioElement.innerHTML = `
    <h4 class="text-gray-500 text-lg font-semibold mb-4">💰 Portfolio Value</h4>
    <div class="flex flex-col gap-3">
      <h3 class="text-xl font-semibold text-gray-500">$${portfolioValue}</h3>
      <div class="flex items-center gap-2">
        <span class="flex items-center justify-center w-4 h-4 rounded-full ${
          data.combinedSignal.combinedScore > 0 ? "bg-green-400" : "bg-red-400"
        }">
          <svg class="w-2 h-2 ${
            data.combinedSignal.combinedScore > 0
              ? "text-green-600"
              : "text-red-600"
          }" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
          </svg>
        </span>
        <p class="${changeColor} text-sm font-normal">${monthlyChange}</p>
      </div>
    </div>
  `;
}

/**
 * Update Market Cards with Real Data
 */
function updateMarketCards(btcData) {
  const btcPriceEl = document.querySelector("[data-btc-price]");
  const btcChangeEl = document.querySelector("[data-btc-change]");
  if (btcPriceEl && btcChangeEl) {
    const price = btcData.indicators.sma20;
    const change = btcData.combinedSignal.combinedScore;
    const changePercent = (change * 100).toFixed(2);

    btcPriceEl.textContent = `$${price.toFixed(0)}`;
    btcChangeEl.textContent = `${change >= 0 ? "+" : ""}${changePercent}%`;
    btcChangeEl.className = `text-xs truncate ${
      change >= 0 ? "text-green-500" : "text-red-500"
    }`;
  }

  const rsiValueEl = document.querySelector("[data-rsi-value]");
  const rsiStatusEl = document.querySelector("[data-rsi-status]");
  if (rsiValueEl && rsiStatusEl) {
    const rsi = btcData.indicators.rsi;
    rsiValueEl.textContent = rsi.toFixed(1);

    let status = "Neutral";
    let statusColor = "text-gray-500";
    if (rsi > 70) {
      status = "Overbought";
      statusColor = "text-red-500";
    } else if (rsi < 30) {
      status = "Oversold";
      statusColor = "text-green-500";
    }

    rsiStatusEl.textContent = status;
    rsiStatusEl.className = `text-xs truncate ${statusColor}`;
  }

  const confidenceEl = document.querySelector("[data-confidence-value]");
  const signalTypeEl = document.querySelector("[data-signal-type]");
  if (confidenceEl && signalTypeEl) {
    const confidence = (btcData.combinedSignal.confidence * 100).toFixed(1);
    const signal = btcData.combinedSignal.finalSignal;

    confidenceEl.textContent = `${confidence}%`;
    signalTypeEl.textContent = signal;

    const signalColor =
      signal === "BUY"
        ? "text-green-500"
        : signal === "SELL"
        ? "text-red-500"
        : "text-yellow-500";
    signalTypeEl.className = `text-xs truncate ${signalColor}`;
  }
}

/**
 * Update Ethereum Card
 */
function updateEthereumCard(ethData) {
  const ethPriceEl = document.querySelector("[data-eth-price]");
  const ethChangeEl = document.querySelector("[data-eth-change]");

  if (ethPriceEl && ethChangeEl && ethData.success) {
    const price = ethData.indicators.sma20;
    const change = ethData.combinedSignal.combinedScore;
    const changePercent = (change * 100).toFixed(2);

    ethPriceEl.textContent = `$${price.toFixed(0)}`;
    ethChangeEl.textContent = `${change >= 0 ? "+" : ""}${changePercent}%`;
    ethChangeEl.className = `text-xs truncate ${
      change >= 0 ? "text-green-500" : "text-red-500"
    }`;
  }
}

/**
 * Update Technical Indicators Section
 */
function updateTechnicalIndicators(data) {
  const indicatorsEl = document.querySelector("[data-technical-indicators]");
  if (!indicatorsEl) return;

  const indicators = data.indicators;

  indicatorsEl.innerHTML = `
    <div class="space-y-3">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
        <h5 class="font-semibold text-gray-700 mb-2 text-sm">Moving Averages</h5>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-gray-500">SMA20:</span>
            <span class="font-semibold ml-1">${indicators.sma20.toFixed(
              0
            )}</span>
          </div>
          <div>
            <span class="text-gray-500">EMA20:</span>
            <span class="font-semibold ml-1">${indicators.ema20.toFixed(
              0
            )}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
        <h5 class="font-semibold text-gray-700 mb-2 text-sm">Oscillators</h5>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-500">RSI:</span>
            <span class="font-semibold ${
              indicators.rsi > 70
                ? "text-red-600"
                : indicators.rsi < 30
                ? "text-green-600"
                : "text-yellow-600"
            }">${indicators.rsi.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Stoch %K:</span>
            <span class="font-semibold">${indicators.stochastic.k.toFixed(
              1
            )}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-gradient-to-r from-green-50 to-teal-50 p-3 rounded-lg">
        <h5 class="font-semibold text-gray-700 mb-2 text-sm">MACD</h5>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-500">Line:</span>
            <span class="font-semibold">${indicators.macd.line.toFixed(
              1
            )}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Hist:</span>
            <span class="font-semibold ${
              indicators.macd.hist >= 0 ? "text-green-600" : "text-red-600"
            }">${indicators.macd.hist.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update Live Analysis Results
 */
function updateLiveAnalysis(data) {
  const analysisEl = document.querySelector("[data-live-analysis]");
  if (!analysisEl) return;

  const signal = data.combinedSignal;

  analysisEl.innerHTML = `
    <div class="space-y-3">
      <!-- Current Signal -->
      <div class="bg-gradient-to-r from-gray-50 to-slate-50 p-3 rounded-lg border-l-4 ${
        signal.finalSignal === "BUY"
          ? "border-green-500"
          : signal.finalSignal === "SELL"
          ? "border-red-500"
          : "border-yellow-500"
      }">
        <div class="flex items-center justify-between mb-2">
          <h5 class="font-semibold text-gray-700 text-sm">Current Signal</h5>
          <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold ${
            signal.finalSignal === "BUY"
              ? "text-green-600"
              : signal.finalSignal === "SELL"
              ? "text-red-600"
              : "text-yellow-600"
          }">${signal.finalSignal}</span>
          <div class="text-xs text-gray-600">
            <div>Confidence: ${(signal.confidence * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
      
      <!-- Bollinger Bands -->
      <div class="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 rounded-lg">
        <h5 class="font-semibold text-gray-700 mb-2 text-sm">Bollinger Bands</h5>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-500">Upper:</span>
            <span class="font-semibold">${data.indicators.bollinger.upper.toFixed(
              0
            )}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Lower:</span>
            <span class="font-semibold">${data.indicators.bollinger.lower.toFixed(
              0
            )}</span>
          </div>
        </div>
      </div>
      
      <!-- Analysis Summary -->
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 p-3 rounded-lg">
        <h5 class="font-semibold text-gray-700 mb-2 text-sm">Summary</h5>
        <div class="text-xs text-gray-600 space-y-1">
          <div>Symbol: <span class="font-semibold">${data.symbol}</span></div>
          <div>Candles: <span class="font-semibold">${
            data.candleCount
          }</span></div>
          <div>PSAR: <span class="font-semibold">${data.indicators.psar.toFixed(
            0
          )}</span></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Page visibility API untuk pause/resume polling
 */
function setupVisibilityHandling() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      dataPoller.stop();
    } else {
      dataPoller.start();
    }
  });
}

/**
 * Cleanup function
 */
function cleanup() {
  dataPoller.stop();
  if (chartManager) {
    chartManager.destroy();
  }
  cache.clear();
}

// Setup cleanup saat page unload
window.addEventListener("beforeunload", cleanup);

/**
 * 🔥 FIXED: Main initialization function - Prevent duplicate calls
 */
const initApp = async () => {
  console.log("🚀 Loading Spike template components...");

  await loadComponent("topstrip", "/src/components/topstrip.html");
  await loadComponent("sidebar", "/src/components/sidebar.html");
  await loadComponent("header", "/src/components/header.html");
  await loadComponent("content", "/src/pages/dashboard.html");
  await loadComponent("footer", "/src/components/footer.html");

  console.log("⏳ Waiting for DOM to be fully rendered...");

  let retryCount = 0;
  const maxRetries = 10;

  const initializeWhenReady = () => {
    const chartContainer = document.getElementById("candlestick-chart");

    if (chartContainer && chartContainer.offsetParent !== null) {
      console.log("✅ DOM ready, initializing components...");

      initSidebarToggle();
      initializeCandlestickChart();
      setupVisibilityHandling();

      setTimeout(() => {
        dataPoller.start();
        console.log("✅ Dashboard fully initialized with 5-second polling");
      }, 1000);
    } else if (retryCount < maxRetries) {
      retryCount++;
      console.log(
        `⏳ Chart container not ready yet, retry ${retryCount}/${maxRetries}...`
      );
      setTimeout(initializeWhenReady, 200);
    } else {
      console.error("❌ Chart container never became available");
    }
  };

  setTimeout(initializeWhenReady, 100);
};

// 🔥 CRITICAL FIX: Run initialization only ONCE
if (document.readyState === "loading") {
  // DOM still loading, wait for DOMContentLoaded
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  // DOM already loaded, run immediately
  initApp();
}
