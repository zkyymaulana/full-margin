/**
 * Dashboard Page Module - Clean Chart-Focused Implementation
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

    // Ensure DOM is ready before initialization
    this.domReady =
      document.readyState === "complete" ||
      document.readyState === "interactive";
    if (!this.domReady) {
      window.addEventListener("DOMContentLoaded", () => {
        this.domReady = true;
      });
    }
  }

  async initialize() {
    console.log("🚀 Initializing Dashboard page...");
    this.isActive = true;

    // Wait for DOM to be ready
    if (!this.domReady) {
      window.addEventListener("DOMContentLoaded", () => {
        this.initialize();
      });
      return;
    }

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

    // Setup UI components
    this.setupTimeframeButtons();
    this.createIndicatorToggleUI();
    this.createIndicatorValuesDisplay();

    // ✅ Load preferences and activate some default indicators
    this.loadIndicatorPreferences();

    // ✅ If no saved preferences, activate some default indicators
    const hasActiveIndicators =
      document.querySelector(".ind-btn.active") !== null;
    if (!hasActiveIndicators) {
      this.activateDefaultIndicators();
    }

    // Fetch initial data
    setTimeout(() => {
      this.fetchCandleDataAndUpdate();
    }, 500);
  }

  // ✅ New method to activate default indicators on first load
  activateDefaultIndicators() {
    console.log("🎯 Activating default indicators...");

    // Activate RSI, SMA, and PSAR by default
    const defaultIndicators = ["rsi", "sma", "psar"];

    defaultIndicators.forEach((indicatorType) => {
      const button = document.querySelector(`[data-ind="${indicatorType}"]`);
      if (button) {
        this.toggleIndicatorButton(button, true);

        if (this.chartManager) {
          setTimeout(() => {
            this.chartManager.toggleIndicator(indicatorType);
          }, 100);
        }
      }
    });

    // Update card visibility and show container
    setTimeout(() => {
      this.updateIndicatorCardVisibility();
      const valuesContainer = document.querySelector(
        "[data-indicator-values-container]"
      );
      if (valuesContainer) {
        valuesContainer.style.display = "block";
        valuesContainer.style.opacity = "1";
      }
      this.saveIndicatorPreferences();
    }, 200);
  }

  // ✅ Enhanced indicator toggle UI with better responsiveness
  createIndicatorToggleUI() {
    const chartCard = document
      .querySelector("#candlestick-chart")
      .closest(".card");
    if (!chartCard) return;

    const chartDiv = chartCard.querySelector("#candlestick-chart");
    if (!chartDiv) return;

    const indicatorToggleContainer = document.createElement("div");
    indicatorToggleContainer.className =
      "mt-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-200 shadow-sm";
    indicatorToggleContainer.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h5 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>📊</span> Technical Indicators
        </h5>
        <button 
          class="text-xs text-blue-600 hover:text-blue-800 transition-colors px-3 py-1 rounded-md hover:bg-blue-50 border border-blue-200" 
          onclick="this.closest('.mt-4').querySelector('.indicator-buttons').classList.toggle('hidden')"
        >
          Toggle Panel
        </button>
      </div>
      <div class="indicator-buttons grid grid-cols-2 md:grid-cols-4 gap-3">
        ${this.createIndicatorButtons()}
      </div>
    `;

    chartDiv.parentNode.insertBefore(
      indicatorToggleContainer,
      chartDiv.nextSibling
    );
    this.setupIndicatorButtonHandlers();
    this.loadIndicatorPreferences();
  }

  createIndicatorButtons() {
    const indicators = [
      { id: "sma", icon: "📈", name: "SMA", params: "(20, 50)", color: "blue" },
      {
        id: "ema",
        icon: "📉",
        name: "EMA",
        params: "(20, 50)",
        color: "purple",
      },
      { id: "rsi", icon: "⚡", name: "RSI", params: "(14)", color: "yellow" },
      {
        id: "macd",
        icon: "🎯",
        name: "MACD",
        params: "(12, 26, 9)",
        color: "green",
      },
      { id: "bb", icon: "🔵", name: "BB", params: "(20, 2)", color: "cyan" },
      {
        id: "stoch",
        icon: "🟠",
        name: "Stoch",
        params: "(14, 3)",
        color: "orange",
      },
      {
        id: "stochrsi",
        icon: "🔴",
        name: "Stoch RSI",
        params: "(14, 14, 3, 3)",
        color: "pink",
      },
      {
        id: "psar",
        icon: "💠",
        name: "PSAR",
        params: "(0.02 / 0.2)",
        color: "indigo",
      },
    ];

    return indicators
      .map(
        (ind) => `
      <button 
        class="ind-btn px-3 py-3 text-xs rounded-lg border bg-white text-gray-600 border-gray-200 transition-all duration-200 hover:shadow-md hover:scale-105 flex items-center gap-2" 
        data-ind="${ind.id}"
        data-color="${ind.color}"
      >
        <span class="text-base">${ind.icon}</span> 
        <div class="text-left">
          <div class="font-medium">${ind.name}</div>
          <div class="text-xs opacity-75">${ind.params}</div>
        </div>
      </button>
    `
      )
      .join("");
  }

  // ✅ Enhanced indicator values display with Spike TailwindCSS design
  createIndicatorValuesDisplay() {
    const chartCard = document
      .querySelector("#candlestick-chart")
      .closest(".card");
    if (!chartCard) return;

    const toggleContainer = chartCard
      .querySelector(".indicator-buttons")
      .closest(".mt-4");
    if (!toggleContainer) return;

    const valuesContainer = document.createElement("div");
    valuesContainer.className = "mt-4";
    valuesContainer.style.display = "none"; // Hidden by default
    valuesContainer.setAttribute("data-indicator-values-container", "");

    valuesContainer.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <span class="text-lg">📊</span>
              </div>
              <div>
                <h6 class="text-lg font-semibold text-gray-800">Technical Indicators</h6>
                <p class="text-sm text-gray-500">Real-time values and parameters</p>
              </div>
            </div>
            <div class="text-sm text-gray-400 font-mono" data-last-update>
              Loading...
            </div>
          </div>
        </div>
        
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-indicator-values>
            
            <!-- SMA Card - Spike Design -->
            <div class="group bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-xl border border-blue-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="sma" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-sm font-bold">SMA</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Simple MA</h3>
                    <p class="text-xs text-gray-500">Trend Analysis</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                  <span class="text-xs font-medium text-gray-600">SMA 20:</span>
                  <span class="font-mono font-bold text-blue-700 text-sm" data-sma20>–</span>
                </div>
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                  <span class="text-xs font-medium text-gray-600">SMA 50:</span>
                  <span class="font-mono font-bold text-blue-700 text-sm" data-sma50>–</span>
                </div>
              </div>
            </div>

            <!-- EMA Card - Spike Design -->
            <div class="group bg-gradient-to-br from-purple-50 via-white to-purple-50 rounded-xl border border-purple-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="ema" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-sm font-bold">EMA</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Exponential MA</h3>
                    <p class="text-xs text-gray-500">Responsive Trend</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                  <span class="text-xs font-medium text-gray-600">EMA 20:</span>
                  <span class="font-mono font-bold text-purple-700 text-sm" data-ema20>–</span>
                </div>
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                  <span class="text-xs font-medium text-gray-600">EMA 50:</span>
                  <span class="font-mono font-bold text-purple-700 text-sm" data-ema50>–</span>
                </div>
              </div>
            </div>

            <!-- RSI Card - Spike Design -->
            <div class="group bg-gradient-to-br from-indigo-50 via-white to-indigo-50 rounded-xl border border-indigo-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="rsi" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-sm font-bold">RSI</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">RSI (14)</h3>
                    <p class="text-xs text-gray-500">Momentum</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-black text-indigo-700 mb-2" data-rsi>–</div>
                <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" data-rsi-status>
                  <div class="w-2 h-2 rounded-full mr-2"></div>
                  Neutral
                </div>
              </div>
            </div>

            <!-- MACD Card - Spike Design -->
            <div class="group bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-xl border border-emerald-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="macd" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">MACD</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">MACD</h3>
                    <p class="text-xs text-gray-500">Convergence</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-3 gap-1 text-xs mb-2">
                  <div class="text-center">
                    <div class="text-gray-500">Fast</div>
                    <div class="font-mono font-semibold text-emerald-700" data-macd-fast>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500">Slow</div>
                    <div class="font-mono font-semibold text-emerald-700" data-macd-slow>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500">Signal</div>
                    <div class="font-mono font-semibold text-emerald-700" data-macd-signal-period>–</div>
                  </div>
                </div>
                <div class="border-t border-emerald-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">MACD:</span>
                    <span class="font-mono font-bold text-emerald-700 text-sm" data-macd>–</span>
                  </div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">Signal:</span>
                    <span class="font-mono font-bold text-emerald-700 text-sm" data-macd-signal>–</span>
                  </div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">Histogram:</span>
                    <span class="font-mono font-bold text-emerald-700 text-sm" data-macd-hist>–</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bollinger Bands Card - Spike Design -->
            <div class="group bg-gradient-to-br from-cyan-50 via-white to-cyan-50 rounded-xl border border-cyan-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="bb" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">BB</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Bollinger B.</h3>
                    <p class="text-xs text-gray-500">Volatility</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center">
                    <div class="text-gray-500">Period</div>
                    <div class="font-mono font-semibold text-cyan-700" data-bb-period>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500">Multiplier</div>
                    <div class="font-mono font-semibold text-cyan-700" data-bb-multiplier>–</div>
                  </div>
                </div>
                <div class="border-t border-cyan-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">Upper:</span>
                    <span class="font-mono font-bold text-cyan-700 text-sm" data-bb-upper>–</span>
                  </div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">Lower:</span>
                    <span class="font-mono font-bold text-cyan-700 text-sm" data-bb-lower>–</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stochastic Card - Spike Design -->
            <div class="group bg-gradient-to-br from-violet-50 via-white to-violet-50 rounded-xl border border-violet-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="stoch" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">STOCH</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Stochastic</h3>
                    <p class="text-xs text-gray-500">Oscillator</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center">
                    <div class="text-gray-500">K Period</div>
                    <div class="font-mono font-semibold text-violet-700" data-stoch-k-period>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500">D Period</div>
                    <div class="font-mono font-semibold text-violet-700" data-stoch-d-period>–</div>
                  </div>
                </div>
                <div class="border-t border-violet-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">%K:</span>
                    <span class="font-mono font-bold text-violet-700 text-sm" data-stoch-k>–</span>
                  </div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">%D:</span>
                    <span class="font-mono font-bold text-violet-700 text-sm" data-stoch-d>–</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stochastic RSI Card - Spike Design -->
            <div class="group bg-gradient-to-br from-pink-50 via-white to-pink-50 rounded-xl border border-pink-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="stochrsi" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">StRSI</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Stoch RSI</h3>
                    <p class="text-xs text-gray-500">Advanced</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-4 gap-1 text-xs mb-2">
                  <div class="text-center">
                    <div class="text-gray-500 text-xs">RSI</div>
                    <div class="font-mono font-semibold text-pink-700" data-stochrsi-rsi-period>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500 text-xs">Stoch</div>
                    <div class="font-mono font-semibold text-pink-700" data-stochrsi-stoch-period>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500 text-xs">K</div>
                    <div class="font-mono font-semibold text-pink-700" data-stochrsi-k-period>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500 text-xs">D</div>
                    <div class="font-mono font-semibold text-pink-700" data-stochrsi-d-period>–</div>
                  </div>
                </div>
                <div class="border-t border-pink-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">%K:</span>
                    <span class="font-mono font-bold text-pink-700 text-sm" data-stochrsi-k>–</span>
                  </div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg">
                    <span class="text-xs font-medium text-gray-600">%D:</span>
                    <span class="font-mono font-bold text-pink-700 text-sm" data-stochrsi-d>–</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Parabolic SAR Card - Spike Design -->
            <div class="group bg-gradient-to-br from-red-50 via-white to-red-50 rounded-xl border border-red-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="psar" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">PSAR</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-800 text-sm">Parabolic SAR</h3>
                    <p class="text-xs text-gray-500">Trend Reversal</p>
                  </div>
                </div>
                <div class="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center">
                    <div class="text-gray-500">Step</div>
                    <div class="font-mono font-semibold text-red-700" data-psar-step>–</div>
                  </div>
                  <div class="text-center">
                    <div class="text-gray-500">Max Step</div>
                    <div class="font-mono font-semibold text-red-700" data-psar-max-step>–</div>
                  </div>
                </div>
                <div class="border-t border-red-200 pt-2">
                  <div class="text-center">
                    <div class="text-2xl font-black text-red-700 mb-1" data-psar>–</div>
                    <div class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700" data-psar-trend>
                      Calculating...
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    toggleContainer.parentNode.insertBefore(
      valuesContainer,
      toggleContainer.nextSibling
    );
  }

  // ✅ Enhanced indicator button handlers with perfect sync between chart and cards
  setupIndicatorButtonHandlers() {
    const buttons = document.querySelectorAll(".ind-btn");
    const valuesContainer = document.querySelector(
      "[data-indicator-values-container]"
    );

    buttons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const indicatorType = e.currentTarget.dataset.ind;
        const isCurrentlyActive = e.currentTarget.classList.contains("active");
        const shouldActivate = !isCurrentlyActive;

        console.log(
          `🔄 Toggle ${indicatorType}: ${
            shouldActivate ? "ACTIVATE" : "DEACTIVATE"
          }`
        );

        // 1️⃣ Update button visual state
        this.toggleIndicatorButton(e.currentTarget, shouldActivate);

        // 2️⃣ Toggle in chart manager
        if (this.chartManager) {
          this.chartManager.toggleIndicator(indicatorType);
        }

        // 3️⃣ Update card visibility immediately - ALWAYS SYNC WITH BUTTON STATE
        setTimeout(() => {
          this.updateIndicatorCardVisibility();

          // 4️⃣ Show/hide the entire values container based on ANY active indicators
          const hasAnyActiveIndicators =
            document.querySelector(".ind-btn.active") !== null;

          if (valuesContainer) {
            if (hasAnyActiveIndicators) {
              // Show container with animation
              valuesContainer.style.display = "block";
              valuesContainer.style.opacity = "0";
              valuesContainer.style.transform = "translateY(10px)";
              requestAnimationFrame(() => {
                valuesContainer.style.transition =
                  "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
                valuesContainer.style.opacity = "1";
                valuesContainer.style.transform = "translateY(0)";
              });
            } else {
              // Hide container with animation
              valuesContainer.style.transition =
                "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
              valuesContainer.style.opacity = "0";
              valuesContainer.style.transform = "translateY(-10px)";
              setTimeout(() => {
                valuesContainer.style.display = "none";
                valuesContainer.style.transform = "translateY(0)";
              }, 300);
            }
          }

          // 5️⃣ Update chart height and save preferences
          this.updateChartContainerHeight();
          this.saveIndicatorPreferences();

          console.log(
            `✅ ${indicatorType} ${
              shouldActivate ? "activated" : "deactivated"
            } in both chart and card`
          );
        }, 50);
      });
    });
  }

  // ✅ Fixed card visibility - always sync with active button states
  updateIndicatorCardVisibility() {
    // Get all currently active indicators from button states
    const activeIndicators = new Set(
      Array.from(document.querySelectorAll(".ind-btn.active")).map(
        (btn) => btn.dataset.ind
      )
    );

    console.log(
      "🎯 Active indicators from buttons:",
      Array.from(activeIndicators)
    );

    // Show/hide indicator cards based on button active status
    document.querySelectorAll("[data-indicator-card]").forEach((card) => {
      const indicatorType = card.getAttribute("data-indicator-card");
      const shouldShow = activeIndicators.has(indicatorType);

      if (shouldShow) {
        // Show card with smooth animation
        if (card.style.display === "none" || !card.style.display) {
          card.style.display = "block";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          requestAnimationFrame(() => {
            card.style.transition = "all 0.3s ease-in-out";
            card.style.opacity = "1";
            card.style.transform = "scale(1)";
          });
        }
        console.log(`✅ Showing card for ${indicatorType}`);
      } else {
        // Hide card
        if (card.style.display !== "none") {
          card.style.transition = "all 0.2s ease-in-out";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          setTimeout(() => {
            card.style.display = "none";
            card.style.transform = "scale(1)";
          }, 200);
        }
        console.log(`❌ Hiding card for ${indicatorType}`);
      }
    });
  }

  toggleIndicatorButton(button, active) {
    const color = button.dataset.color || "blue";

    if (active) {
      button.classList.add(
        "active",
        `bg-${color}-100`,
        `text-${color}-700`,
        `border-${color}-300`,
        "shadow-md"
      );
      button.classList.remove("bg-white", "text-gray-600", "border-gray-200");
    } else {
      button.classList.remove(
        "active",
        `bg-${color}-100`,
        `text-${color}-700`,
        `border-${color}-300`,
        "shadow-md"
      );
      button.classList.add("bg-white", "text-gray-600", "border-gray-200");
    }
  }

  updateChartContainerHeight() {
    const chartContainer = document.getElementById("candlestick-chart");
    if (!chartContainer) return;

    const hasActiveSubIndicators = ["rsi", "macd", "stoch", "stochrsi"].some(
      (type) => document.querySelector(`[data-ind="${type}"].active`) !== null
    );

    // Calculate dynamic height based on active indicators
    const baseHeight = 500;
    const activeSubCount = ["rsi", "macd", "stoch", "stochrsi"].filter(
      (type) => document.querySelector(`[data-ind="${type}"].active`) !== null
    ).length;
    const subPanelHeight = activeSubCount * 120;
    const totalHeight = baseHeight + subPanelHeight;

    // Update the container height
    chartContainer.style.height = `${totalHeight}px`;

    // Update chart container class to reflect the new height
    chartContainer.className = chartContainer.className.replace(
      /h-\[\d+px\]/,
      `h-[${totalHeight}px]`
    );
  }

  saveIndicatorPreferences() {
    const activeIndicators = Array.from(
      document.querySelectorAll(".ind-btn.active")
    ).map((btn) => btn.dataset.ind);
    localStorage.setItem("activeIndicators", JSON.stringify(activeIndicators));
  }

  loadIndicatorPreferences() {
    const saved = localStorage.getItem("activeIndicators");
    const valuesContainer = document.querySelector(
      "[data-indicator-values-container]"
    );

    if (saved) {
      try {
        const activeIndicators = JSON.parse(saved);

        activeIndicators.forEach((indicatorType) => {
          const button = document.querySelector(
            `[data-ind="${indicatorType}"]`
          );
          if (button) {
            this.toggleIndicatorButton(button, true);

            if (this.chartManager) {
              setTimeout(() => {
                this.chartManager.toggleIndicator(indicatorType);
              }, 1000);
            }
          }
        });

        // Update card visibility and show container if there are active indicators
        this.updateIndicatorCardVisibility();
        if (activeIndicators.length > 0 && valuesContainer) {
          valuesContainer.style.display = "block";
        }
      } catch (e) {
        console.warn("Failed to load indicator preferences:", e);
      }
    }
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

  // ✅ Enhanced data fetching focused on chart updates with API last candle timestamp
  async fetchCandleDataAndUpdate() {
    try {
      console.log("🔄 Fetching candle data from API...");
      const candleData = await this.apiService.fetchCandles(
        "BTC-USD",
        this.currentTimeframe
      );

      if (candleData && candleData.success && this.chartManager) {
        // ✅ 1️⃣ Ambil data dari API response
        const chartData = candleData.data || [];

        if (chartData.length === 0) {
          console.warn("⚠️ No candle data received from API");
          return;
        }

        // ✅ 2️⃣ Ambil candle terakhir dan timestamp dari API
        const latestCandle = chartData[chartData.length - 1];
        const latestIndicators = latestCandle?.indicators || {};
        const latestTimestamp = latestCandle?.time;

        console.log("📊 Latest candle from API:", {
          time: latestTimestamp,
          close: latestCandle?.close,
          indicators: Object.keys(latestIndicators),
        });

        // ✅ 3️⃣ Convert to proper format with indicators
        const formattedData = chartData.map((item) => ({
          time: Number(item.time),
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
          indicators: item.indicators || {},
        }));

        // ✅ 4️⃣ Update chart with formatted data
        this.chartManager.updateData(formattedData);

        // ✅ 5️⃣ Update indicator values HANYA dari data candle terakhir API
        setTimeout(() => {
          console.log(
            "🎯 Updating indicator values from API latest candle:",
            latestIndicators
          );
          this.updateIndicatorValuesFromLatestData(
            latestIndicators,
            latestTimestamp
          );
          this.updateIndicatorStatusBadges();
        }, 100);

        // ✅ 6️⃣ Hide loading overlay
        requestAnimationFrame(() => {
          const loadingOverlay = document.querySelector(".chart-loading");
          if (loadingOverlay) {
            loadingOverlay.style.display = "none";
          }
        });

        console.log(
          "✅ Chart and indicators updated with API LATEST CANDLE data (not live)"
        );
        console.log(
          "📈 API candle timestamp used:",
          new Date(latestTimestamp * 1000).toLocaleString()
        );
      }
    } catch (error) {
      console.error("❌ Error fetching candle data:", error);
    }
  }

  // ✅ New method to update indicator values from latest API data with API timestamp
  updateIndicatorValuesFromLatestData(latestIndicators, apiTimestamp) {
    if (!latestIndicators || Object.keys(latestIndicators).length === 0) {
      console.warn("⚠️ No indicator data available from API");
      return;
    }

    // Format number helper function
    const formatValue = (value, decimals = 2) => {
      if (value === undefined || value === null || isNaN(value)) return "–";
      return typeof value === "number"
        ? value.toFixed(decimals)
        : value.toString();
    };

    // ✅ Update timestamp menggunakan waktu dari API candle terakhir (bukan waktu lokal)
    const timestampEl = document.querySelector("[data-last-update]");
    if (timestampEl && apiTimestamp) {
      const apiDate = new Date(apiTimestamp * 1000);
      timestampEl.textContent = `API: ${apiDate.toLocaleString()}`;
      console.log(
        "🕒 Header timestamp updated with API candle time:",
        apiDate.toLocaleString()
      );
    }

    // ✅ SMA Values Update
    if (latestIndicators.sma) {
      const sma20El = document.querySelector("[data-sma20]");
      const sma50El = document.querySelector("[data-sma50]");
      if (sma20El && latestIndicators.sma[20] !== undefined) {
        sma20El.textContent = `$${formatValue(latestIndicators.sma[20], 2)}`;
        this.animateValueUpdate(sma20El);
      }
      if (sma50El && latestIndicators.sma[50] !== undefined) {
        sma50El.textContent = `$${formatValue(latestIndicators.sma[50], 2)}`;
        this.animateValueUpdate(sma50El);
      }
    }

    // ✅ EMA Values Update
    if (latestIndicators.ema) {
      const ema20El = document.querySelector("[data-ema20]");
      const ema50El = document.querySelector("[data-ema50]");
      if (ema20El && latestIndicators.ema[20] !== undefined) {
        ema20El.textContent = `$${formatValue(latestIndicators.ema[20], 2)}`;
        this.animateValueUpdate(ema20El);
      }
      if (ema50El && latestIndicators.ema[50] !== undefined) {
        ema50El.textContent = `$${formatValue(latestIndicators.ema[50], 2)}`;
        this.animateValueUpdate(ema50El);
      }
    }

    // ✅ RSI Values Update with Status
    if (latestIndicators.rsi && latestIndicators.rsi[14] !== undefined) {
      const rsiEl = document.querySelector("[data-rsi]");
      const rsiStatusEl = document.querySelector("[data-rsi-status]");

      if (rsiEl) {
        const rsiValue = parseFloat(latestIndicators.rsi[14]);
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
    }

    // ✅ MACD Values Update with Parameters
    if (latestIndicators.macd) {
      const macdEl = document.querySelector("[data-macd]");
      const macdSignalEl = document.querySelector("[data-macd-signal]");
      const macdHistEl = document.querySelector("[data-macd-hist]");
      const macdFastEl = document.querySelector("[data-macd-fast]");
      const macdSlowEl = document.querySelector("[data-macd-slow]");
      const macdSignalPeriodEl = document.querySelector(
        "[data-macd-signal-period]"
      );

      if (macdEl && latestIndicators.macd.macd !== undefined) {
        macdEl.textContent = formatValue(latestIndicators.macd.macd, 3);
        this.animateValueUpdate(macdEl);
      }
      if (macdSignalEl && latestIndicators.macd.signalLine !== undefined) {
        macdSignalEl.textContent = formatValue(
          latestIndicators.macd.signalLine,
          3
        );
        this.animateValueUpdate(macdSignalEl);
      }
      if (macdHistEl && latestIndicators.macd.histogram !== undefined) {
        const histValue = parseFloat(latestIndicators.macd.histogram);
        macdHistEl.textContent = formatValue(histValue, 3);
        macdHistEl.className =
          histValue >= 0
            ? "font-mono font-bold text-green-700 text-sm"
            : "font-mono font-bold text-red-700 text-sm";
        this.animateValueUpdate(macdHistEl);
      }

      // Update MACD parameters
      if (macdFastEl && latestIndicators.macd.fast !== undefined) {
        macdFastEl.textContent = latestIndicators.macd.fast;
      }
      if (macdSlowEl && latestIndicators.macd.slow !== undefined) {
        macdSlowEl.textContent = latestIndicators.macd.slow;
      }
      if (macdSignalPeriodEl && latestIndicators.macd.signal !== undefined) {
        macdSignalPeriodEl.textContent = latestIndicators.macd.signal;
      }
    }

    // ✅ Bollinger Bands Values Update
    if (latestIndicators.bollingerBands) {
      const bbUpperEl = document.querySelector("[data-bb-upper]");
      const bbLowerEl = document.querySelector("[data-bb-lower]");
      const bbPeriodEl = document.querySelector("[data-bb-period]");
      const bbMultiplierEl = document.querySelector("[data-bb-multiplier]");

      if (bbUpperEl && latestIndicators.bollingerBands.upper !== undefined) {
        bbUpperEl.textContent = `$${formatValue(
          latestIndicators.bollingerBands.upper,
          2
        )}`;
        this.animateValueUpdate(bbUpperEl);
      }
      if (bbLowerEl && latestIndicators.bollingerBands.lower !== undefined) {
        bbLowerEl.textContent = `$${formatValue(
          latestIndicators.bollingerBands.lower,
          2
        )}`;
        this.animateValueUpdate(bbLowerEl);
      }
      if (bbPeriodEl && latestIndicators.bollingerBands.period !== undefined) {
        bbPeriodEl.textContent = latestIndicators.bollingerBands.period;
      }
      if (
        bbMultiplierEl &&
        latestIndicators.bollingerBands.multiplier !== undefined
      ) {
        bbMultiplierEl.textContent = latestIndicators.bollingerBands.multiplier;
      }
    }

    // ✅ Stochastic Values Update
    if (latestIndicators.stochastic) {
      const stochKEl = document.querySelector("[data-stoch-k]");
      const stochDEl = document.querySelector("[data-stoch-d]");
      const stochKPeriodEl = document.querySelector("[data-stoch-k-period]");
      const stochDPeriodEl = document.querySelector("[data-stoch-d-period]");

      if (stochKEl && latestIndicators.stochastic["%K"] !== undefined) {
        stochKEl.textContent = formatValue(
          latestIndicators.stochastic["%K"],
          2
        );
        this.animateValueUpdate(stochKEl);
      }
      if (stochDEl && latestIndicators.stochastic["%D"] !== undefined) {
        stochDEl.textContent = formatValue(
          latestIndicators.stochastic["%D"],
          2
        );
        this.animateValueUpdate(stochDEl);
      }
      if (stochKPeriodEl && latestIndicators.stochastic.kPeriod !== undefined) {
        stochKPeriodEl.textContent = latestIndicators.stochastic.kPeriod;
      }
      if (stochDPeriodEl && latestIndicators.stochastic.dPeriod !== undefined) {
        stochDPeriodEl.textContent = latestIndicators.stochastic.dPeriod;
      }
    }

    // ✅ Stochastic RSI Values Update
    if (latestIndicators.stochasticRsi) {
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

      if (stochRsiKEl && latestIndicators.stochasticRsi["%K"] !== undefined) {
        stochRsiKEl.textContent = formatValue(
          latestIndicators.stochasticRsi["%K"],
          2
        );
        this.animateValueUpdate(stochRsiKEl);
      }
      if (stochRsiDEl && latestIndicators.stochasticRsi["%D"] !== undefined) {
        stochRsiDEl.textContent = formatValue(
          latestIndicators.stochasticRsi["%D"],
          2
        );
        this.animateValueUpdate(stochRsiDEl);
      }
      if (
        stochRsiRsiPeriodEl &&
        latestIndicators.stochasticRsi.rsiPeriod !== undefined
      ) {
        stochRsiRsiPeriodEl.textContent =
          latestIndicators.stochasticRsi.rsiPeriod;
      }
      if (
        stochRsiStochPeriodEl &&
        latestIndicators.stochasticRsi.stochPeriod !== undefined
      ) {
        stochRsiStochPeriodEl.textContent =
          latestIndicators.stochasticRsi.stochPeriod;
      }
      if (
        stochRsiKPeriodEl &&
        latestIndicators.stochasticRsi.kPeriod !== undefined
      ) {
        stochRsiKPeriodEl.textContent = latestIndicators.stochasticRsi.kPeriod;
      }
      if (
        stochRsiDPeriodEl &&
        latestIndicators.stochasticRsi.dPeriod !== undefined
      ) {
        stochRsiDPeriodEl.textContent = latestIndicators.stochasticRsi.dPeriod;
      }
    }

    // ✅ Parabolic SAR Values Update
    if (latestIndicators.parabolicSar) {
      const psarEl = document.querySelector("[data-psar]");
      const psarStepEl = document.querySelector("[data-psar-step]");
      const psarMaxStepEl = document.querySelector("[data-psar-max-step]");
      const psarTrendEl = document.querySelector("[data-psar-trend]");

      if (psarEl && latestIndicators.parabolicSar.value !== undefined) {
        psarEl.textContent = `$${formatValue(
          latestIndicators.parabolicSar.value,
          2
        )}`;
        this.animateValueUpdate(psarEl);
      }
      if (psarStepEl && latestIndicators.parabolicSar.step !== undefined) {
        psarStepEl.textContent = latestIndicators.parabolicSar.step;
      }
      if (
        psarMaxStepEl &&
        latestIndicators.parabolicSar.maxStep !== undefined
      ) {
        psarMaxStepEl.textContent = latestIndicators.parabolicSar.maxStep;
      }
      if (psarTrendEl) {
        psarTrendEl.textContent = "Active Signal";
        psarTrendEl.className =
          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700";
      }
    }

    console.log("✅ Indicator values updated from API latest candle data:", {
      timestamp: new Date(apiTimestamp * 1000).toLocaleString(),
      indicators: Object.keys(latestIndicators),
    });
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

  // ✅ Enhanced status badge updates for indicators
  updateIndicatorStatusBadges() {
    // This method can be used to update any additional status indicators
    // Currently handled within updateIndicatorValuesFromLatestData
    console.log("🎯 Status badges updated");
  }

  // ✅ Modified data polling - NO real-time polling, only fetch when needed
  startDataPolling() {
    if (this.dataPoller) {
      clearInterval(this.dataPoller);
      this.dataPoller = null;
    }

    // ✅ Fetch initial data immediately (from API candle, not live)
    this.fetchCandleDataAndUpdate();

    // ✅ NO continuous polling - data only updates when:
    // - Page loads
    // - Timeframe changes
    // - Manual refresh (if implemented)
    console.log(
      "✅ Dashboard initialized with API candle data (no real-time polling)"
    );
    console.log(
      "🎯 Data source: Latest candle from API response, not live data"
    );
  }

  // ✅ Manual refresh method (can be called when needed)
  async refreshData() {
    console.log("🔄 Manual data refresh triggered");
    await this.fetchCandleDataAndUpdate();
  }
}
