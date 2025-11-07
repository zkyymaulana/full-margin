/**
 * Hooks for Candlestick chart data using TanStack Query
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchCandles,
  fetchCandlesWithPagination,
} from "../services/api.service";

// Get candlestick data
export const useCandles = (symbol = "BTC-USD", timeframe = "1h") => {
  return useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe),
    staleTime: 4000,
    enabled: !!symbol && !!timeframe,
  });
};

// Get candlestick data with pagination (untuk infinite scroll)
export const useCandlesPaginated = (
  symbol = "BTC-USD",
  timeframe = "1h",
  page = 1,
  limit = 1000
) => {
  return useQuery({
    queryKey: ["candles-paginated", symbol, timeframe, page],
    queryFn: () => fetchCandlesWithPagination(symbol, timeframe, page, limit),
    staleTime: 60000, // 1 minute
    enabled: !!symbol && !!timeframe,
    keepPreviousData: true, // Keep previous data while fetching new page
  });
};
