import { useRef, useCallback } from "react";

// Hook sinkronisasi antar chart (pan/zoom + crosshair + tooltip waktu).
export const useChartSync = () => {
  // Simpan chart yang sedang menjadi sumber sinkronisasi.
  // Nilai null berarti tidak ada proses sinkronisasi aktif.
  const syncSourceRef = useRef(null);
  const crosshairSyncRef = useRef(false);
  const crosshairUnsubscribersRef = useRef({});
  const dataRangeRef = useRef(null);
  const allCandlesDataRef = useRef([]);
  const currentVisibleRangeRef = useRef(null);

  // Format timestamp agar tooltip mudah dibaca user Indonesia.
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

  // Sinkronkan posisi crosshair dari chart sumber ke chart target.
  const syncCrosshair = useCallback((sourceChart, targetCharts, param) => {
    if (crosshairSyncRef.current) return;
    crosshairSyncRef.current = true;

    try {
      targetCharts.forEach((chart) => {
        if (!chart || chart === sourceChart) return;
        try {
          if (param && param.time !== undefined && param.point) {
            // Ambil series pertama sebagai referensi posisi crosshair.
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
          // Abaikan error chart yang sudah dispose.
        }
      });
    } finally {
      crosshairSyncRef.current = false;
    }
  }, []);

  // Pasang listener crosshair dan tooltip timestamp untuk satu chart.
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
            ".chart-timestamp-tooltip",
          );
          if (tooltip) tooltip.remove();
        }
      };
    },
    [syncCrosshair, formatTimestamp],
  );

  // Pasang sinkronisasi lengkap: visible range dan crosshair.
  const setupChartSync = useCallback(
    (chart, allCharts, chartType = "unknown") => {
      if (!chart) return null;

      console.log(`[ChartSync] Setting up sync for "${chartType}" chart`);

      const timeScale = chart.timeScale();
      const otherCharts = allCharts.filter((c) => c !== chart);
      let isDisposed = false;

      // Subscribe perubahan logical range lalu dorong ke chart lain.
      const unsubscribeLogicalRange =
        timeScale.subscribeVisibleLogicalRangeChange(() => {
          if (isDisposed) return;

          // Jika chart lain sedang menjadi source, abaikan event balik ini.
          if (
            syncSourceRef.current !== null &&
            syncSourceRef.current !== chart
          ) {
            return;
          }

          // Tandai chart ini sebagai sumber sinkronisasi.
          syncSourceRef.current = chart;

          try {
            const visibleLogicalRange = timeScale.getVisibleLogicalRange();
            if (!visibleLogicalRange) return;

            const visibleRange = timeScale.getVisibleRange();
            if (visibleRange) currentVisibleRangeRef.current = visibleRange;

            // Sinkronkan langsung tanpa RAF agar mencegah loop event balik.
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
            // Reset source setelah sinkronisasi selesai.
            syncSourceRef.current = null;
          }
        });

      const unsubscribeCrosshair = setupCrosshairSync(
        chart,
        allCharts,
        chartType,
      );

      return () => {
        console.log(`[ChartSync] Cleaning up sync for "${chartType}" chart`);
        isDisposed = true;
        // Pastikan source dibersihkan saat chart dibongkar.
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
    [setupCrosshairSync],
  );

  return {
    setupChartSync,
    setupCrosshairSync,
    dataRangeRef,
    allCandlesDataRef,
    // Tetap diexpose untuk kompatibilitas dengan pemakaian lama.
    currentVisibleRangeRef,
  };
};
