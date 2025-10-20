import * as ApiService from "../services/api.service.js";
import { CandlestickChart } from "./chart.manager.js";

export class DashboardPage {
  // ---- Singleton helpers ----------------------------------------------------
  static get instance() {
    if (!window.__DashboardInstance)
      window.__DashboardInstance = new DashboardPage(true);
    return window.__DashboardInstance;
  }

  constructor(_singletonBypass = false) {
    if (!_singletonBypass && window.__DashboardInstance)
      return window.__DashboardInstance;

    this.apiService = ApiService;
    this.chartManager = null;
    this.currentTimeframe = "1h";

    this.isActive = false;
    this.isInitialized = false;
    this.pollers = []; // tempat semua setInterval
    this.boundListeners = []; // simpan event listener untuk mudah di-unbind
    this.domReady =
      document.readyState === "complete" ||
      document.readyState === "interactive";
    if (!this.domReady) {
      const onReady = () => {
        this.domReady = true;
        document.removeEventListener("DOMContentLoaded", onReady);
      };
      document.addEventListener("DOMContentLoaded", onReady);
      this.boundListeners.push({
        target: document,
        type: "DOMContentLoaded",
        handler: onReady,
      });
    }
  }

  // ---- Public lifecycle -----------------------------------------------------
  async initialize() {
    // Global page guard—mencegah render ganda saat navigasi SPA
    if (window.__DashboardActive) {
      // Jika ada instance lama tapi belum sempat destroy, bersihkan dulu
      if (window.__DashboardInstance && window.__DashboardInstance !== this) {
        window.__DashboardInstance.destroy();
      } else {
        // Sudah aktif & terinisialisasi; tidak usah render lagi
        console.log("⚠️ Dashboard already active. Skipping re-init.");
        return;
      }
    }

    // Tandai halaman Dashboard sedang aktif
    window.__DashboardActive = true;
    window.__DashboardInstance = this;
    this.isActive = true;
    this.isInitialized = false;

    if (!this.domReady) {
      const reInit = () => {
        document.removeEventListener("DOMContentLoaded", reInit);
        this.initialize();
      };
      document.addEventListener("DOMContentLoaded", reInit);
      this.boundListeners.push({
        target: document,
        type: "DOMContentLoaded",
        handler: reInit,
      });
      return;
    }

    // Bersihkan residu DOM/interval dari render sebelumnya (kalau ada)
    this._cleanupDOMOnce();

    // Init chart + controls
    this._initializeCandlestickChart();

    // Data awal + polling candle (tanpa mengubah tampilan)
    this._fetchCandlesAndUpdate(); // sekali di awal
    // (Tidak ada polling chart kontinyu—tetap sesuai logika sebelumnya yang fetch saat ganti timeframe)

    // Mount Top 5 coins section (UI sama) + start polling 3s
    this._ensureMarketCapSection();
    this._startMarketCapPolling(); // interval 3s, dibersihkan di destroy()

    this.isInitialized = true;
    console.log("✅ Dashboard initialized (idempotent & no double render)");
  }

  destroy() {
    console.log("🧹 Destroying Dashboard page...");
    this.isActive = false;
    this.isInitialized = false;

    // Hentikan semua interval
    this.pollers.forEach((id) => clearInterval(id));
    this.pollers = [];

    // Lepas semua event listeners yang pernah didaftarkan
    this.boundListeners.forEach(({ target, type, handler, opts }) => {
      try {
        target.removeEventListener(type, handler, opts);
      } catch (_) {}
    });
    this.boundListeners = [];

    // Hancurkan chart manager
    if (this.chartManager) {
      try {
        this.chartManager.destroy();
      } catch (_) {}
      this.chartManager = null;
    }

    // Bersihkan DOM dinamis yang berpotensi dobel
    this._removeIfExists("#dashboard-marketcap-live");

    // Tandai global guard non-aktif
    window.__DashboardActive = false;
  }

  // ---- Internal helpers: DOM ------------------------------------------------
  _cleanupDOMOnce() {
    // Pastikan container unik tidak tersisa dari render sebelumnya
    this._removeDuplicatesById("dashboard-marketcap-live");

    // Reset overlay loading chart (jika ada)
    const overlay = document.querySelector(".chart-loading");
    if (overlay) overlay.style.display = "flex";
  }

  _removeIfExists(selector) {
    const el = document.querySelector(selector);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  _removeDuplicatesById(id) {
    const nodes = document.querySelectorAll(`#${CSS.escape(id)}`);
    if (nodes.length > 1) {
      nodes.forEach((n, i) => {
        if (i > 0 && n.parentNode) n.parentNode.removeChild(n);
      });
    }
  }

  _ensureOnce(selector, createFn) {
    let el = document.querySelector(selector);
    if (!el) {
      el = createFn();
    }
    return el;
  }

  // ---- Chart + Indicators (tampilan tetap sama) ----------------------------
  _initializeCandlestickChart() {
    const container = document.getElementById("candlestick-chart");
    if (!container) {
      console.error("❌ Chart container not found!");
      return;
    }

    // Bersihkan konten chart lama (kecuali overlay)
    Array.from(container.children).forEach((child) => {
      if (!child.classList?.contains("chart-loading"))
        container.removeChild(child);
    });

    // Inisialisasi chart manager sekali saja
    if (!this.chartManager) {
      this.chartManager = new CandlestickChart("candlestick-chart");
      const ok = this.chartManager.init();
      if (!ok) {
        console.error("❌ Chart init failed");
        return;
      }
    }

    // Timeframe buttons (pakai markup UI yang sama)
    this._setupTimeframeButtons();

    // Panel indikator + kartu nilai (markup & style sama persis)
    this._ensureIndicatorToggleUI();
    this._ensureIndicatorValuesUI();

    // Load preferensi indikator & aktifkan default bila kosong
    this._loadIndicatorPreferencesOrDefaults();
  }

  _setupTimeframeButtons() {
    const buttons = document.querySelectorAll("[data-timeframe]");
    const onClick = (e) => {
      const tf = e.currentTarget.dataset.timeframe;
      if (tf && tf !== this.currentTimeframe) {
        this.currentTimeframe = tf;
        // Update style tombol (UI tetap sama)
        buttons.forEach((b) =>
          b.classList.remove("bg-blue-100", "text-blue-600")
        );
        buttons.forEach((b) => b.classList.add("bg-gray-100", "text-gray-600"));
        e.currentTarget.classList.remove("bg-gray-100", "text-gray-600");
        e.currentTarget.classList.add("bg-blue-100", "text-blue-600");
        // Fetch data baru
        this._fetchCandlesAndUpdate();
      }
    };

    buttons.forEach((btn) => {
      btn.removeEventListener("click", onClick);
      btn.addEventListener("click", onClick);
      this.boundListeners.push({
        target: btn,
        type: "click",
        handler: onClick,
      });
    });
  }

  _ensureIndicatorToggleUI() {
    // UI & gaya sama; hanya dijamin dibuat sekali
    const card = document.querySelector("#candlestick-chart")?.closest(".card");
    const chartDiv = card?.querySelector("#candlestick-chart");
    if (!chartDiv || !card) return;

    const existing = card.querySelector(".indicator-buttons")?.closest(".mt-4");
    if (existing) return; // sudah ada

    const wrap = document.createElement("div");
    wrap.className =
      "mt-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-200 shadow-sm";
    wrap.innerHTML = `
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
        ${this._indicatorButtonsHTML()}
      </div>
    `;
    chartDiv.parentNode.insertBefore(wrap, chartDiv.nextSibling);

    // Bind tombol indikator (logic disederhanakan, UI tetap)
    this._bindIndicatorButtons();
  }

  _indicatorButtonsHTML() {
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
        data-ind="${ind.id}" data-color="${ind.color}">
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

  _bindIndicatorButtons() {
    const buttons = document.querySelectorAll(".ind-btn");
    const toggleBtn = (btn, active) => {
      const color = btn.dataset.color || "blue";
      btn.classList.toggle("active", active);
      const add = active
        ? [
            "bg-" + color + "-100",
            "text-" + color + "-700",
            "border-" + color + "-300",
            "shadow-md",
          ]
        : [];
      const remove = [
        "bg-white",
        "text-gray-600",
        "border-gray-200",
        "shadow-md",
        "bg-blue-100",
        "text-blue-700",
        "border-blue-300",
        "bg-purple-100",
        "text-purple-700",
        "border-purple-300",
        "bg-yellow-100",
        "text-yellow-700",
        "border-yellow-300",
        "bg-green-100",
        "text-green-700",
        "border-green-300",
        "bg-cyan-100",
        "text-cyan-700",
        "border-cyan-300",
        "bg-orange-100",
        "text-orange-700",
        "border-orange-300",
        "bg-pink-100",
        "text-pink-700",
        "border-pink-300",
        "bg-indigo-100",
        "text-indigo-700",
        "border-indigo-300",
      ];
      btn.classList.remove(...remove);
      if (active) btn.classList.add(...add);
      else btn.classList.add("bg-white", "text-gray-600", "border-gray-200");
    };

    const onClick = (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      const type = btn.dataset.ind;
      const willActivate = !btn.classList.contains("active");
      toggleBtn(btn, willActivate);

      // Tampilkan/ sembunyikan card indikator sesuai tombol
      this._syncIndicatorCardsWithButtons();

      // Toggle di chart
      if (this.chartManager) this.chartManager.toggleIndicator(type);

      // Refresh data terakhir supaya nilai indikator tampil
      setTimeout(() => this._refreshChartLatestIndicators(), 150);

      // Simpan preferensi
      this._saveIndicatorPreferences();

      // Sesuaikan tinggi chart (tetap seperti logic kamu)
      this._fitChartHeightBySubPanels();
    };

    buttons.forEach((btn) => {
      btn.removeEventListener("click", onClick);
      btn.addEventListener("click", onClick);
      this.boundListeners.push({
        target: btn,
        type: "click",
        handler: onClick,
      });
    });
  }

  _ensureIndicatorValuesUI() {
    const card = document.querySelector("#candlestick-chart")?.closest(".card");
    const toggleWrap = card
      ?.querySelector(".indicator-buttons")
      ?.closest(".mt-4");
    if (!card || !toggleWrap) return;

    const existing = card.querySelector("[data-indicator-values-container]");
    if (existing) return;

    const values = document.createElement("div");
    values.className = "mt-4";
    values.style.display = "none";
    values.setAttribute("data-indicator-values-container", "");
    // 👉 Markup card indikator disalin dari versi kamu (UI sama persis)
    values.innerHTML = `
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
            <div class="text-sm text-gray-400 font-mono" data-last-update>Loading...</div>
          </div>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-indicator-values>
            <!-- SMA -->
            <div class="group bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-xl border border-blue-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="sma" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center"><span class="text-white text-sm font-bold">SMA</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Simple MA</h3><p class="text-xs text-gray-500">Trend Analysis</p></div>
                </div>
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">SMA 20:</span><span class="font-mono font-bold text-blue-700 text-sm" data-sma20>–</span></div>
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">SMA 50:</span><span class="font-mono font-bold text-blue-700 text-sm" data-sma50>–</span></div>
              </div>
            </div>
            <!-- EMA -->
            <div class="group bg-gradient-to-br from-purple-50 via-white to-purple-50 rounded-xl border border-purple-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="ema" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center"><span class="text-white text-sm font-bold">EMA</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Exponential MA</h3><p class="text-xs text-gray-500">Responsive Trend</p></div>
                </div>
                <div class="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">EMA 20:</span><span class="font-mono font-bold text-purple-700 text-sm" data-ema20>–</span></div>
                <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">EMA 50:</span><span class="font-mono font-bold text-purple-700 text-sm" data-ema50>–</span></div>
              </div>
            </div>
            <!-- RSI -->
            <div class="group bg-gradient-to-br from-indigo-50 via-white to-indigo-50 rounded-xl border border-indigo-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="rsi" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><span class="text-white text-sm font-bold">RSI</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">RSI (14)</h3><p class="text-xs text-gray-500">Momentum</p></div>
                </div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
              </div>
              <div class="text-center">
                <div class="text-3xl font-black text-indigo-700 mb-2" data-rsi>–</div>
                <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" data-rsi-status><div class="w-2 h-2 rounded-full mr-2"></div>Neutral</div>
              </div>
            </div>
            <!-- MACD -->
            <div class="group bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-xl border border-emerald-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="macd" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><span class="text-white text-xs font-bold">MACD</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">MACD</h3><p class="text-xs text-gray-500">Convergence</p></div>
                </div>
                <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-3 gap-1 text-xs mb-2">
                  <div class="text-center"><div class="text-gray-500">Fast</div><div class="font-mono font-semibold text-emerald-700" data-macd-fast>–</div></div>
                  <div class="text-center"><div class="text-gray-500">Slow</div><div class="font-mono font-semibold text-emerald-700" data-macd-slow>–</div></div>
                  <div class="text-center"><div class="text-gray-500">Signal</div><div class="font-mono font-semibold text-emerald-700" data-macd-signal-period>–</div></div>
                </div>
                <div class="border-t border-emerald-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">MACD:</span><span class="font-mono font-bold text-emerald-700 text-sm" data-macd>–</span></div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">Signal:</span><span class="font-mono font-bold text-emerald-700 text-sm" data-macd-signal>–</span></div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">Histogram:</span><span class="font-mono font-bold text-emerald-700 text-sm" data-macd-hist>–</span></div>
                </div>
              </div>
            </div>
            <!-- BB -->
            <div class="group bg-gradient-to-br from-cyan-50 via-white to-cyan-50 rounded-xl border border-cyan-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="bb" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center"><span class="text-white text-xs font-bold">BB</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Bollinger B.</h3><p class="text-xs text-gray-500">Volatility</p></div>
                </div>
                <div class="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center"><div class="text-gray-500">Period</div><div class="font-mono font-semibold text-cyan-700" data-bb-period>–</div></div>
                  <div class="text-center"><div class="text-gray-500">Multiplier</div><div class="font-mono font-semibold text-cyan-700" data-bb-multiplier>–</div></div>
                </div>
                <div class="border-t border-cyan-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">Upper:</span><span class="font-mono font-bold text-cyan-700 text-sm" data-bb-upper>–</span></div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">Lower:</span><span class="font-mono font-bold text-cyan-700 text-sm" data-bb-lower>–</span></div>
                </div>
              </div>
            </div>
            <!-- Stoch -->
            <div class="group bg-gradient-to-br from-violet-50 via-white to-violet-50 rounded-xl border border-violet-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="stoch" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center"><span class="text-white text-xs font-bold">STOCH</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Stochastic</h3><p class="text-xs text-gray-500">Oscillator</p></div>
                </div>
                <div class="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center"><div class="text-gray-500">K Period</div><div class="font-mono font-semibold text-violet-700" data-stoch-k-period>–</div></div>
                  <div class="text-center"><div class="text-gray-500">D Period</div><div class="font-mono font-semibold text-violet-700" data-stoch-d-period>–</div></div>
                </div>
                <div class="border-t border-violet-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">%K:</span><span class="font-mono font-bold text-violet-700 text-sm" data-stoch-k>–</span></div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="font-mono font-bold text-violet-700 text-sm" data-stoch-d>–</span></div>
                </div>
              </div>
            </div>
            <!-- Stoch RSI -->
            <div class="group bg-gradient-to-br from-pink-50 via-white to-pink-50 rounded-xl border border-pink-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="stochrsi" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center"><span class="text-white text-xs font-bold">StRSI</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Stoch RSI</h3><p class="text-xs text-gray-500">Advanced</p></div>
                </div>
                <div class="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-4 gap-1 text-xs mb-2">
                  <div class="text-center"><div class="text-gray-500 text-xs">RSI</div><div class="font-mono font-semibold text-pink-700" data-stochrsi-rsi-period>–</div></div>
                  <div class="text-center"><div class="text-gray-500 text-xs">Stoch</div><div class="font-mono font-semibold text-pink-700" data-stochrsi-stoch-period>–</div></div>
                  <div class="text-center"><div class="text-gray-500 text-xs">K</div><div class="font-mono font-semibold text-pink-700" data-stochrsi-k-period>–</div></div>
                  <div class="text-center"><div class="text-gray-500 text-xs">D</div><div class="font-mono font-semibold text-pink-700" data-stochrsi-d-period>–</div></div>
                </div>
                <div class="border-t border-pink-200 pt-2 space-y-1">
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="text-xs font-medium text-gray-600">%K:</span><span class="font-mono font-bold text-pink-700 text-sm" data-stochrsi-k>–</span></div>
                  <div class="flex justify-between items-center py-1 px-2 bg-white/60 rounded-lg"><span class="font-mono font-bold text-pink-700 text-sm" data-stochrsi-d>–</span></div>
                </div>
              </div>
            </div>
            <!-- PSAR -->
            <div class="group bg-gradient-to-br from-red-50 via-white to-red-50 rounded-xl border border-red-200 p-4 hover:shadow-lg transition-all duration-300 hover:scale-105" data-indicator-card="psar" style="display: none;">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center"><span class="text-white text-xs font-bold">PSAR</span></div>
                  <div><h3 class="font-semibold text-gray-800 text-sm">Parabolic SAR</h3><p class="text-xs text-gray-500">Trend Reversal</p></div>
                </div>
                <div class="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              </div>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div class="text-center"><div class="text-gray-500">Step</div><div class="font-mono font-semibold text-red-700" data-psar-step>–</div></div>
                <div class="text-center"><div class="text-gray-500">Max Step</div><div class="font-mono font-semibold text-red-700" data-psar-max-step>–</div></div>
                </div>
                <div class="border-t border-red-200 pt-2">
                  <div class="text-center">
                    <div class="text-2xl font-black text-red-700 mb-1" data-psar>–</div>
                    <div class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700" data-psar-trend>Calculating...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    toggleWrap.parentNode.insertBefore(values, toggleWrap.nextSibling);
  }

  _syncIndicatorCardsWithButtons() {
    const active = new Set(
      Array.from(document.querySelectorAll(".ind-btn.active")).map(
        (b) => b.dataset.ind
      )
    );
    document.querySelectorAll("[data-indicator-card]").forEach((card) => {
      const key = card.getAttribute("data-indicator-card");
      const show = active.has(key);
      if (show && (card.style.display === "none" || !card.style.display)) {
        card.style.display = "block";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        requestAnimationFrame(() => {
          card.style.transition = "all .3s";
          card.style.opacity = "1";
          card.style.transform = "scale(1)";
        });
      } else if (!show && card.style.display !== "none") {
        card.style.transition = "all .2s";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        setTimeout(() => {
          card.style.display = "none";
          card.style.transform = "scale(1)";
        }, 200);
      }
    });

    // tampilkan/hidden container values
    const container = document.querySelector(
      "[data-indicator-values-container]"
    );
    if (!container) return;
    if (active.size > 0) {
      if (container.style.display === "none") {
        container.style.display = "block";
        container.style.opacity = "0";
        container.style.transform = "translateY(10px)";
        requestAnimationFrame(() => {
          container.style.transition = "all .4s";
          container.style.opacity = "1";
          container.style.transform = "translateY(0)";
        });
      }
    } else {
      container.style.transition = "all .3s";
      container.style.opacity = "0";
      container.style.transform = "translateY(-10px)";
      setTimeout(() => {
        container.style.display = "none";
        container.style.transform = "translateY(0)";
      }, 300);
    }
  }

  _fitChartHeightBySubPanels() {
    const base = 500;
    const sub = ["rsi", "macd", "stoch", "stochrsi"].filter((t) =>
      document.querySelector(`[data-ind="${t}"].active`)
    ).length;
    const total = base + sub * 120;
    const el = document.getElementById("candlestick-chart");
    if (!el) return;
    el.style.height = `${total}px`;
    el.className = el.className.replace(/h-\[\d+px\]/, `h-[${total}px]`);
  }

  _saveIndicatorPreferences() {
    const active = Array.from(document.querySelectorAll(".ind-btn.active")).map(
      (b) => b.dataset.ind
    );
    localStorage.setItem("activeIndicators", JSON.stringify(active));
  }

  _loadIndicatorPreferencesOrDefaults() {
    const saved = localStorage.getItem("activeIndicators");
    const actives = saved ? JSON.parse(saved) : [];
    // set tombol aktif tanpa trigger chart dulu
    actives.forEach((id) => {
      const btn = document.querySelector(`.ind-btn[data-ind="${id}"]`);
      if (btn && !btn.classList.contains("active")) btn.click(); // gunakan click agar sinkron (akan toggle & refresh)
    });
    if (!saved || actives.length === 0) {
      console.log("🔹 Default: no active indicators on initial load");
      const container = document.querySelector(
        "[data-indicator-values-container]"
      );
      if (container) container.style.display = "none";
    }
  }

  // ---- Candle & indicators data --------------------------------------------
  async _fetchCandlesAndUpdate() {
    try {
      const res = await this.apiService.fetchCandles(
        "BTC-USD",
        this.currentTimeframe
      );
      if (!res?.success || !Array.isArray(res.data) || !this.chartManager)
        return;

      const data = res.data.map((d) => ({
        time: Number(d.time),
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        indicators: d.indicators || {},
      }));

      this.chartManager.updateData(data);

      // Update kartu indikator pakai candle terakhir
      const last = data[data.length - 1];
      setTimeout(
        () => this._updateIndicatorCards(last.indicators, last.time),
        80
      );

      // Hide overlay
      const overlay = document.querySelector(".chart-loading");
      if (overlay) overlay.style.display = "none";

      console.log("📈 Candles updated, tf:", this.currentTimeframe);
    } catch (e) {
      console.error("❌ fetchCandles failed:", e);
    }
  }

  async _refreshChartLatestIndicators() {
    try {
      const res = await this.apiService.fetchCandles(
        "BTC-USD",
        this.currentTimeframe
      );
      if (!res?.success || !Array.isArray(res.data)) return;
      const last = res.data[res.data.length - 1];
      this._updateIndicatorCards(last.indicators || {}, Number(last.time));
    } catch (e) {
      console.warn("⚠️ refresh indicators failed:", e);
    }
  }

  _updateIndicatorCards(ind, apiTs) {
    if (!ind || Object.keys(ind).length === 0) return;
    const fmt = (v, d = 2) =>
      v == null || isNaN(v) ? "–" : typeof v === "number" ? v.toFixed(d) : v;

    const tsEl = document.querySelector("[data-last-update]");
    if (tsEl && apiTs)
      tsEl.textContent = `API: ${new Date(apiTs * 1000).toLocaleString()}`;

    // SMA
    if (ind.sma) {
      const a = document.querySelector("[data-sma20]"),
        b = document.querySelector("[data-sma50]");
      if (a && ind.sma[20] != null) a.textContent = `$${fmt(ind.sma[20])}`;
      if (b && ind.sma[50] != null) b.textContent = `$${fmt(ind.sma[50])}`;
    }
    // EMA
    if (ind.ema) {
      const a = document.querySelector("[data-ema20]"),
        b = document.querySelector("[data-ema50]");
      if (a && ind.ema[20] != null) a.textContent = `$${fmt(ind.ema[20])}`;
      if (b && ind.ema[50] != null) b.textContent = `$${fmt(ind.ema[50])}`;
    }
    // RSI
    if (ind.rsi && ind.rsi[14] != null) {
      const v = parseFloat(ind.rsi[14]);
      const el = document.querySelector("[data-rsi]");
      const badge = document.querySelector("[data-rsi-status]");
      if (el) el.textContent = fmt(v, 2);
      if (badge) {
        let txt = "Neutral",
          cls = "bg-gray-100 text-gray-700 border border-gray-200",
          dot = "bg-gray-400";
        if (v > 70) {
          txt = "Overbought";
          cls = "bg-red-100 text-red-700 border border-red-200";
          dot = "bg-red-400";
        } else if (v < 30) {
          txt = "Oversold";
          cls = "bg-green-100 text-green-700 border border-green-200";
          dot = "bg-green-400";
        }
        badge.innerHTML = `<div class="w-2 h-2 rounded-full mr-2 ${dot}"></div>${txt}`;
        badge.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cls}`;
      }
    }
    // MACD
    if (ind.macd) {
      const { macd, signalLine, histogram, fast, slow, signal } = ind.macd;
      const m = document.querySelector("[data-macd]"),
        s = document.querySelector("[data-macd-signal]"),
        h = document.querySelector("[data-macd-hist]");
      const f = document.querySelector("[data-macd-fast]"),
        sl = document.querySelector("[data-macd-slow]"),
        sp = document.querySelector("[data-macd-signal-period]");
      if (m && macd != null) m.textContent = fmt(macd, 3);
      if (s && signalLine != null) s.textContent = fmt(signalLine, 3);
      if (h && histogram != null) {
        h.textContent = fmt(histogram, 3);
        h.className =
          histogram >= 0
            ? "font-mono font-bold text-green-700 text-sm"
            : "font-mono font-bold text-red-700 text-sm";
      }
      if (f && fast != null) f.textContent = fast;
      if (sl && slow != null) sl.textContent = slow;
      if (sp && signal != null) sp.textContent = signal;
    }
    // BB
    if (ind.bollingerBands) {
      const u = document.querySelector("[data-bb-upper]"),
        l = document.querySelector("[data-bb-lower]");
      const p = document.querySelector("[data-bb-period]"),
        mul = document.querySelector("[data-bb-multiplier]");
      const { upper, lower, period, multiplier } = ind.bollingerBands;
      if (u && upper != null) u.textContent = `$${fmt(upper)}`;
      if (l && lower != null) l.textContent = `$${fmt(lower)}`;
      if (p && period != null) p.textContent = period;
      if (mul && multiplier != null) mul.textContent = multiplier;
    }
    // Stoch
    if (ind.stochastic) {
      const k = document.querySelector("[data-stoch-k]"),
        d = document.querySelector("[data-stoch-d]");
      const kp = document.querySelector("[data-stoch-k-period]"),
        dp = document.querySelector("[data-stoch-d-period]");
      if (k && ind.stochastic["%K"] != null)
        k.textContent = fmt(ind.stochastic["%K"], 2);
      if (d && ind.stochastic["%D"] != null)
        d.textContent = fmt(ind.stochastic["%D"], 2);
      if (kp && ind.stochastic.kPeriod != null)
        kp.textContent = ind.stochastic.kPeriod;
      if (dp && ind.stochastic.dPeriod != null)
        dp.textContent = ind.stochastic.dPeriod;
    }
    // Stoch RSI
    if (ind.stochasticRsi) {
      const k = document.querySelector("[data-stochrsi-k]"),
        d = document.querySelector("[data-stochrsi-d]");
      const rp = document.querySelector("[data-stochrsi-rsi-period]"),
        sp = document.querySelector("[data-stochrsi-stoch-period]"),
        kp = document.querySelector("[data-stochrsi-k-period]"),
        dp = document.querySelector("[data-stochrsi-d-period]");
      if (k && ind.stochasticRsi["%K"] != null)
        k.textContent = fmt(ind.stochasticRsi["%K"], 2);
      if (d && ind.stochasticRsi["%D"] != null)
        d.textContent = fmt(ind.stochasticRsi["%D"], 2);
      if (rp && ind.stochasticRsi.rsiPeriod != null)
        rp.textContent = ind.stochasticRsi.rsiPeriod;
      if (sp && ind.stochasticRsi.stochPeriod != null)
        sp.textContent = ind.stochasticRsi.stochPeriod;
      if (kp && ind.stochasticRsi.kPeriod != null)
        kp.textContent = ind.stochasticRsi.kPeriod;
      if (dp && ind.stochasticRsi.dPeriod != null)
        dp.textContent = ind.stochasticRsi.dPeriod;
    }
    // PSAR
    if (ind.parabolicSar) {
      const v = document.querySelector("[data-psar]"),
        st = document.querySelector("[data-psar-step]"),
        mst = document.querySelector("[data-psar-max-step]"),
        tr = document.querySelector("[data-psar-trend]");
      const { value, step, maxStep } = ind.parabolicSar;
      if (v && value != null) v.textContent = `$${fmt(value)}`;
      if (st && step != null) st.textContent = step;
      if (mst && maxStep != null) mst.textContent = maxStep;
      if (tr) {
        tr.textContent = "Active Signal";
        tr.className =
          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700";
      }
    }
  }

  // ---- Market Cap Top 5 (UI sama, polling 3s) ------------------------------
  _ensureMarketCapSection() {
    const chartSection = document
      .querySelector("#candlestick-chart")
      ?.closest(".card");
    if (!chartSection) return;

    this._removeDuplicatesById("dashboard-marketcap-live");

    this._ensureOnce("#dashboard-marketcap-live", () => {
      const box = document.createElement("div");
      box.id = "dashboard-marketcap-live";
      box.className =
        "mt-6 p-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-200 shadow-sm";
      box.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center"><span class="text-lg">🪙</span></div>
            <div><h4 class="text-lg font-semibold text-gray-900">Top 5 Cryptocurrencies</h4><p class="text-sm text-gray-500">Live market data </p></div>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span class="text-xs text-gray-500" id="marketcap-update-time">Loading...</span>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4" id="top-coins-grid">
          ${this._loadingCardsHTML(5)}
        </div>
        <div class="mt-4 text-center">
          <a href="#marketcap" class="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium">View Full Market Cap Overview →</a>
        </div>`;
      chartSection.querySelector(".card-body").appendChild(box);
      return box;
    });
  }

  _loadingCardsHTML(n) {
    return Array.from({ length: n })
      .map(
        () => `
      <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 animate-pulse">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 bg-gray-300 rounded-full"></div>
          <div class="flex-1">
            <div class="h-4 bg-gray-300 rounded mb-1"></div>
            <div class="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div class="space-y-2">
          <div class="h-5 bg-gray-300 rounded"></div>
          <div class="h-3 bg-gray-200 rounded w-20"></div>
          <div class="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>`
      )
      .join("");
  }

  _startMarketCapPolling() {
    const run = async () => {
      if (!this.isActive) return;
      try {
        const res = await this.apiService.fetchMarketCapLive();
        if (res?.success && Array.isArray(res.data)) {
          const top5 = res.data.slice(0, 5);
          this._renderTopCoins(top5);
          const t = document.getElementById("marketcap-update-time");
          if (t) {
            t.textContent = new Date().toLocaleTimeString();
            t.className = "text-xs text-gray-500";
          }
        }
      } catch (e) {
        console.error("❌ marketcap fetch failed:", e);
        const t = document.getElementById("marketcap-update-time");
        if (t) {
          t.textContent = "Error - " + new Date().toLocaleTimeString();
          t.className = "text-xs text-red-500";
        }
      }
    };

    // jalankan sekarang lalu interval 3s
    run();
    const id = setInterval(run, 3000);
    this.pollers.push(id);
  }

  _renderTopCoins(list) {
    const grid = document.getElementById("top-coins-grid");
    if (!grid) return;

    const priceFmt = (p) =>
      p >= 1000
        ? `$${(p / 1000).toFixed(1)}K`
        : p >= 1
        ? `$${p.toFixed(2)}`
        : `$${p.toFixed(6)}`;
    const volFmt = (v) =>
      v >= 1e6
        ? `${(v / 1e6).toFixed(1)}M`
        : v >= 1e3
        ? `${(v / 1e3).toFixed(1)}K`
        : v.toFixed(2);
    const gradients = [
      "from-yellow-500 to-orange-500",
      "from-gray-400 to-gray-600",
      "from-amber-600 to-amber-800",
      "from-blue-500 to-purple-500",
      "from-green-500 to-teal-500",
    ];

    grid.innerHTML = list
      .map((c, i) => {
        const chg = c.open ? ((c.price - c.open) / c.open) * 100 : 0;
        const clr = chg >= 0 ? "text-green-600" : "text-red-600";
        const bg = chg >= 0 ? "bg-green-100" : "bg-red-100";
        const sign = chg >= 0 ? "+" : "";
        const grad = gradients[i] || "from-gray-500 to-gray-700";
        return `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:scale-105">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 bg-gradient-to-r ${grad} rounded-full flex items-center justify-center text-white text-xs font-bold">${
          c.rank
        }</div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-gray-900 text-sm truncate">${
                c.name
              }</div>
              <div class="text-xs text-gray-500">${c.symbol}</div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="font-mono text-lg font-bold text-gray-900">${priceFmt(
              c.price
            )}</div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">24h:</span>
              <span class="text-xs px-2 py-1 rounded-full ${bg} ${clr} font-medium">${sign}${chg.toFixed(
          2
        )}%</span>
            </div>
            <div class="text-xs text-gray-500">Vol: ${volFmt(c.volume)}</div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">High:</span>
              <span class="text-xs font-mono text-gray-600">${priceFmt(
                c.high
              )}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Low:</span>
              <span class="text-xs font-mono text-gray-600">${priceFmt(
                c.low
              )}</span>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }
}
