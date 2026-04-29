import { useRef, useCallback, useState } from "react";
import { fetchCandlesByUrl } from "../services/api.service";

// Hook pagination chart untuk memuat data historis saat user scroll ke kiri.
export const useChartPagination = (allCandlesData, setAllCandlesData) => {
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const visibleRangeSubscriptionRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const nextUrlRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fetchLockRef = useRef(false);

  // Simpan URL yang sudah pernah diambil agar tidak request berulang.
  const fetchedUrlsRef = useRef(new Set());

  // Simpan visible range terakhir untuk mendeteksi perubahan yang signifikan.
  const lastVisibleRangeRef = useRef(null);

  const [pageInfo, setPageInfo] = useState({
    currentPage: 1,
    totalPages: 1,
    nextUrl: null,
    prevUrl: null,
    isLoading: false,
    hasMore: true,
  });

  // Gabungkan data lama dan baru tanpa duplikasi timestamp.
  // Backend diasumsikan sudah terurut sehingga tidak perlu sort ulang penuh.
  const mergeCandlesData = useCallback((existingData, newData) => {
    const existingTimes = new Set(existingData.map((d) => d.time.toString()));
    const uniqueNewData = newData.filter(
      (d) => !existingTimes.has(d.time.toString()),
    );

    // Tambahkan data baru di depan karena pagination bergerak ke data lebih lama.
    const merged = [...uniqueNewData, ...existingData];

    return merged;
  }, []);

  // Muat halaman data berikutnya untuk pagination chart.
  const fetchMoreData = useCallback(
    async (chartRef) => {
      // Hard lock mencegah request paralel yang bisa membuat data dobel.
      if (fetchLockRef.current) {
        return;
      }

      if (
        isLoadingMoreRef.current ||
        !hasMoreDataRef.current ||
        !nextUrlRef.current
      ) {
        return;
      }

      // Lewati request jika URL ini sudah pernah berhasil diambil.
      if (fetchedUrlsRef.current.has(nextUrlRef.current)) {
        return;
      }

      // Jeda minimal antar request untuk menghindari spam API.
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 600) {
        return;
      }

      // Aktifkan lock + loading sebelum request dimulai.
      fetchLockRef.current = true;
      isLoadingMoreRef.current = true;
      lastFetchTimeRef.current = now;
      setPageInfo((prev) => ({ ...prev, isLoading: true }));

      // Batalkan request sebelumnya jika masih berjalan.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Buat AbortController baru untuk request saat ini.
      abortControllerRef.current = new AbortController();


      try {
        const prevTotal = allCandlesData.length;
        const currentLogicalRange = chartRef.current
          ?.timeScale()
          .getVisibleLogicalRange();

        const response = await fetchCandlesByUrl(
          nextUrlRef.current,
          abortControllerRef.current.signal,
        );

        if (response?.success && response.data?.length > 0) {

          // Catat URL ini sebagai sudah diproses.
          fetchedUrlsRef.current.add(nextUrlRef.current);

          if (chartRef.current) {
            chartRef.current.applyOptions({
              rightPriceScale: { autoScale: false },
            });
          }

          const mergedData = mergeCandlesData(allCandlesData, response.data);
          const addedBars = mergedData.length - prevTotal;

          // Update state hanya jika ada penambahan bar baru.
          if (addedBars > 0) {
            setAllCandlesData(mergedData);

            if (currentLogicalRange && chartRef.current) {
              setTimeout(() => {
                try {
                  const newLogicalRange = {
                    from: currentLogicalRange.from + addedBars,
                    to: currentLogicalRange.to + addedBars,
                  };

                  chartRef.current
                    .timeScale()
                    .setVisibleLogicalRange(newLogicalRange);

                  setTimeout(() => {
                    if (chartRef.current) {
                      chartRef.current.applyOptions({
                        rightPriceScale: { autoScale: true },
                      });
                    }
                  }, 200);
                } catch (e) {
                  console.warn("Failed to adjust scroll position:", e);
                  if (chartRef.current) {
                    chartRef.current.applyOptions({
                      rightPriceScale: { autoScale: true },
                    });
                  }
                }
              }, 100);
            }
          } else {
          }

          const hasNext = response.pagination?.next?.url != null;
          nextUrlRef.current = response.pagination?.next?.url || null;
          hasMoreDataRef.current = hasNext;

          setPageInfo({
            currentPage: response.page,
            totalPages: response.totalPages,
            nextUrl: response.pagination?.next?.url || null,
            prevUrl: response.pagination?.prev?.url || null,
            isLoading: false,
            hasMore: hasNext,
          });
        } else {
          hasMoreDataRef.current = false;
          setPageInfo((prev) => ({
            ...prev,
            hasMore: false,
            isLoading: false,
          }));
        }
      } catch (error) {
        // Error abort dianggap normal saat request lama dibatalkan.
        if (error.name === "AbortError") {
        } else {
          console.error("❌ [ERROR] Fetch failed:", error);
        }
        setPageInfo((prev) => ({ ...prev, isLoading: false }));
      } finally {
        // Lepaskan lock agar request berikutnya bisa berjalan.
        isLoadingMoreRef.current = false;
        fetchLockRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [allCandlesData, mergeCandlesData, setAllCandlesData],
  );

  // Pasang listener perubahan visible range untuk memicu preload otomatis.
  const setupPaginationListener = useCallback(
    (chart, series) => {
      if (!chart) return;

      const handleVisibleRangeChange = () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          try {
            const logicalRange = chart.timeScale().getVisibleLogicalRange();
            if (!logicalRange) return;

            // Guard: abaikan perubahan kecil agar tidak terlalu sering fetch.
            if (lastVisibleRangeRef.current) {
              const rangeDiff = Math.abs(
                logicalRange.from - lastVisibleRangeRef.current.from,
              );

              // Abaikan jika perubahan kurang dari 5 bar.
              if (rangeDiff < 5) {
                return;
              }
            }

            // Simpan visible range terbaru.
            lastVisibleRangeRef.current = logicalRange;

            const barsInfo = series.barsInLogicalRange(logicalRange);
            if (!barsInfo) return;

            const barsBefore = Math.max(0, Math.ceil(logicalRange.from));

            // Preload lebih awal saat sisa bar kiri kurang dari 120.
            if (
              barsBefore < 120 &&
              hasMoreDataRef.current &&
              !isLoadingMoreRef.current
            ) {
              fetchMoreData(chart);
            }
          } catch (error) {
            console.error("Error in visible range handler:", error);
          }
        }, 150); // Debounce 150ms agar event scroll rapat tetap stabil.
      };

      visibleRangeSubscriptionRef.current = chart
        .timeScale()
        .subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

      return () => {
        if (visibleRangeSubscriptionRef.current) {
          visibleRangeSubscriptionRef.current();
          visibleRangeSubscriptionRef.current = null;
        }
      };
    },
    [fetchMoreData],
  );

  // Inisialisasi metadata pagination dari response awal.
  const initializePagination = useCallback((response) => {
    if (response?.pagination) {
      nextUrlRef.current = response.pagination.next?.url || null;
      hasMoreDataRef.current = response.pagination.next?.url != null;

      // Reset cache URL saat simbol/data berganti.
      fetchedUrlsRef.current.clear();
      lastVisibleRangeRef.current = null;

      setPageInfo({
        currentPage: response.page || 1,
        totalPages: response.totalPages || 1,
        nextUrl: response.pagination.next?.url || null,
        prevUrl: response.pagination.prev?.url || null,
        isLoading: false,
        hasMore: response.pagination.next?.url != null,
      });

    }
  }, []);

  return {
    pageInfo,
    setupPaginationListener,
    initializePagination,
    fetchMoreData,
    debounceTimerRef,
  };
};
