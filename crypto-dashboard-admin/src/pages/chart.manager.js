/**
 * CandlestickChart (Refactor Ringkas) – UI & perilaku IDENTIK
 * - Sinkronisasi 2 arah (main <-> sub) memakai throttle requestAnimationFrame
 * - Struktur modular, helper kecil untuk mengurangi duplikasi
 * - Tanpa mengubah tampilan/warna/animasi yang sudah ada
 */

import { createChart, ColorType } from "lightweight-charts";

/* ========================== THEME & HELPERS ========================== */

const THEME = {
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  colors: {
    bg: "#ffffff",
    text: "#333333",
    grid: "#f0f0f0",
    border: "#e1e5e9",
    cross: "#4285f4",
    up: "#00C896",
    down: "#FF3366",
    // sub-panels
    rsi: "#6366f1",
    macd: "#10b981",
    macdSignal: "#f59e0b",
    macdHist: "#64748b",
    stochK: "#8b5cf6",
    stochD: "#a855f7",
    stochRsiK: "#ec4899",
    stochRsiD: "#db2777",
    bb: "#06b6d4",
    psar: "#dc2626",
    sma20: "#2563eb",
    sma50: "#1e40af",
    ema20: "#7c3aed",
    ema50: "#5b21b6",
  },
};

const applyStyles = (el, styles) => Object.assign(el.style, styles);

const rAFThrottle = (fn) => {
  let ticking = false;
  return (...args) => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        fn(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
};

const seconds = (t) => (t > 9999999999 ? Math.floor(t / 1000) : Number(t));

/* ========================== CLASS ========================== */

export class CandlestickChart {
  constructor(containerId) {
    this.containerId = containerId;

    // Main
    this.chart = null;
    this.candleSeries = null;

    // Sub-panels & series
    this.subCharts = {}; // { rsi|macd|stoch|stochrsi: { chart, container, config } }
    this.series = {}; // { indicator: { key: series } }
    this.activeIndicators = new Set();

    // Data
    this.currentData = [];
    this.latestValues = {};

    // State
    this.isInitialized = false;
    this.isFullscreen = false;
    this.resizeObserver = null;

    // Sync
    this.syncing = false;
    this._sync = rAFThrottle((source, { range, logical }) =>
      this._doSync(source, { range, logical })
    );
  }

  /* ---------------------------- INIT ---------------------------- */

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`❌ Container '${this.containerId}' not found!`);
      return false;
    }
    if (this.isInitialized) return true;

    // Container layout
    this._setupContainer(container);

    // Main chart
    this._createMainChart(container);

    // Sub panels (dibuat, tapi hidden)
    this._createSubPanels(container);

    // Fullscreen button
    this._addFullscreenButton(container);
    console.log("🎬 Fullscreen button added");

    // Resize observer
    this._observeResize(container);

    this.isInitialized = true;
    console.log("✅ Chart initialized");
    return true;
  }

  _setupContainer(container) {
    container.innerHTML = "";
    applyStyles(container, {
      width: "100%",
      height: `${this._calcTotalHeight()}px`,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      background: THEME.colors.bg,
      border: `1px solid ${THEME.colors.border}`,
      borderRadius: "8px",
    });
  }

  _createMainChart(container) {
    const main = document.createElement("div");
    main.id = "main-chart";
    applyStyles(main, {
      width: "100%",
      height: `${this._mainHeight()}px`,
      position: "relative",
    });
    container.appendChild(main);

    this.chart = createChart(main, {
      width: container.clientWidth || 800,
      height: this._mainHeight(),
      layout: {
        background: { type: ColorType.Solid, color: THEME.colors.bg },
        textColor: THEME.colors.text,
        fontFamily: THEME.font,
      },
      grid: {
        vertLines: { color: THEME.colors.grid, style: 1, visible: true },
        horzLines: { color: THEME.colors.grid, style: 1, visible: true },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: THEME.colors.cross,
          style: 2,
          labelVisible: true,
          labelBackgroundColor: THEME.colors.cross,
        },
        horzLine: {
          width: 1,
          color: THEME.colors.cross,
          style: 2,
          labelVisible: true,
          labelBackgroundColor: THEME.colors.cross,
        },
      },
      rightPriceScale: {
        borderColor: THEME.colors.border,
        scaleMargins: { top: 0.02, bottom: 0.02 },
        textColor: "#6c757d",
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: THEME.colors.border,
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

    // Candles
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: THEME.colors.up,
      downColor: THEME.colors.down,
      borderVisible: false,
      wickUpColor: THEME.colors.up,
      wickDownColor: THEME.colors.down,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      borderUpColor: THEME.colors.up,
      borderDownColor: THEME.colors.down,
    });

    // Sync from main
    this.chart
      .timeScale()
      .subscribeVisibleTimeRangeChange((range) =>
        this._sync("main", { range, logical: false })
      );
    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((range) =>
        this._sync("main", { range, logical: true })
      );

    // Crosshair sync
    this.chart.subscribeCrosshairMove((param) => this._syncCrosshair(param));
  }

  _createSubPanels(container) {
    const host = document.createElement("div");
    host.id = "sub-panels";
    applyStyles(host, {
      width: "100%",
      flex: "1",
      display: "flex",
      flexDirection: "column",
      background: THEME.colors.bg,
      borderTop: "none",
    });
    container.appendChild(host);

    const configs = {
      rsi: {
        height: 120,
        title: "RSI (14)",
        color: THEME.colors.rsi,
        bounded: { min: 0, max: 100 },
      },
      macd: {
        height: 120,
        title: "MACD (12,26,9)",
        color: THEME.colors.macd,
        bounded: null,
      },
      stoch: {
        height: 120,
        title: "Stochastic (14,3)",
        color: THEME.colors.stochK,
        bounded: { min: 0, max: 100 },
      },
      stochrsi: {
        height: 120,
        title: "Stoch RSI (14,14,3,3)",
        color: THEME.colors.stochRsiK,
        bounded: { min: 0, max: 100 },
      },
    };

    Object.entries(configs).forEach(([key, cfg]) => {
      const sub = document.createElement("div");
      sub.id = `${key}-chart`;
      applyStyles(sub, {
        width: "100%",
        height: `${cfg.height}px`,
        display: "none",
        borderTop: `1px solid ${THEME.colors.border}`,
        background: THEME.colors.bg,
        position: "relative",
        margin: "0",
        padding: "0",
      });

      // Title overlay
      const title = document.createElement("div");
      title.className =
        "absolute top-2 left-3 text-sm font-medium text-gray-700 z-10 bg-white/95 px-2 py-1 rounded shadow-sm border border-gray-200";
      title.innerHTML = `<div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" style="background-color:${cfg.color}"></span>${cfg.title}
      </div>`;
      sub.appendChild(title);

      host.appendChild(sub);

      const options = {
        width: host.clientWidth || 800,
        height: cfg.height,
        layout: {
          background: { type: ColorType.Solid, color: THEME.colors.bg },
          textColor: "#6c757d",
          fontFamily: THEME.font,
        },
        grid: {
          vertLines: { color: THEME.colors.grid, style: 1, visible: true },
          horzLines: { color: THEME.colors.grid, style: 1, visible: true },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: THEME.colors.cross,
            style: 2,
            labelVisible: false,
          },
          horzLine: {
            width: 1,
            color: THEME.colors.cross,
            style: 2,
            labelVisible: true,
            labelBackgroundColor: THEME.colors.cross,
          },
        },
        rightPriceScale: {
          borderColor: THEME.colors.border,
          scaleMargins: { top: 0.05, bottom: 0.05 },
          textColor: "#6c757d",
          entireTextOnly: true,
        },
        timeScale: {
          borderColor: THEME.colors.border,
          timeVisible: false,
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

      const chart = createChart(sub, options);

      // Bounded scale (RSI/Stoch/StochRSI)
      if (cfg.bounded) chart.applyOptions({ rightPriceScale: { mode: 1 } });

      // Sync from sub
      chart
        .timeScale()
        .subscribeVisibleTimeRangeChange((range) =>
          this._sync(key, { range, logical: false })
        );
      chart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((range) =>
          this._sync(key, { range, logical: true })
        );

      this.subCharts[key] = { chart, container: sub, config: cfg };
    });
  }

  _addFullscreenButton(container) {
    // Tombol buka fullscreen (⛶)
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.id = "fullscreen-btn";
    fullscreenBtn.className =
      "absolute top-2 right-2 bg-white/90 hover:bg-blue-50 rounded-lg p-2 shadow-md transition-all duration-200 z-[2000] border border-gray-200 hover:cursor-pointer";
    fullscreenBtn.innerHTML = '<span class="text-base">⛶</span>';
    fullscreenBtn.title = "Fullscreen";
    fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    container.appendChild(fullscreenBtn);

    // Tombol keluar fullscreen (❌)
    const closeFullscreenBtn = document.createElement("button");
    closeFullscreenBtn.id = "close-fullscreen-btn";
    closeFullscreenBtn.className =
      "hidden fixed top-28 right-28 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-none w-8 h-8 flex items-center justify-center shadow-lg transition-all duration-300 border border-gray-300 hover:cursor-pointer";
    closeFullscreenBtn.innerHTML = '<span class="text-lg font-bold">x</span>';
    closeFullscreenBtn.title = "Exit Fullscreen";
    closeFullscreenBtn.style.zIndex = "999999";
    closeFullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    document.body.appendChild(closeFullscreenBtn);
  }

  toggleFullscreen() {
    const container = document.getElementById(this.containerId);
    const fullscreenBtn = container.querySelector("#fullscreen-btn");
    const closeFullscreenBtn = document.getElementById("close-fullscreen-btn");
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      fullscreenBtn.classList.add("hidden");
      closeFullscreenBtn.classList.remove("hidden");
      container.classList.add("fixed", "inset-0", "z-[9998]", "bg-white");
      applyStyles(container, {
        position: "fixed",
        inset: "0",
        zIndex: "9998",
        width: "100vw",
        height: "100vh",
        borderRadius: "0",
        overflow: "hidden",
        background: "#fff",
      });
    } else {
      fullscreenBtn.classList.remove("hidden");
      closeFullscreenBtn.classList.add("hidden");
      container.classList.remove("fixed", "inset-0", "z-[9998]", "bg-white");
      applyStyles(container, {
        position: "relative",
        width: "100%",
        height: `${this._calcTotalHeight()}px`,
        borderRadius: "8px",
        overflow: "hidden",
        zIndex: "1",
      });
    }

    this._updateContainerLayout();
    requestAnimationFrame(() => this.resizeCharts());
  }

  _observeResize(container) {
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() =>
      requestAnimationFrame(() => this.resizeCharts())
    );
    this.resizeObserver.observe(container);
  }

  /* ---------------------------- SYNC ---------------------------- */

  _getVisible(chart, logical) {
    try {
      return logical
        ? chart.timeScale().getVisibleLogicalRange()
        : chart.timeScale().getVisibleRange();
    } catch {
      return null;
    }
  }

  _applyVisible(chart, range, logical) {
    if (!range) return;
    try {
      logical
        ? chart.timeScale().setVisibleLogicalRange(range)
        : chart.timeScale().setVisibleRange(range);
    } catch {
      /* ignore */
    }
  }

  _doSync(source, { range, logical }) {
    if (!range) return;

    // Source -> others
    if (source === "main") {
      Object.values(this.subCharts).forEach(({ chart }) =>
        this._applyVisible(chart, range, logical)
      );
    } else {
      // sub -> main + other subs
      if (this.chart) this._applyVisible(this.chart, range, logical);
      Object.entries(this.subCharts).forEach(([k, { chart }]) => {
        if (k !== source) this._applyVisible(chart, range, logical);
      });
    }
  }

  _syncCrosshair(param) {
    if (!param.time && param.logical === undefined) return;
    Object.values(this.subCharts).forEach(({ chart }) => {
      try {
        if (param.time) {
          chart.setCrosshairPosition(
            param.point?.x || 0,
            param.time,
            param.seriesData
          );
        } else if (param.logical !== undefined) {
          chart.timeScale().scrollToPosition(param.logical, false);
        }
      } catch {
        /* ignore */
      }
    });
  }

  /* ---------------------------- LAYOUT ---------------------------- */

  _subActiveCount() {
    return ["rsi", "macd", "stoch", "stochrsi"].filter((t) =>
      this.activeIndicators.has(t)
    ).length;
  }

  _mainHeight() {
    const subH = this._subActiveCount() * 120;
    return this.isFullscreen
      ? Math.min(window.innerHeight - subH - 100, 600) // Adjusted height to fit viewport
      : 500 - Math.min(subH, 200);
  }

  _calcTotalHeight() {
    return this.isFullscreen
      ? Math.min(window.innerHeight - 20, 600) // Adjusted height to fit viewport
      : 500 + this._subActiveCount() * 120;
  }

  _updateContainerLayout() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    applyStyles(container, { height: `${this._calcTotalHeight()}px` });
    const main = container.querySelector("#main-chart");
    if (main) applyStyles(main, { height: `${this._mainHeight()}px` });
  }

  resizeCharts() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    const w = container.clientWidth;

    if (this.chart)
      this.chart.applyOptions({ width: w, height: this._mainHeight() });
    Object.values(this.subCharts).forEach(({ chart, config }) =>
      chart.applyOptions({ width: w, height: config.height })
    );
  }

  /* ---------------------------- INDICATORS ---------------------------- */

  toggleIndicator(type) {
    if (!this.isInitialized) return;
    const isActive = this.activeIndicators.has(type);

    if (isActive) {
      this.activeIndicators.delete(type);
      this._removeIndicator(type);
    } else {
      this.activeIndicators.add(type);
      this._addIndicator(type);
    }

    this._updateContainerLayout();

    // Update data + sync + values
    setTimeout(() => {
      this.updateIndicatorData();
      this.resizeCharts();
      setTimeout(
        () =>
          this._sync("main", {
            range: this._getVisible(this.chart, false),
            logical: false,
          }),
        80
      );
      setTimeout(() => this.updateIndicatorValuesDisplay(), 120);
    }, 40);
  }

  _addIndicator(type) {
    if (!this.series[type]) this.series[type] = {};

    const addLine = (targetChart, key, color, lineWidth = 2, style = 0) =>
      (this.series[type][key] = targetChart.addLineSeries({
        color,
        lineWidth,
        lineStyle: style,
        priceScaleId: "right",
        title: key,
      }));

    const addHistogram = (targetChart, key, color) =>
      (this.series[type][key] = targetChart.addHistogramSeries({
        color,
        title: key,
        priceFormat: { type: "volume", precision: 2 },
      }));

    const showSub = (key) => {
      const sub = this.subCharts[key];
      if (!sub) return;
      const el = sub.container;
      el.style.display = "block";
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      requestAnimationFrame(() => {
        el.style.transition = "all .3s cubic-bezier(.4,0,.2,1)";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    };

    switch (type) {
      case "sma":
        addLine(this.chart, "sma20", THEME.colors.sma20, 2);
        addLine(this.chart, "sma50", THEME.colors.sma50, 2);
        break;
      case "ema":
        addLine(this.chart, "ema20", THEME.colors.ema20, 2);
        addLine(this.chart, "ema50", THEME.colors.ema50, 2);
        break;
      case "bb":
        addLine(this.chart, "bbUpper", THEME.colors.bb, 1, 2);
        addLine(this.chart, "bbLower", THEME.colors.bb, 1, 2);
        break;
      case "psar":
        this.series[type].psar = this.chart.addLineSeries({
          color: THEME.colors.psar,
          lineWidth: 0,
          pointMarkersVisible: true,
          lineVisible: false,
          pointMarkersRadius: 2,
          title: "PSAR",
          priceScaleId: "right",
        });
        break;
      case "rsi":
        showSub("rsi");
        addLine(this.subCharts.rsi.chart, "rsi", THEME.colors.rsi, 2);
        addLine(this.subCharts.rsi.chart, "rsi70", "#ef4444", 1, 2);
        addLine(this.subCharts.rsi.chart, "rsi30", "#22c55e", 1, 2);
        break;
      case "macd":
        showSub("macd");
        addLine(this.subCharts.macd.chart, "macd", THEME.colors.macd, 2);
        addLine(
          this.subCharts.macd.chart,
          "macdSignal",
          THEME.colors.macdSignal,
          2
        );
        addHistogram(
          this.subCharts.macd.chart,
          "macdHist",
          THEME.colors.macdHist
        );
        break;
      case "stoch":
        showSub("stoch");
        addLine(this.subCharts.stoch.chart, "stochK", THEME.colors.stochK, 2);
        addLine(this.subCharts.stoch.chart, "stochD", THEME.colors.stochD, 2);
        addLine(this.subCharts.stoch.chart, "stoch80", "#ef4444", 1, 2);
        addLine(this.subCharts.stoch.chart, "stoch20", "#22c55e", 1, 2);
        break;
      case "stochrsi":
        showSub("stochrsi");
        addLine(
          this.subCharts.stochrsi.chart,
          "stochRsiK",
          THEME.colors.stochRsiK,
          2
        );
        addLine(
          this.subCharts.stochrsi.chart,
          "stochRsiD",
          THEME.colors.stochRsiD,
          2
        );
        addLine(this.subCharts.stochrsi.chart, "stochRsi80", "#ef4444", 1, 2);
        addLine(this.subCharts.stochrsi.chart, "stochRsi20", "#22c55e", 1, 2);
        break;
    }
  }

  _removeIndicator(type) {
    // Remove series
    if (this.series[type]) {
      Object.values(this.series[type]).forEach((s) => {
        try {
          // tentukan chart pemilik series
          const chart = ["rsi", "macd", "stoch", "stochrsi"].includes(type)
            ? this.subCharts[type]?.chart
            : this.chart;
          chart?.removeSeries(s);
        } catch {
          /* ignore */
        }
      });
      delete this.series[type];
    }

    // Hide sub-panel (if any)
    if (this.subCharts[type]) {
      const el = this.subCharts[type].container;
      el.style.transition = "all .2s ease-in";
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      setTimeout(() => {
        el.style.display = "none";
        el.style.transform = "translateY(0)";
      }, 200);
    }
  }

  /* ---------------------------- DATA ---------------------------- */

  updateData(candleData) {
    if (!this.isInitialized || !Array.isArray(candleData)) return;

    // Sanitize + sort
    this.currentData = candleData
      .filter(
        (d) =>
          d &&
          typeof d.time !== "undefined" &&
          ["open", "high", "low", "close"].every(
            (k) => typeof d[k] === "number"
          )
      )
      .map((d) => ({
        time: seconds(d.time),
        open: +d.open,
        high: +d.high,
        low: +d.low,
        close: +d.close,
        indicators: d.indicators || {},
      }))
      .sort((a, b) => a.time - b.time);

    // Candles
    this.candleSeries.setData(
      this.currentData.map(({ time, open, high, low, close }) => ({
        time,
        open,
        high,
        low,
        close,
      }))
    );

    // Extract latest values for cards
    this._extractLatest();

    // Initial view (last 300)
    setTimeout(() => {
      const total = this.currentData.length;
      if (!total) return;
      if (total > 300) {
        this.chart.timeScale().setVisibleRange({
          from: this.currentData[total - 300].time,
          to: this.currentData[total - 1].time,
        });
      } else {
        this.chart.timeScale().fitContent();
      }
    }, 60);

    // Indicators data
    setTimeout(() => {
      this.updateIndicatorData();
      setTimeout(() => {
        this._sync("main", {
          range: this._getVisible(this.chart, false),
          logical: false,
        });
        this.updateIndicatorValuesDisplay();
      }, 60);
    }, 80);

    // Hide loading overlay (jika ada)
    requestAnimationFrame(() => {
      const el = document.querySelector(".chart-loading");
      if (el) el.style.display = "none";
    });

    console.log(`✅ Chart updated with ${this.currentData.length} points`);
  }

  _extractLatest() {
    if (!this.currentData.length) return;
    const last = this.currentData[this.currentData.length - 1];
    const ind = last.indicators || {};

    this.latestValues = {
      // MA
      sma20: ind.sma?.[20],
      sma50: ind.sma?.[50],
      ema20: ind.ema?.[20],
      ema50: ind.ema?.[50],
      // RSI
      rsi: ind.rsi?.[14],
      // MACD
      macd: ind.macd?.macd,
      macdSignal: ind.macd?.signalLine,
      macdHist: ind.macd?.histogram,
      macdFast: ind.macd?.fast,
      macdSlow: ind.macd?.slow,
      macdSignalPeriod: ind.macd?.signal,
      // BB
      bbUpper: ind.bollingerBands?.upper,
      bbLower: ind.bollingerBands?.lower,
      bbPeriod: ind.bollingerBands?.period,
      bbMultiplier: ind.bollingerBands?.multiplier,
      // Stoch
      stochK: ind.stochastic?.["%K"],
      stochD: ind.stochastic?.["%D"],
      stochKPeriod: ind.stochastic?.kPeriod,
      stochDPeriod: ind.stochastic?.dPeriod,
      // StochRSI
      stochRsiK: ind.stochasticRsi?.["%K"],
      stochRsiD: ind.stochasticRsi?.["%D"],
      stochRsiRsiPeriod: ind.stochasticRsi?.rsiPeriod,
      stochRsiStochPeriod: ind.stochasticRsi?.stochPeriod,
      stochRsiKPeriod: ind.stochasticRsi?.kPeriod,
      stochRsiDPeriod: ind.stochasticRsi?.dPeriod,
      // PSAR
      psar: ind.parabolicSar?.value,
      psarStep: ind.parabolicSar?.step,
      psarMaxStep: ind.parabolicSar?.maxStep,
      timestamp: last.time,
    };
  }

  updateIndicatorData() {
    const dataFor = (type) => {
      const res = {};
      this.currentData.forEach(({ time, indicators }) => {
        const ind = indicators || {};
        switch (type) {
          case "sma":
            if (ind.sma?.[20] != null)
              (res.sma20 ||= []).push({ time, value: ind.sma[20] });
            if (ind.sma?.[50] != null)
              (res.sma50 ||= []).push({ time, value: ind.sma[50] });
            break;
          case "ema":
            if (ind.ema?.[20] != null)
              (res.ema20 ||= []).push({ time, value: ind.ema[20] });
            if (ind.ema?.[50] != null)
              (res.ema50 ||= []).push({ time, value: ind.ema[50] });
            break;
          case "bb":
            if (ind.bollingerBands?.upper != null)
              (res.bbUpper ||= []).push({
                time,
                value: ind.bollingerBands.upper,
              });
            if (ind.bollingerBands?.lower != null)
              (res.bbLower ||= []).push({
                time,
                value: ind.bollingerBands.lower,
              });
            break;
          case "psar":
            if (ind.parabolicSar?.value != null)
              (res.psar ||= []).push({ time, value: ind.parabolicSar.value });
            break;
          case "rsi":
            if (ind.rsi?.[14] != null)
              (res.rsi ||= []).push({ time, value: ind.rsi[14] });
            break;
          case "macd":
            if (ind.macd?.macd != null)
              (res.macd ||= []).push({ time, value: ind.macd.macd });
            if (ind.macd?.signalLine != null)
              (res.macdSignal ||= []).push({
                time,
                value: ind.macd.signalLine,
              });
            if (ind.macd?.histogram != null)
              (res.macdHist ||= []).push({ time, value: ind.macd.histogram });
            break;
          case "stoch":
            if (ind.stochastic?.["%K"] != null)
              (res.stochK ||= []).push({ time, value: ind.stochastic["%K"] });
            if (ind.stochastic?.["%D"] != null)
              (res.stochD ||= []).push({ time, value: ind.stochastic["%D"] });
            break;
          case "stochrsi":
            if (ind.stochasticRsi?.["%K"] != null)
              (res.stochRsiK ||= []).push({
                time,
                value: ind.stochasticRsi["%K"],
              });
            if (ind.stochasticRsi?.["%D"] != null)
              (res.stochRsiD ||= []).push({
                time,
                value: ind.stochasticRsi["%D"],
              });
            break;
        }
      });
      return res;
    };

    this.activeIndicators.forEach((type) => {
      const data = dataFor(type);
      const seriesGroup = this.series[type];
      if (!seriesGroup) return;

      Object.entries(seriesGroup).forEach(([key, s]) => {
        if (data[key]?.length) {
          s.setData(data[key]);
          return;
        }
        // Reference lines (70/30/80/20)
        const ref = key.match(/\d+$/);
        if (ref) {
          const v = parseInt(ref[0], 10);
          s.setData(this.currentData.map((d) => ({ time: d.time, value: v })));
        }
      });
    });
  }

  /* ---------------------------- VALUES PANEL ---------------------------- */

  updateIndicatorValuesDisplay() {
    if (!Object.keys(this.latestValues).length) return;
    const v = this.latestValues;
    const fmt = (x, d = 2) =>
      x == null || isNaN(x) ? "–" : typeof x === "number" ? x.toFixed(d) : x;

    const set = (sel, val, prefix = "", d = 2, animate = true) => {
      const el = document.querySelector(sel);
      if (!el || val == null) return;
      el.textContent = prefix ? `${prefix}${fmt(val, d)}` : fmt(val, d);
      if (!animate) return;
      el.style.transform = "scale(1.05)";
      el.style.transition = "transform .15s ease-out";
      el.style.backgroundColor = "rgba(59,130,246,.1)";
      setTimeout(() => {
        el.style.transform = "scale(1)";
        el.style.backgroundColor = "";
      }, 150);
    };

    // Timestamp
    const ts = document.querySelector("[data-last-update]");
    if (ts && v.timestamp)
      ts.textContent = new Date(v.timestamp * 1000).toLocaleTimeString();

    // MA
    set("[data-sma20]", v.sma20, "$");
    set("[data-sma50]", v.sma50, "$");
    set("[data-ema20]", v.ema20, "$");
    set("[data-ema50]", v.ema50, "$");

    // RSI + badge
    set("[data-rsi]", v.rsi, "", 2);
    const badge = document.querySelector("[data-rsi-status]");
    if (badge && v.rsi != null) {
      let txt = "Neutral",
        cls = "bg-gray-100 text-gray-700 border border-gray-200",
        dot = "bg-gray-400";
      if (v.rsi > 70)
        (txt = "Overbought"),
          (cls = "bg-red-100 text-red-700 border border-red-200"),
          (dot = "bg-red-400");
      else if (v.rsi < 30)
        (txt = "Oversold"),
          (cls = "bg-green-100 text-green-700 border border-green-200"),
          (dot = "bg-green-400");
      badge.innerHTML = `<div class="w-2 h-2 rounded-full mr-2 ${dot}"></div>${txt}`;
      badge.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cls}`;
    }

    // MACD
    set("[data-macd]", v.macd, "", 3);
    set("[data-macd-signal]", v.macdSignal, "", 3);
    const histEl = document.querySelector("[data-macd-hist]");
    if (histEl && v.macdHist != null) {
      histEl.textContent = fmt(v.macdHist, 3);
      histEl.className =
        v.macdHist >= 0
          ? "font-mono font-bold text-green-700 text-sm"
          : "font-mono font-bold text-red-700 text-sm";
    }
    set("[data-macd-fast]", v.macdFast, "", 0, false);
    set("[data-macd-slow]", v.macdSlow, "", 0, false);
    set("[data-macd-signal-period]", v.macdSignalPeriod, "", 0, false);

    // BB
    set("[data-bb-upper]", v.bbUpper, "$");
    set("[data-bb-lower]", v.bbLower, "$");
    set("[data-bb-period]", v.bbPeriod, "", 0, false);
    set("[data-bb-multiplier]", v.bbMultiplier, "", 0, false);

    // Stoch
    set("[data-stoch-k]", v.stochK, "", 2);
    set("[data-stoch-d]", v.stochD, "", 2);
    set("[data-stoch-k-period]", v.stochKPeriod, "", 0, false);
    set("[data-stoch-d-period]", v.stochDPeriod, "", 0, false);

    // StochRSI
    set("[data-stochrsi-k]", v.stochRsiK, "", 2);
    set("[data-stochrsi-d]", v.stochRsiD, "", 2);
    set("[data-stochrsi-rsi-period]", v.stochRsiRsiPeriod, "", 0, false);
    set("[data-stochrsi-stoch-period]", v.stochRsiStochPeriod, "", 0, false);
    set("[data-stochrsi-k-period]", v.stochRsiKPeriod, "", 0, false);
    set("[data-stochrsi-d-period]", v.stochRsiDPeriod, "", 0, false);

    // PSAR
    set("[data-psar]", v.psar, "$");
    set("[data-psar-step]", v.psarStep, "", 0, false);
    set("[data-psar-max-step]", v.psarMaxStep, "", 0, false);
    const psarBadge = document.querySelector("[data-psar-trend]");
    if (psarBadge) {
      psarBadge.textContent = "Active Signal";
      psarBadge.className =
        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700";
    }
  }

  /* ---------------------------- DESTROY ---------------------------- */

  destroy() {
    try {
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = null;

      if (this.chart) {
        this.chart.remove();
        this.chart = null;
        this.candleSeries = null;
      }
      Object.values(this.subCharts).forEach(({ chart }) => chart?.remove());
      this.subCharts = {};
      this.series = {};
      this.activeIndicators.clear();
      this.currentData = [];
      this.latestValues = {};
      this.isInitialized = false;
      this.isFullscreen = false;
      console.log("🗑️ Chart destroyed cleanly");
    } catch (e) {
      console.warn("⚠️ Destroy error ignored:", e);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const chart = new CandlestickChart("candlestick-chart");
  chart.init();
});
