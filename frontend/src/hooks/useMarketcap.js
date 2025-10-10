// src/hooks/useMarketcap.js
import { useQuery } from "@tanstack/react-query";
import { fetchMarketcapData } from "../services/marketcap.service";

/**
 * Hook React Query untuk ambil data marketcap
 */
export function useMarketcap() {
  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["marketcap"],
    queryFn: fetchMarketcapData,
    refetchInterval: 60000, // refresh tiap 1 menit
  });

  return { data, error, isLoading, isFetching, refetch };
}
