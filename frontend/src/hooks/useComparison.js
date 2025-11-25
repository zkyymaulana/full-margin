/**
 * Hooks for Comparison data using TanStack Query
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchComparison, fetchQuickComparison } from "../services/api.service";

// Mutation for custom comparison
export const useComparison = () => {
  return useMutation({
    mutationFn: (requestBody) => fetchComparison(requestBody),
    // ✅ Keep successful comparison data in cache for 30 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
};

// Mutation for quick comparison
export const useQuickComparison = () => {
  return useMutation({
    mutationFn: ({ symbol, preset, days }) =>
      fetchQuickComparison(symbol, preset, days),
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// ✅ NEW: Query to persist last comparison result
export const useLastComparison = (symbol) => {
  return useQuery({
    queryKey: ["lastComparison", symbol],
    queryFn: () => {
      // This is a placeholder - actual data comes from mutation
      return null;
    },
    enabled: false, // Don't auto-fetch, only use cached data
    staleTime: 30 * 60 * 1000, // Consider fresh for 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });
};
