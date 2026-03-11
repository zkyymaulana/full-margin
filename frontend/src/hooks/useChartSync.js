import { useRef, useCallback } from "react";

/**
 * 🎯 TradingView Lightweight Charts Synchronization Hook
 * Synchronizes time range (pan/zoom) and crosshair across multiple charts
 *
 * Features:
 * ✅ Pan/Zoom sync (main chart → indicator charts)
 * ✅ Crosshair sync (bidirectional)
 * ✅ Timestamp tooltip on hover
 * ✅ Prevents circular sync loops
 */
export const useChartSync = () => {
  // ✅ Simpan referensi chart mana yang sedang jadi "source" sync
  // null = tidak ada sync berjalan
  const syncSourceRef = useRef(null);
  const crosshairSyncRef = useRef(false);
  const crosshairUnsubscribersRef = useRef({});
  const dataRangeRef = useRef(null);
  const allCandlesDataRef = useRef([]);
  const currentVisibleRangeRef = useRef(null);

  // 🔧 Format timestamp untuk tooltip
  const formatTimestamp = useCallback((time) => {
    if (!time) return "";

    const date = new Date(time * 1000);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, []);

  // 🎯 Crosshair sync
  const syncCrosshair = useCallback((sourceChart, targetCharts, param) => {
    if (crosshairSyncRef.current) return;
    crosshairSyncRef.current = true;

    try {
      targetCharts.forEach((chart) => {
        if (!chart || chart === sourceChart) return;
        try {
          if (param && param.time !== undefined && param.point) {
            // Use setCrosshairPosition with first available series
            const allSeries = chart.series ? chart.series() : [];
            if (allSeries.length > 0) {
              const priceEntry =
                param.seriesData && param.seriesData.size > 0
                  ? Array.from(param.seriesData.values())[0]
                  : null;
              const price =
                priceEntry?.value ??
                priceEntry?.close ??
                priceEntry?.open ??
                null;
              if (price !== null) {
                chart.setCrosshairPosition(price, param.time, allSeries[0]);
              }
            }
          } else {
            chart.clearCrosshairPosition();
          }
        } catch (e) {
          // ignore disposed chart errors
        }
      });
    } finally {
      crosshairSyncRef.current = false;
    }
  }, []);

  // 🎯 Setup crosshair sync + timestamp tooltip
  const setupCrosshairSync = useCallback(
    (chart, allCharts, chartType) => {
      if (!chart) return null;

      const handleCrosshairMove = (param) => {
        syncCrosshair(chart, allCharts, param);

        const chartElement = chart.chartElement();
        if (!chartElement) return;

        let tooltip = chartElement.querySelector(".chart-timestamp-tooltip");

        if (param && param.time !== undefined) {
          const timestamp = formatTimestamp(param.time);

          if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.className = "chart-timestamp-tooltip";
            tooltip.style.cssText = `
              position: absolute;
              top: 10px;
              left: 10px;
              background: rgba(0, 0, 0, 0.85);
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 11px;
              font-family: 'Inter', -apple-system, sans-serif;
              font-weight: 500;
              pointer-events: none;
              z-index: 1000;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            chartElement.style.position = "relative";
            chartElement.appendChild(tooltip);
          }

          tooltip.textContent = timestamp;
          tooltip.style.display = "block";
          tooltip.style.opacity = "1";
        } else {
          if (tooltip) {
            tooltip.style.opacity = "0";
            setTimeout(() => {
              if (tooltip) tooltip.style.display = "none";
            }, 150);
          }
        }
      };

      const unsubscribe = chart.subscribeCrosshairMove(handleCrosshairMove);
      crosshairUnsubscribersRef.current[chartType] = unsubscribe;

      return () => {
        if (unsubscribe) unsubscribe();
        delete crosshairUnsubscribersRef.current[chartType];

        const chartElement = chart.chartElement?.();
        if (chartElement) {
          const tooltip = chartElement.querySelector(
            ".chart-timestamp-tooltip"
          );
          if (tooltip) tooltip.remove();
        }
      };
    },
    [syncCrosshair, formatTimestamp]
  );

  // 🎯 Setup full chart sync (range + crosshair)
  const setupChartSync = useCallback(
    (chart, allCharts, chartType = "unknown") => {
      if (!chart) return null;

      console.log(`[ChartSync] Setting up sync for "${chartType}" chart`);

      const timeScale = chart.timeScale();
      const otherCharts = allCharts.filter((c) => c !== chart);
      let isDisposed = false;

      // ✅ Subscribe to logical range — use requestAnimationFrame to batch rapid events
      const unsubscribeLogicalRange =
        timeScale.subscribeVisibleLogicalRangeChange(() => {
          if (isDisposed) return;

          // ✅ Jika ada chart lain yang sedang jadi source, abaikan event ini
          // (ini adalah event "balik" yang terpicu dari setVisibleLogicalRange)
          if (
            syncSourceRef.current !== null &&
            syncSourceRef.current !== chart
          ) {
            return;
          }

          // ✅ Tandai chart ini sebagai source
          syncSourceRef.current = chart;

          try {
            const visibleLogicalRange = timeScale.getVisibleLogicalRange();
            if (!visibleLogicalRange) return;

            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) currentVisibleRangeRef.current = visibleRange;

            // ✅ Langsung sync — TANPA requestAnimationFrame
            // RAF menyebabkan delay yang memungkinkan event balik lolos
            otherCharts.forEach((target) => {
              if (!target || typeof target.timeScale !== "function") return;
              try {
                target.timeScale().setVisibleLogicalRange(visibleLogicalRange);
              } catch (e) {
                if (!e.message?.includes("disposed")) {
                  console.warn("[ChartSync] sync error:", e.message);
                }
              }
            });
          } finally {
            // ✅ Reset source setelah semua target selesai di-set
            syncSourceRef.current = null;
          }
        });

      const unsubscribeCrosshair = setupCrosshairSync(
        chart,
        allCharts,
        chartType
      );

      return () => {
        console.log(`[ChartSync] Cleaning up sync for "${chartType}" chart`);
        isDisposed = true;
        // Pastikan flag source bersih jika chart ini adalah source saat di-cleanup
        if (syncSourceRef.current === chart) syncSourceRef.current = null;

        try {
          unsubscribeLogicalRange?.();
        } catch (e) {
          /* disposed */
        }
        try {
          unsubscribeCrosshair?.();
        } catch (e) {
          /* disposed */
        }
      };
    },
    [setupCrosshairSync]
  );

  return {
    setupChartSync,
    setupCrosshairSync,
    dataRangeRef,
    allCandlesDataRef,
    currentVisibleRangeRef, // 🆕 Add to return for backward compatibility
  };
};
