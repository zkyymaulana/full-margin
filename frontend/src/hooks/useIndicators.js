/**
 * Hooks for Indicators data using TanStack Query
 */
import { useQuery } from "@tanstack/react-query";
import { fetchIndicator, fetchMultiIndicator } from "../services/api.service";

// Get single indicator
export const useIndicator = (symbol = "BTC-USD") => {
  return useQuery({
    queryKey: ["indicator", symbol],
    queryFn: () => fetchIndicator(symbol),
    staleTime: 4000,
    enabled: !!symbol,
  });
};

// Get multi indicators
export const useMultiIndicator = (symbol = "BTC-USD") => {
  return useQuery({
    queryKey: ["multi-indicator", symbol],
    queryFn: () => fetchMultiIndicator(symbol),
    staleTime: 4000,
    enabled: !!symbol,
  });
};
