import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../services/api.service";

/**
 * useWatchlist – manages the current user's coin watchlist.
 *
 * Returns:
 *   watchlist        – array of coinIds currently in the watchlist
 *   isWatched(id)    – returns true if the coin is in the watchlist
 *   toggleWatchlist  – add or remove a coin (optimistic UI)
 *   loading          – true while the initial fetch is in progress
 *   refetch          – manually trigger a refresh
 */
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]); // array of coinIds (numbers)
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false); // Prevent concurrent fetches
  const queryClient = useQueryClient(); // ✅ For React Query cache invalidation

  // ── fetch watchlist ──────────────────────────────────────────────────────
  const fetchWatchlist = useCallback(async (showLoading = true) => {
    // Prevent concurrent requests
    if (isFetching.current) return;
    isFetching.current = true;

    if (showLoading) setLoading(true);

    try {
      const res = await getWatchlist();
      if (res?.data) {
        const coinIds = res.data.map((e) => e.coinId);
        setWatchlist(coinIds);
        console.log("✅ Watchlist refreshed:", coinIds);
      }
    } catch (err) {
      console.error("Failed to load watchlist:", err);
      // Don't show error toast on initial load or background refresh
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  // ── initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchWatchlist(true);
  }, [fetchWatchlist]);

  // ── auto-refresh on window focus ─────────────────────────────────────────
  useEffect(() => {
    const handleFocus = () => {
      console.log("🔄 Window focused, refreshing watchlist...");
      fetchWatchlist(false); // Silent refresh without showing loading state
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

  // ── helpers ───────────────────────────────────────────────────────────────
  const isWatched = useCallback(
    (coinId) => watchlist.includes(coinId),
    [watchlist]
  );

  // ── toggle ────────────────────────────────────────────────────────────────
  const toggleWatchlist = useCallback(
    async (coinId) => {
      const alreadyWatched = watchlist.includes(coinId);

      // Optimistic update
      setWatchlist((prev) =>
        alreadyWatched ? prev.filter((id) => id !== coinId) : [...prev, coinId]
      );

      try {
        if (alreadyWatched) {
          const res = await removeFromWatchlist(coinId);
          toast.info(res?.message || "Removed from watchlist.");
        } else {
          const res = await addToWatchlist(coinId);
          toast.success(res?.message || "Added to watchlist.");
        }

        // ✅ FORCE SYNC: Refresh from server after successful toggle
        // This ensures UI always matches backend reality
        setTimeout(() => {
          fetchWatchlist(false);
          // ✅ Invalidate React Query cache (for Settings page)
          queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        }, 500);
      } catch (err) {
        // Roll back on failure
        setWatchlist((prev) =>
          alreadyWatched
            ? [...prev, coinId]
            : prev.filter((id) => id !== coinId)
        );
        const errMsg =
          err?.response?.data?.message ||
          "Failed to update watchlist. Please try again.";
        toast.error(errMsg);
        console.error("Watchlist toggle error:", err);
      }
    },
    [watchlist, fetchWatchlist]
  );

  return {
    watchlist,
    isWatched,
    toggleWatchlist,
    loading,
    refetch: fetchWatchlist, // ✅ Expose refetch for manual refresh
  };
}
