// Kumpulan hook data marketcap.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketCapLive,
  getMarketcapSymbols,
} from "../services/api.service";
import { useCryptoWebSocket } from "./useCryptoWebSocket";

// Ambil data marketcap live (20 coin dari backend).
export const useMarketCapLive = () => {
  const ws = useCryptoWebSocket();
  const query = useQuery({
    queryKey: ["marketcap", "live"],
    queryFn: () => fetchMarketCapLive(),
    staleTime: 60 * 1000,
  });

  const merged = useMemo(() => {
    const payload = query.data;
    if (!payload?.data || !Array.isArray(payload.data)) return payload;

    const nextData = payload.data.map((coin) => {
      const ticker = ws.ticks?.[coin.symbol];
      if (!ticker || !Number.isFinite(Number(ticker.price))) return coin;

      const nextPrice = Number(ticker.price);
      const open = Number(coin.open);
      const change24h =
        Number.isFinite(open) && open > 0
          ? Number((((nextPrice - open) / open) * 100).toFixed(2))
          : coin.change24h;

      return {
        ...coin,
        price: nextPrice,
        change24h: Number.isFinite(change24h) ? change24h : coin.change24h,
      };
    });

    return {
      ...payload,
      data: nextData,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  }, [query.data, ws.ticks]);

  return {
    ...query,
    data: merged,
  };
};

// Ambil ringkasan marketcap global dari payload live.
export const useMarketCapSummary = () => {
  return useQuery({
    queryKey: ["marketcap", "summary"],
    queryFn: () => fetchMarketCapLive(),
    staleTime: 60 * 1000,
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
    staleTime: 30 * 1000, // Hindari daftar symbol terlalu lama stale.
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
