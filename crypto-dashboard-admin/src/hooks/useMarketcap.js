/**
 * Hooks for Marketcap data using TanStack Query
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketCapLive,
  getMarketcapSymbols,
} from "../services/api.service";

// Get live marketcap data
export const useMarketCapLive = () => {
  return useQuery({
    queryKey: ["marketcap", "live"],
    queryFn: fetchMarketCapLive,
    refetchInterval: 3000, // Refresh every 3 seconds
    staleTime: 2000,
  });
};

// Get marketcap symbols for search
export const useMarketcapSymbols = () => {
  return useQuery({
    queryKey: ["marketcap", "symbols"],
    queryFn: getMarketcapSymbols,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
