/**
 * Hooks for Comparison data using TanStack Query
 */
import { useMutation } from "@tanstack/react-query";
import { fetchComparison, fetchQuickComparison } from "../services/api.service";

// Mutation for custom comparison
export const useComparison = () => {
  return useMutation({
    mutationFn: (requestBody) => fetchComparison(requestBody),
  });
};

// Mutation for quick comparison
export const useQuickComparison = () => {
  return useMutation({
    mutationFn: ({ symbol, preset, days }) =>
      fetchQuickComparison(symbol, preset, days),
  });
};
