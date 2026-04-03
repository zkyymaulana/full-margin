// Hook indikator dengan endpoint terpadu (mode latest/paginated).
import { useQuery } from "@tanstack/react-query";
import { fetchIndicator } from "../services/api.service";

// Ambil data indikator berdasarkan simbol, mode, dan timeframe.
export const useIndicator = (
  symbol = "BTC-USD",
  mode = "latest",
  timeframe = "1h",
) => {
  return useQuery({
    queryKey: ["indicator", symbol, mode, timeframe],
    queryFn: () => fetchIndicator(symbol, mode, timeframe),
    staleTime: 5000, // Cache singkat agar data indikator tetap responsif.
    enabled: !!symbol,
    retry: 2,
  });
};

// Deprecated: dipertahankan agar impor lama tidak langsung rusak.
export const useMultiIndicator = (symbol = "BTC-USD") => {
  console.warn(
    "⚠️ useMultiIndicator is deprecated. Use useIndicator(symbol, 'latest') instead.",
  );
  return useIndicator(symbol, "latest", "1h");
};
