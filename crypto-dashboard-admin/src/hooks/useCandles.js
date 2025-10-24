/**
 * Hooks for Candlestick chart data using TanStack Query
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCandles } from "../services/api.service";

// Get candlestick data
export const useCandles = (symbol = "BTC-USD", timeframe = "1h") => {
  return useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe),
    staleTime: 4000,
    enabled: !!symbol && !!timeframe,
  });
};
