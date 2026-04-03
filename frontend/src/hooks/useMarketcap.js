// Kumpulan hook data marketcap.
import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketCapLive,
  getMarketcapSymbols,
} from "../services/api.service";

// Ambil data marketcap live (20 coin dari backend).
export const useMarketCapLive = () => {
  return useQuery({
    queryKey: ["marketcap", "live"],
    queryFn: () => fetchMarketCapLive(),
    refetchInterval: 3000, // Refresh tiap 3 detik.
    staleTime: 2000,
  });
};

// Ambil ringkasan marketcap global dari payload live.
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

// Ambil simbol marketcap untuk kebutuhan pencarian/autocomplete.
export const useMarketcapSymbols = () => {
  return useQuery({
    queryKey: ["marketcap", "symbols"],
    queryFn: getMarketcapSymbols,
    staleTime: 5 * 60 * 1000, // Cache 5 menit.
  });
};
