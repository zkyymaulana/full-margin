// src/hooks/useMarketcap.js
import { useQuery } from "@tanstack/react-query";
import { getMarketcap } from "../services/marketcap.service";

/**
 * 🎯 Hook React Query untuk ambil data marketcap
 * @param {boolean} live - Jika true → ambil dari endpoint /marketcap/live
 */
export function useMarketcap(live = false) {
  const {
    data = [],
    error,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketcap", live],
    queryFn: () => getMarketcap(live),
    refetchInterval: live ? 5000 : 60000, // ⚡ live = 5 detik, cached = 1 menit
    retry: 1, // hanya coba ulang sekali jika error
  });

  return { data, error, isLoading, isFetching, isError, refetch };
}
