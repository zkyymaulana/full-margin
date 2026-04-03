// Kumpulan hook untuk data candlestick.
import { useQuery } from "@tanstack/react-query";
import {
  fetchCandles,
  fetchCandlesWithPagination,
} from "../services/api.service";

// Ambil data candle dasar untuk chart utama.
export const useCandles = (symbol = "BTC-USD", timeframe = "1h") => {
  return useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe),
    staleTime: 4000,
    enabled: !!symbol && !!timeframe,
  });
};

// Ambil data candle dengan pagination (dipakai infinite scroll).
export const useCandlesPaginated = (
  symbol = "BTC-USD",
  timeframe = "1h",
  page = 1,
  limit = 1000,
) => {
  return useQuery({
    queryKey: ["candles-paginated", symbol, timeframe, page],
    queryFn: () => fetchCandlesWithPagination(symbol, timeframe, page, limit),
    staleTime: 60000, // Data dianggap fresh selama 1 menit.
    enabled: !!symbol && !!timeframe,
    // Pertahankan data page sebelumnya agar UI tidak "kedip" saat page baru dimuat.
    keepPreviousData: true,
  });
};
