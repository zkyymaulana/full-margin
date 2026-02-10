/**
 * Hooks for Marketcap data using TanStack Query
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketCapLive,
  getMarketcapSymbols,
} from "../services/api.service";

// Get live marketcap data - always fetch 20 coins
export const useMarketCapLive = () => {
  return useQuery({
    queryKey: ["marketcap", "live"],
    queryFn: () => fetchMarketCapLive(),
    refetchInterval: 3000, // Refresh every 3 seconds
    staleTime: 2000,
  });
};

// ✅ Get marketcap summary (global stats - always 20 coins)
export const useMarketCapSummary = () => {
  return useQuery({
    queryKey: ["marketcap", "summary"],
    queryFn: () => fetchMarketCapLive(),
    refetchInterval: 3000,
    staleTime: 2000,
    select: (data) => ({
      summary: data?.summary || {
        totalMarketCap: 0,
        totalVolume24h: 0,
        btcDominance: 0,
        activeCoins: 0,
        gainers: 0,
        losers: 0,
      },
      timestamp: data?.timestamp || new Date().toISOString(),
    }),
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
