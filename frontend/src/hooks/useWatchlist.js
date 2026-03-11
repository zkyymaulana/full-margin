import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
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
 */
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]); // array of coinIds (numbers)
  const [loading, setLoading] = useState(true);

  // ── initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await getWatchlist();
        if (!cancelled && res?.data) {
          setWatchlist(res.data.map((e) => e.coinId));
        }
      } catch (err) {
        console.error("Failed to load watchlist:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
          // Use message from API response
          toast.info(res?.message || "Removed from watchlist.");
        } else {
          const res = await addToWatchlist(coinId);
          // Message text comes from the backend (includes Telegram hint when not connected)
          toast.success(res?.message || "Added to watchlist.");
        }
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
    [watchlist]
  );

  return { watchlist, isWatched, toggleWatchlist, loading };
}
