import { useRef, useCallback, useState } from "react";
import { fetchCandlesByUrl } from "../services/api.service";

/**
 * Custom hook for infinite scroll pagination in charts
 * Handles loading more historical data when scrolling left
 * ✅ OPTIMIZED: URL dedup, AbortController, preload, smart guards
 */
export const useChartPagination = (allCandlesData, setAllCandlesData) => {
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const visibleRangeSubscriptionRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const nextUrlRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fetchLockRef = useRef(false);

  // ✅ NEW: URL deduplication - track fetched URLs
  const fetchedUrlsRef = useRef(new Set());

  // ✅ NEW: Track last visible range to detect significant changes
  const lastVisibleRangeRef = useRef(null);

  const [pageInfo, setPageInfo] = useState({
    currentPage: 1,
    totalPages: 1,
    nextUrl: null,
    prevUrl: null,
    isLoading: false,
    hasMore: true,
  });

  // Merge candles data without duplicates
  // ✅ OPTIMIZED: Assume backend data is sorted, avoid full array sort
  const mergeCandlesData = useCallback((existingData, newData) => {
    const existingTimes = new Set(existingData.map((d) => d.time.toString()));
    const uniqueNewData = newData.filter(
      (d) => !existingTimes.has(d.time.toString())
    );

    // ✅ OPTIMIZATION: Prepend without sorting (backend already sorted descending)
    const merged = [...uniqueNewData, ...existingData];

    console.log(
      `📦 [MERGE] Added ${uniqueNewData.length} new candles (total: ${merged.length})`
    );
    return merged;
  }, []);

  // Fetch more data for pagination
  // ✅ OPTIMIZED: AbortController, URL dedup, hard lock, smart debounce
  const fetchMoreData = useCallback(
    async (chartRef) => {
      // ✅ HARD LOCK: Prevent multiple simultaneous requests
      if (fetchLockRef.current) {
        console.log("🔒 [HARD LOCK] Fetch already in progress, skipping");
        return;
      }

      if (
        isLoadingMoreRef.current ||
        !hasMoreDataRef.current ||
        !nextUrlRef.current
      ) {
        return;
      }

      // ✅ URL DEDUPLICATION: Skip if already fetched
      if (fetchedUrlsRef.current.has(nextUrlRef.current)) {
        console.log(
          `⏭️ [DEDUP] URL already fetched, skipping: ${nextUrlRef.current}`
        );
        return;
      }

      // ✅ DEBOUNCE: Minimum 600ms between fetches
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 600) {
        console.log(
          `⏸️ [DEBOUNCE] Too soon (${now - lastFetchTimeRef.current}ms < 600ms)`
        );
        return;
      }

      // ✅ Set hard lock & loading state
      fetchLockRef.current = true;
      isLoadingMoreRef.current = true;
      lastFetchTimeRef.current = now;
      setPageInfo((prev) => ({ ...prev, isLoading: true }));

      // ✅ Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        console.log("❌ [ABORT] Cancelled previous fetch request");
      }

      // ✅ Create new AbortController
      abortControllerRef.current = new AbortController();

      console.log(`🔄 [FETCH] Loading: ${nextUrlRef.current}`);

      try {
        const prevTotal = allCandlesData.length;
        const currentLogicalRange = chartRef.current
          ?.timeScale()
          .getVisibleLogicalRange();

        const response = await fetchCandlesByUrl(
          nextUrlRef.current,
          abortControllerRef.current.signal
        );

        if (response?.success && response.data?.length > 0) {
          console.log(
            `✅ [FETCH] Got ${response.data.length} candles (Page ${response.page}/${response.totalPages})`
          );

          // ✅ Mark URL as fetched
          fetchedUrlsRef.current.add(nextUrlRef.current);

          if (chartRef.current) {
            chartRef.current.applyOptions({
              rightPriceScale: { autoScale: false },
            });
          }

          const mergedData = mergeCandlesData(allCandlesData, response.data);
          const addedBars = mergedData.length - prevTotal;

          // ✅ OPTIMIZATION: Only update state if data actually changed
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
            console.log("⏭️ [SKIP] No new data added, state unchanged");
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
        // ✅ Ignore abort errors
        if (error.name === "AbortError") {
          console.log("⚠️ [ABORT] Fetch aborted");
        } else {
          console.error("❌ [ERROR] Fetch failed:", error);
        }
        setPageInfo((prev) => ({ ...prev, isLoading: false }));
      } finally {
        // ✅ Release locks
        isLoadingMoreRef.current = false;
        fetchLockRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [allCandlesData, mergeCandlesData, setAllCandlesData]
  );

  // Setup pagination listener
  // ✅ OPTIMIZED: Preload at 120 bars, smart range detection
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

            // ✅ SMART GUARD: Only trigger if range changed significantly
            if (lastVisibleRangeRef.current) {
              const rangeDiff = Math.abs(
                logicalRange.from - lastVisibleRangeRef.current.from
              );

              // Skip if range change is too small (< 5 bars)
              if (rangeDiff < 5) {
                return;
              }
            }

            // ✅ Update last visible range
            lastVisibleRangeRef.current = logicalRange;

            const barsInfo = series.barsInLogicalRange(logicalRange);
            if (!barsInfo) return;

            const barsBefore = Math.max(0, Math.ceil(logicalRange.from));

            // ✅ PRELOAD: Trigger at 120 bars (earlier than before)
            if (
              barsBefore < 120 &&
              hasMoreDataRef.current &&
              !isLoadingMoreRef.current
            ) {
              console.log(
                `📍 [SCROLL] Bars before visible: ${barsBefore} → Preloading...`
              );
              fetchMoreData(chart);
            }
          } catch (error) {
            console.error("Error in visible range handler:", error);
          }
        }, 150); // 150ms debounce
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
    [fetchMoreData]
  );

  // Initialize pagination
  const initializePagination = useCallback((response) => {
    if (response?.pagination) {
      nextUrlRef.current = response.pagination.next?.url || null;
      hasMoreDataRef.current = response.pagination.next?.url != null;

      // ✅ Reset fetched URLs on new symbol/data
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

      console.log(
        `🎯 [INIT] Pagination ready (Page ${response.page}/${response.totalPages})`
      );
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
