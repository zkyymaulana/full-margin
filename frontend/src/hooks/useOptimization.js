import { useMutation, useQuery } from "@tanstack/react-query";
import api, { requestOptimization } from "../services/api.service";
import { useState, useEffect, useRef } from "react";

const MAX_SSE_RETRIES = 8;

/**
 * Custom Hook: useOptimization
 *
 * Handles incremental optimization request
 * Supports loading state, success/error handling
 */
export function useOptimization() {
  return useMutation({
    mutationFn: async ({ symbol, timeframe = "1h" }) => {
      // ✅ Use requestOptimization from api.service (has 2 hour timeout)
      return await requestOptimization(symbol, timeframe);
    },
    onSuccess: (data) => {
      console.log("✅ Optimization completed:", data);
    },
    onError: (error) => {
      console.error("❌ Optimization failed:", error);
      // ✅ Log detailed error information
      if (error.response) {
        console.error("📄 Error Response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      } else if (error.request) {
        console.error("📡 No response received:", error.message);
      } else {
        console.error("⚙️ Request setup error:", error.message);
      }
    },
  });
}

/**
 * Custom Hook: useForceReoptimization
 *
 * Handles FORCE reoptimization (Full Exhaustive Search)
 * Even if weights already exist in database
 */
export function useForceReoptimization() {
  return useMutation({
    mutationFn: ({ symbol, timeframe = "1h" }) =>
      forceReoptimization(symbol, timeframe),
    onSuccess: (data) => {
      console.log("✅ Force reoptimization completed:", data);
    },
    onError: (error) => {
      console.error("❌ Force reoptimization failed:", error);
    },
  });
}

/**
 * 🆕 Custom Hook: useOptimizationEstimate
 *
 * Get time estimate for optimization before running it
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - Timeframe (default: "1h")
 * @param {boolean} enabled - Whether to fetch estimate
 */
export function useOptimizationEstimate(
  symbol,
  timeframe = "1h",
  enabled = true,
) {
  return useQuery({
    queryKey: ["optimizationEstimate", symbol, timeframe],
    queryFn: async () => {
      const response = await api.get(
        `/multiIndicator/${symbol}/estimate?timeframe=${timeframe}`,
      );
      return response.data;
    },
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * 🆕 SSE-Driven Progress Tracking Hook
 *
 * This hook tracks optimization progress using Server-Sent Events (SSE).
 * SSE connection only opens when explicitly enabled.
 *
 * @param {string} symbol - Trading symbol (e.g., "ETH-USD")
 * @param {boolean} enabled - Whether to open SSE connection (default: false)
 * @returns {Object|null} Progress state or null
 */
export const useOptimizationProgress = (symbol, enabled = false) => {
  const [progress, setProgress] = useState(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const eventSourceRef = useRef(null);
  const isConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const manualCloseRef = useRef(false); // ✅ NEW: Flag to track manual close

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const closeEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    isConnectedRef.current = false;
  };

  const fetchStatusFallback = async (activeSymbol) => {
    const token = localStorage.getItem("authToken");
    if (!token || !activeSymbol) return null;

    try {
      const url = `${import.meta.env.VITE_API_BASE_URL}/multiIndicator/${activeSymbol}/status`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  const mapStatusToProgress = (statusResponse) => {
    if (!statusResponse?.success) return null;

    if (statusResponse.status === "completed") {
      return {
        current:
          statusResponse.result?.performance?.totalCombinations || 390625,
        total: statusResponse.result?.performance?.totalCombinations || 390625,
        percentage: 100,
        bestROI: statusResponse.result?.performance?.roi || 0,
        etaFormatted: "Completed!",
        status: "completed",
      };
    }

    if (statusResponse.status === "error") {
      return {
        status: "error",
        message: statusResponse.error || "Optimization failed",
      };
    }

    if (statusResponse.status === "running") {
      const p = statusResponse.progress || {};
      return {
        current: p.tested || p.current || 0,
        total: p.total || 390625,
        percentage: p.percentage || 0,
        bestROI: p.bestROI || 0,
        etaSeconds: p.etaSeconds,
        etaFormatted: p.eta || "Reconnecting...",
        status: "running",
      };
    }

    return {
      current: 0,
      total: 390625,
      percentage: 0,
      bestROI: 0,
      etaFormatted: "Waiting...",
      status: "waiting",
    };
  };

  useEffect(() => {
    isMountedRef.current = true;

    // ✅ Only open connection if enabled AND symbol exists
    if (!enabled || !symbol) {
      console.log(`⏹️ [SSE] Connection disabled or no symbol provided`);

      // ✅ Clear progress when disabled (e.g., user clicked Close button)
      if (manualCloseRef.current) {
        console.log(`🧹 [SSE] Clearing progress after manual close`);
        setProgress(null);
        manualCloseRef.current = false;
      }

      clearReconnectTimeout();
      closeEventSource();
      retryCountRef.current = 0;

      return;
    }

    // ✅ Prevent duplicate connections - STRICT CHECK
    if (isConnectedRef.current && eventSourceRef.current) {
      console.log(
        `⚠️ [SSE] Already connected for ${symbol}, skipping duplicate connection`,
      );
      return;
    }

    // ✅ Clear any pending reconnect
    clearReconnectTimeout();

    // ✅ Get auth token
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.error(`❌ [SSE] No auth token found`);
      return;
    }

    // ✅ Open SSE connection
    const sseUrl = `${
      import.meta.env.VITE_API_BASE_URL
    }/multiIndicator/${symbol}/optimize-stream?token=${encodeURIComponent(
      token,
    )}`;
    console.log(`📡 [SSE] Opening connection for ${symbol}...`);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;
      isConnectedRef.current = true;

      // ✅ Connection opened successfully
      eventSource.onopen = () => {
        console.log(`✅ [SSE] Connection opened for ${symbol}`);
        retryCountRef.current = 0;
      };

      // ✅ CRITICAL: Handle ALL messages (SSE messages without event name)
      eventSource.onmessage = (event) => {
        // Skip heartbeat
        if (
          !event.data ||
          event.data.trim() === "" ||
          event.data.includes("heartbeat")
        ) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          const eventType = data.type || "unknown";

          console.log(`📨 [SSE] Received: ${eventType}`, data);

          // ✅ Handle based on event type
          switch (eventType) {
            case "status":
              // Informational only - set waiting state
              console.log(
                `ℹ️ [SSE] Status: ${data.status} - ${data.message || ""}`,
              );

              // ✅ ALWAYS set waiting state when receiving status event
              setProgress({
                current: 0,
                total: 390625,
                percentage: 0,
                bestROI: 0,
                etaFormatted: "Waiting...",
                status: "waiting",
              });
              break;

            case "start":
              console.log(`🚀 [SSE] Optimization started:`, {
                symbol: data.symbol,
                dataPoints: data.dataPoints,
                totalCombinations: data.totalCombinations,
                datasetRange: data.datasetRange,
              });

              // Initialize running state with dataset info
              setProgress({
                current: 0,
                total: data.totalCombinations || 390625,
                percentage: 0,
                bestROI: 0,
                etaFormatted: "Starting...",
                status: "running",
                dataPoints: data.dataPoints, // ✅ Add dataset size
                datasetRange: data.datasetRange, // ✅ Add date range
              });
              break;

            case "progress":
              // ✅ Update progress state
              const {
                tested,
                total,
                percentage,
                bestROI,
                eta,
                etaSeconds,
                dataPoints,
                datasetRange,
              } = data;

              setProgress((prev) => ({
                current: tested,
                total: total,
                percentage: percentage,
                bestROI: bestROI,
                etaSeconds: etaSeconds,
                etaFormatted: eta,
                status: "running",
                dataPoints: dataPoints || prev?.dataPoints, // ✅ Preserve from start event
                datasetRange: datasetRange || prev?.datasetRange, // ✅ Preserve from start event
              }));

              // Log milestone (every 10%)
              if (percentage % 10 === 0 || tested === total) {
                console.log(
                  `📈 [SSE] Progress: ${tested}/${total} (${percentage}%) | Best: ${bestROI}% | ETA: ${eta}`,
                );
              }
              break;

            case "cancelled":
              console.log(`🛑 [SSE] Optimization cancelled:`, data);

              // ✅ NO MODAL - Just clean up silently
              setProgress(null); // Clear progress immediately

              // Close connection immediately
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
                isConnectedRef.current = false;
              }
              break;

            case "completed":
              console.log(`✅ [SSE] Optimization completed:`, data);

              // Set final state
              setProgress({
                current: data.performance?.totalCombinations || 390625,
                total: data.performance?.totalCombinations || 390625,
                percentage: 100,
                bestROI: data.performance?.roi || 0,
                etaFormatted: "Completed!",
                status: "completed",
              });

              // Clear progress after 3 seconds and close connection
              setTimeout(() => {
                console.log(`🧹 [SSE] Cleaning up after completion`);
                setProgress(null);
                closeEventSource();
              }, 3000);
              break;

            case "error":
              console.error(`❌ [SSE] Backend error:`, data.message);

              // Clear progress and close connection
              setProgress(null);
              closeEventSource();
              break;

            default:
              console.warn(`⚠️ [SSE] Unknown event type: ${eventType}`, data);
          }
        } catch (err) {
          console.error(`❌ [SSE] Parse error:`, err, event.data);
        }
      };

      // ✅ Handle connection errors
      eventSource.onerror = async () => {
        console.error(`❌ [SSE] Connection error for ${symbol}`);

        closeEventSource();

        const statusSnapshot = await fetchStatusFallback(symbol);
        const mapped = mapStatusToProgress(statusSnapshot);
        if (mapped && isMountedRef.current) {
          setProgress(mapped);
        }

        if (!isMountedRef.current || !enabled) return;

        retryCountRef.current += 1;

        if (retryCountRef.current > MAX_SSE_RETRIES) {
          setProgress((prev) => {
            if (!prev) return null;
            if (prev.status === "completed" || prev.status === "cancelled") {
              return prev;
            }
            return {
              ...prev,
              status: "cancelled",
              reason: "sse_disconnected",
              message:
                "Koneksi ke server terputus terlalu lama. Coba jalankan ulang optimization.",
            };
          });
          return;
        }

        const retryDelayMs = Math.min(3000 * retryCountRef.current, 15000);
        setProgress((prev) => ({
          ...(prev || {
            current: 0,
            total: 390625,
            percentage: 0,
            bestROI: 0,
          }),
          status: "running",
          etaFormatted: `Reconnecting in ${Math.ceil(retryDelayMs / 1000)}s...`,
        }));

        clearReconnectTimeout();
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectNonce((v) => v + 1);
        }, retryDelayMs);
      };
    } catch (err) {
      console.error(`❌ [SSE] Failed to create EventSource:`, err);
      isConnectedRef.current = false;
      eventSourceRef.current = null;
    }

    // ✅ Cleanup on unmount or symbol change
    return () => {
      console.log(`🔌 [SSE] Cleaning up connection for ${symbol}`);
      isMountedRef.current = false;

      clearReconnectTimeout();
      closeEventSource();
      retryCountRef.current = 0;
    };
  }, [symbol, enabled, reconnectNonce]); // ✅ Depend on both symbol AND enabled

  return progress;
};
