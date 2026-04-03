import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../services/api.service";

// Hook untuk mengelola watchlist coin milik user saat ini.
export function useWatchlist() {
  // Simpan daftar coinId yang ada di watchlist user.
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  // Flag ini mencegah request fetch berjalan bersamaan.
  const isFetching = useRef(false);
  // Dipakai untuk invalidasi cache React Query setelah update watchlist.
  const queryClient = useQueryClient();

  // Ambil watchlist dari server.
  const fetchWatchlist = useCallback(async (showLoading = true) => {
    // Cegah request paralel agar state tidak balapan.
    if (isFetching.current) return;
    isFetching.current = true;

    if (showLoading) setLoading(true);

    try {
      const res = await getWatchlist();
      if (res?.data) {
        // Backend mengembalikan object, kita ambil coinId saja.
        const coinIds = res.data.map((e) => e.coinId);
        setWatchlist(coinIds);
        console.log("✅ Watchlist refreshed:", coinIds);
      }
    } catch (err) {
      console.error("Failed to load watchlist:", err);
      // Error fetch di-log saja agar tidak mengganggu UX dengan toast berlebih.
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  // Muat data awal saat hook pertama kali dipakai.
  useEffect(() => {
    fetchWatchlist(true);
  }, [fetchWatchlist]);

  // Auto-refresh saat jendela fokus / tab kembali aktif.
  useEffect(() => {
    const handleFocus = () => {
      console.log("🔄 Window focused, refreshing watchlist...");
      // Refresh senyap tanpa menampilkan loading utama.
      fetchWatchlist(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("👁️ Tab visible, refreshing watchlist...");
        fetchWatchlist(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchWatchlist]);

  // Helper untuk cek apakah coin sudah ada di watchlist.
  const isWatched = useCallback(
    (coinId) => watchlist.includes(coinId),
    [watchlist],
  );

  // Toggle add/remove watchlist dengan optimistic update.
  const toggleWatchlist = useCallback(
    async (coinId) => {
      const alreadyWatched = watchlist.includes(coinId);

      // Optimistic update: UI diperbarui dulu sebelum response server datang.
      setWatchlist((prev) =>
        alreadyWatched ? prev.filter((id) => id !== coinId) : [...prev, coinId],
      );

      try {
        if (alreadyWatched) {
          const res = await removeFromWatchlist(coinId);
          toast.info(res?.message || "Removed from watchlist.");
        } else {
          const res = await addToWatchlist(coinId);
          toast.success(res?.message || "Added to watchlist.");
        }

        // Force sync dari server untuk memastikan UI sama dengan data backend.
        setTimeout(() => {
          fetchWatchlist(false);
          // Invalidasi cache terkait watchlist (misal dipakai halaman Settings).
          queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        }, 500);
      } catch (err) {
        // Rollback optimistic update jika request gagal.
        setWatchlist((prev) =>
          alreadyWatched
            ? [...prev, coinId]
            : prev.filter((id) => id !== coinId),
        );
        const errMsg =
          err?.response?.data?.message ||
          "Failed to update watchlist. Please try again.";
        toast.error(errMsg);
        console.error("Watchlist toggle error:", err);
      }
    },
    [watchlist, fetchWatchlist],
  );

  return {
    watchlist,
    isWatched,
    toggleWatchlist,
    loading,
    // Expose refetch untuk kebutuhan refresh manual dari komponen.
    refetch: fetchWatchlist,
  };
}
