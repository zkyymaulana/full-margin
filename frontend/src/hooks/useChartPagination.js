import { useRef, useCallback, useState } from "react";
import { fetchCandlesByUrl } from "../services/api.service";

/**
 * Custom hook for infinite scroll pagination in charts
 * Handles loading more historical data when scrolling left
 */
export const useChartPagination = (allCandlesData, setAllCandlesData) => {
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const visibleRangeSubscriptionRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const nextUrlRef = useRef(null);

  const [pageInfo, setPageInfo] = useState({
    currentPage: 1,
    totalPages: 1,
    nextUrl: null,
    prevUrl: null,
    isLoading: false,
    hasMore: true,
  });

  // Merge candles data without duplicates
  const mergeCandlesData = useCallback((existingData, newData) => {
    const existingTimes = new Set(existingData.map((d) => d.time.toString()));
    const uniqueNewData = newData.filter(
      (d) => !existingTimes.has(d.time.toString())
    );

    const merged = [...existingData, ...uniqueNewData];
    merged.sort((a, b) => {
      const timeA = typeof a.time === "string" ? Number(a.time) : a.time;
      const timeB = typeof b.time === "string" ? Number(b.time) : b.time;
      return timeA - timeB;
    });

    console.log(
      `📊 Merged data: ${existingData.length} + ${uniqueNewData.length} = ${merged.length} candles`
    );
    return merged;
  }, []);

  // Fetch more data for pagination
  const fetchMoreData = useCallback(
    async (chartRef) => {
      if (
        isLoadingMoreRef.current ||
        !hasMoreDataRef.current ||
        !nextUrlRef.current
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastFetchTimeRef.current < 500) {
        console.log("⏸️ Debounced: Too soon since last fetch");
        return;
      }

      isLoadingMoreRef.current = true;
      lastFetchTimeRef.current = now;
      setPageInfo((prev) => ({ ...prev, isLoading: true }));

      console.log(`🔄 Fetching more data from: ${nextUrlRef.current}`);

      try {
        const prevTotal = allCandlesData.length;
        const currentLogicalRange = chartRef.current
          ?.timeScale()
          .getVisibleLogicalRange();

        const response = await fetchCandlesByUrl(nextUrlRef.current);

        if (response?.success && response.data?.length > 0) {
          console.log(
            `✅ Fetched ${response.data.length} new candles (Page ${response.page}/${response.totalPages})`
          );

          if (chartRef.current) {
            chartRef.current.applyOptions({
              rightPriceScale: { autoScale: false },
            });
          }

          const mergedData = mergeCandlesData(allCandlesData, response.data);
          const addedBars = mergedData.length - prevTotal;

          setAllCandlesData(mergedData);

          if (currentLogicalRange && chartRef.current && addedBars > 0) {
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
        console.error("❌ Error fetching more data:", error);
        setPageInfo((prev) => ({ ...prev, isLoading: false }));
      } finally {
        isLoadingMoreRef.current = false;
      }
    },
    [allCandlesData, mergeCandlesData, setAllCandlesData]
  );

  // Setup pagination listener
  const setupPaginationListener = useCallback(
    (chart, series) => {
      if (!chart || !series) {
        console.warn("⚠️ setupPaginationListener: chart or series is null");
        return;
      }

      const timeScale = chart.timeScale();

      const handleVisibleLogicalRangeChange = (logicalRange) => {
        if (!logicalRange) return;

        const barsInfo = series.barsInLogicalRange(logicalRange);
        if (!barsInfo) return;

        const { barsBefore } = barsInfo;
        const isNearLeftEdge = barsBefore !== null && barsBefore < 50;

        if (
          isNearLeftEdge &&
          hasMoreDataRef.current &&
          !isLoadingMoreRef.current
        ) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            fetchMoreData({ current: chart });
          }, 300);
        }
      };

      const unsubscribe = timeScale.subscribeVisibleLogicalRangeChange(
        handleVisibleLogicalRangeChange
      );
      visibleRangeSubscriptionRef.current = unsubscribe;

      return unsubscribe;
    },
    [fetchMoreData]
  );

  // Initialize pagination info
  const initializePagination = useCallback((candlesData) => {
    if (!candlesData?.success || !candlesData.data?.length) return;

    const hasNext = candlesData.pagination?.next?.url != null;
    nextUrlRef.current = candlesData.pagination?.next?.url || null;
    hasMoreDataRef.current = hasNext;

    setPageInfo({
      currentPage: candlesData.page || 1,
      totalPages: candlesData.totalPages || 1,
      nextUrl: candlesData.pagination?.next?.url || null,
      prevUrl: candlesData.pagination?.prev?.url || null,
      isLoading: false,
      hasMore: hasNext,
    });
  }, []);

  return {
    pageInfo,
    setupPaginationListener,
    initializePagination,
    debounceTimerRef,
  };
};
