// Kumpulan hook untuk fitur comparison/backtest.
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchComparison, fetchQuickComparison } from "../services/api.service";

// Jalankan comparison dengan body custom dari user.
export const useComparison = () => {
  return useMutation({
    mutationFn: (requestBody) => fetchComparison(requestBody),
    // Simpan hasil sukses lebih lama agar tidak hilang saat pindah halaman.
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
};

// Jalankan quick comparison berbasis preset.
export const useQuickComparison = () => {
  return useMutation({
    mutationFn: ({ symbol, preset, days }) =>
      fetchQuickComparison(symbol, preset, days),
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Query placeholder untuk menampung cache hasil comparison terakhir.
export const useLastComparison = (symbol) => {
  return useQuery({
    queryKey: ["lastComparison", symbol],
    queryFn: () => {
      // Data aslinya datang dari mutation; query ini hanya wadah cache.
      return null;
    },
    enabled: false, // Tidak auto-fetch, hanya baca cache yang sudah ada.
    staleTime: 30 * 60 * 1000, // Anggap fresh selama 30 menit.
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });
};
