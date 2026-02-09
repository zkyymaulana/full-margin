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
  const isSyncingRef = useRef(false);
  const crosshairSyncRef = useRef(false);
  const crosshairUnsubscribersRef = useRef({});
  const dataRangeRef = useRef(null);
  const allCandlesDataRef = useRef([]);
  // 🆕 Add missing ref for backward compatibility
  const currentVisibleRangeRef = useRef(null);

  // 🔧 Format timestamp for tooltip
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

  // 🎯 Main sync function: synchronize visible time range
  const syncVisibleRange = useCallback((sourceChart, targetCharts) => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    try {
      // ✅ Check if source chart is still valid
      if (!sourceChart) {
        isSyncingRef.current = false;
        return;
      }

      const sourceTimeScale = sourceChart.timeScale();
      const visibleLogicalRange = sourceTimeScale.getVisibleLogicalRange();

      if (!visibleLogicalRange) {
        isSyncingRef.current = false;
        return;
      }

      // 🆕 Store current visible range for backward compatibility
      const visibleRange = sourceTimeScale.getVisibleRange();
      if (visibleRange) {
        currentVisibleRangeRef.current = visibleRange;
      }

      // 🔧 Debug log
      console.log(
        `[ChartSync] Syncing range to ${targetCharts.length} target charts`,
        visibleLogicalRange
      );

      // Apply to all target charts (already filtered, no need to check again)
      targetCharts.forEach((chart, index) => {
        // ✅ Validate chart exists and has timeScale method
        if (chart && typeof chart.timeScale === "function") {
          try {
            const targetTimeScale = chart.timeScale();
            // ✅ Check if setVisibleLogicalRange method exists
            if (typeof targetTimeScale.setVisibleLogicalRange === "function") {
              targetTimeScale.setVisibleLogicalRange(visibleLogicalRange);
              console.log(`[ChartSync] ✅ Synced chart ${index + 1}`);
            }
          } catch (error) {
            // ⚠️ Chart might be disposed, just warn and continue
            if (error.message.includes("disposed")) {
              console.warn(
                `[ChartSync] Chart ${index + 1} is disposed, skipping`
              );
            } else {
              console.warn(
                `[ChartSync] ❌ Failed to sync chart ${index + 1}:`,
                error.message
              );
            }
          }
        }
      });
    } catch (error) {
      // ⚠️ Source chart might be disposed
      if (error.message.includes("disposed")) {
        console.warn("[ChartSync] Source chart is disposed, stopping sync");
      } else {
        console.error("[ChartSync] Sync error:", error);
      }
    } finally {
      // Reset flag after a short delay to prevent rapid re-sync
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }
  }, []);

  // 🎯 Crosshair sync function
  const syncCrosshair = useCallback((sourceChart, targetCharts, param) => {
    if (crosshairSyncRef.current) return;

    crosshairSyncRef.current = true;

    try {
      targetCharts.forEach((chart) => {
        if (chart && chart !== sourceChart) {
          if (param && param.time !== undefined) {
            // Get price value from the first series
            const series = chart.series();
            if (series.length > 0) {
              const price =
                param.seriesData.size > 0
                  ? Array.from(param.seriesData.values())[0]?.value
                  : undefined;

              if (price !== undefined) {
                chart.setCrosshairPosition(price, param.time, series[0]);
              }
            }
          } else {
            // Clear crosshair
            chart.clearCrosshairPosition();
          }
        }
      });
    } catch (error) {
      console.warn("[ChartSync] Crosshair sync error:", error);
    } finally {
      crosshairSyncRef.current = false;
    }
  }, []);

  // 🎯 Setup crosshair sync with timestamp tooltip
  const setupCrosshairSync = useCallback(
    (chart, allCharts, chartType) => {
      if (!chart) return null;

      const handleCrosshairMove = (param) => {
        // Sync crosshair to other charts
        syncCrosshair(chart, allCharts, param);

        // Add/update timestamp tooltip
        const chartElement = chart.chartElement();
        if (!chartElement) return;

        let tooltip = chartElement.querySelector(".chart-timestamp-tooltip");

        if (param && param.time !== undefined) {
          const timestamp = formatTimestamp(param.time);

          // Create tooltip if doesn't exist
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
          // Hide tooltip when crosshair leaves
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
        if (unsubscribe) {
          unsubscribe();
        }
        delete crosshairUnsubscribersRef.current[chartType];

        // Remove tooltip
        const chartElement = chart.chartElement();
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

  // 🎯 Setup chart synchronization (main function)
  const setupChartSync = useCallback(
    (chart, allCharts, chartType = "unknown") => {
      if (!chart) return null;

      console.log(`[ChartSync] Setting up sync for "${chartType}" chart`);

      const timeScale = chart.timeScale();
      const otherCharts = allCharts.filter((c) => c !== chart);

      // 🆕 Track if chart is disposed
      let isDisposed = false;

      // Subscribe to logical range changes (better than visible range for sync)
      const unsubscribeLogicalRange =
        timeScale.subscribeVisibleLogicalRangeChange(() => {
          if (!isSyncingRef.current && !isDisposed) {
            requestAnimationFrame(() => {
              // ✅ Check again before syncing (chart might be disposed during RAF)
              if (!isDisposed) {
                syncVisibleRange(chart, otherCharts);
              }
            });
          }
        });

      // Setup crosshair sync
      const unsubscribeCrosshair = setupCrosshairSync(
        chart,
        allCharts,
        chartType
      );

      // Cleanup function
      return () => {
        console.log(`[ChartSync] Cleaning up sync for "${chartType}" chart`);

        // ✅ Set disposed flag FIRST to stop any pending RAF callbacks
        isDisposed = true;

        // ✅ Unsubscribe from events BEFORE chart is removed
        if (unsubscribeLogicalRange) {
          try {
            unsubscribeLogicalRange();
          } catch (error) {
            console.warn(
              `[ChartSync] Error unsubscribing logical range:`,
              error.message
            );
          }
        }

        if (unsubscribeCrosshair) {
          try {
            unsubscribeCrosshair();
          } catch (error) {
            console.warn(
              `[ChartSync] Error unsubscribing crosshair:`,
              error.message
            );
          }
        }
      };
    },
    [syncVisibleRange, setupCrosshairSync]
  );

  return {
    setupChartSync,
    setupCrosshairSync,
    syncVisibleRange,
    dataRangeRef,
    allCandlesDataRef,
    currentVisibleRangeRef, // 🆕 Add to return for backward compatibility
  };
};
