// src/hooks/useCandles.js
import { useQuery } from "@tanstack/react-query";
import { getCandles } from "../services/candle.service.js";

export function useCandles(symbol = "BTC-USD") {
  return useQuery({
    queryKey: ["candles", symbol],
    queryFn: () => getCandles(symbol),
    refetchInterval: 5_000, // auto-refresh tiap 5 detik
  });
}
