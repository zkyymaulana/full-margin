import { useRef, useCallback } from "react";

/**
 * Custom hook for synchronizing multiple Lightweight Charts
 * Handles zoom, pan, and scroll synchronization across all charts
 */
export const useChartSync = () => {
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const syncDebounceRef = useRef(null);
  const currentVisibleRangeRef = useRef(null);
  const dataRangeRef = useRef(null);

  // Limit visible range to prevent empty space
  const limitVisibleRange = useCallback((range) => {
    if (!dataRangeRef.current || !range) return range;

    const { from, to } = range;
    const { minTime, maxTime } = dataRangeRef.current;
    const visibleDuration = to - from;
    const maxAllowedTo = maxTime + visibleDuration * 0.05;

    if (to > maxAllowedTo) {
      const adjustedTo = maxAllowedTo;
      const adjustedFrom = adjustedTo - visibleDuration;

      if (adjustedFrom < minTime) {
        return { from: minTime, to: minTime + visibleDuration };
      }

      return { from: adjustedFrom, to: adjustedTo };
    }

    if (from < minTime) {
      return { from: minTime, to: minTime + visibleDuration };
    }

    return range;
  }, []);

  // Main sync function
  const syncAllCharts = useCallback(
    (allCharts, sourceChart = null, immediate = false) => {
      if (isSyncingRef.current || allCharts.length <= 1) return;

      const masterChart = sourceChart || allCharts[0];
      if (!masterChart) return;

      const masterTimeScale = masterChart.timeScale();
      let visibleRange = masterTimeScale.getVisibleRange();

      if (!visibleRange) return;

      visibleRange = limitVisibleRange(visibleRange);
      currentVisibleRangeRef.current = visibleRange;
      isSyncingRef.current = true;

      try {
        allCharts.forEach((chart) => {
          if (chart !== masterChart) {
            try {
              const targetTimeScale = chart.timeScale();
              targetTimeScale.applyOptions({
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                fixLeftEdge: false,
                fixRightEdge: false,
              });
              targetTimeScale.setVisibleRange(visibleRange);
            } catch (e) {
              console.warn("Sync error for individual chart:", e);
            }
          }
        });
      } catch (error) {
        console.warn("General sync error:", error);
      }

      if (immediate) {
        isSyncingRef.current = false;
      } else {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          isSyncingRef.current = false;
        }, 50);
      }
    },
    [limitVisibleRange]
  );

  // Setup sync for a single chart
  const setupChartSync = useCallback(
    (chart, allCharts, chartType = "unknown") => {
      if (!chart) return;

      console.log(`Setting up sync for ${chartType} chart`);

      const timeScale = chart.timeScale();

      timeScale.applyOptions({
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        fixLeftEdge: false,
        fixRightEdge: false,
      });

      const handleVisibleTimeRangeChange = () => {
        if (syncDebounceRef.current) {
          clearTimeout(syncDebounceRef.current);
        }

        syncDebounceRef.current = setTimeout(() => {
          requestAnimationFrame(() => {
            syncAllCharts(allCharts, chart, false);
          });
        }, 10);
      };

      const unsubscribeTimeRange = timeScale.subscribeVisibleTimeRangeChange(
        handleVisibleTimeRangeChange
      );

      const handleWheel = () => {
        requestAnimationFrame(() => {
          syncAllCharts(allCharts, chart, true);
        });
      };

      const handleMouseDown = () => {
        requestAnimationFrame(() => {
          syncAllCharts(allCharts, chart, true);
        });
      };

      const handleMouseMove = (event) => {
        if (event.buttons === 1) {
          requestAnimationFrame(() => {
            syncAllCharts(allCharts, chart, false);
          });
        }
      };

      const handleMouseUp = () => {
        requestAnimationFrame(() => {
          syncAllCharts(allCharts, chart, true);
        });
      };

      const chartElement = chart.chartElement();
      if (chartElement) {
        chartElement.addEventListener("wheel", handleWheel, { passive: true });
        chartElement.addEventListener("mousedown", handleMouseDown);
        chartElement.addEventListener("mousemove", handleMouseMove);
        chartElement.addEventListener("mouseup", handleMouseUp);
      }

      return () => {
        console.log(`Cleaning up sync for ${chartType} chart`);

        if (unsubscribeTimeRange) {
          unsubscribeTimeRange();
        }

        if (chartElement) {
          chartElement.removeEventListener("wheel", handleWheel);
          chartElement.removeEventListener("mousedown", handleMouseDown);
          chartElement.removeEventListener("mousemove", handleMouseMove);
          chartElement.removeEventListener("mouseup", handleMouseUp);
        }

        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        if (syncDebounceRef.current) {
          clearTimeout(syncDebounceRef.current);
        }
      };
    },
    [syncAllCharts]
  );

  return {
    syncAllCharts,
    setupChartSync,
    currentVisibleRangeRef,
    dataRangeRef,
  };
};
