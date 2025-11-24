/**
 * Hooks for Indicators data using TanStack Query
 * 🆕 UNIFIED: Single endpoint with mode support
 */
import { useQuery } from "@tanstack/react-query";
import { fetchIndicator } from "../services/api.service";

/**
 * Get indicator data with mode support
 * @param {string} symbol - Trading symbol (e.g., "BTC-USD")
 * @param {string} mode - "latest" for single data, "paginated" for chart data
 * @param {string} timeframe - Timeframe (e.g., "1h", "4h", "1d")
 * @returns {QueryResult} React Query result with latestSignal data
 */
export const useIndicator = (
  symbol = "BTC-USD",
  mode = "latest",
  timeframe = "1h"
) => {
  return useQuery({
    queryKey: ["indicator", symbol, mode, timeframe],
    queryFn: () => fetchIndicator(symbol, mode, timeframe),
    staleTime: 5000, // Cache for 5 seconds
    enabled: !!symbol,
    retry: 2,
  });
};

// ❌ DEPRECATED: Use useIndicator with mode="latest" instead
export const useMultiIndicator = (symbol = "BTC-USD") => {
  console.warn(
    "⚠️ useMultiIndicator is deprecated. Use useIndicator(symbol, 'latest') instead."
  );
  return useIndicator(symbol, "latest", "1h");
};
