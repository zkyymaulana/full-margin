import { useMutation, useQuery } from "@tanstack/react-query";
import api, { requestOptimization } from "../services/api.service";
import { useState, useEffect, useRef } from "react";

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
  enabled = true
) {
  return useQuery({
    queryKey: ["optimizationEstimate", symbol, timeframe],
    queryFn: async () => {
      const response = await api.get(
        `/multiIndicator/${symbol}/estimate?timeframe=${timeframe}`
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
  const eventSourceRef = useRef(null);
  const isConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const shouldStopReconnectRef = useRef(false); // ✅ NEW: Flag to permanently stop reconnection
  const manualCloseRef = useRef(false); // ✅ NEW: Flag to track manual close

  useEffect(() => {
    // ✅ Only open connection if enabled AND symbol exists
    if (!enabled || !symbol) {
      console.log(`⏹️ [SSE] Connection disabled or no symbol provided`);

      // ✅ Clear progress when disabled (e.g., user clicked Close button)
      if (manualCloseRef.current) {
        console.log(`🧹 [SSE] Clearing progress after manual close`);
        setProgress(null);
        manualCloseRef.current = false;
      }

      return;
    }

    // ✅ Check if reconnection should be blocked
    if (shouldStopReconnectRef.current) {
      console.log(
        `🛑 [SSE] Reconnection blocked for ${symbol} - server restart detected`
      );
      return;
    }

    // ✅ Prevent duplicate connections - STRICT CHECK
    if (isConnectedRef.current && eventSourceRef.current) {
      console.log(
        `⚠️ [SSE] Already connected for ${symbol}, skipping duplicate connection`
      );
      return;
    }

    // ✅ Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
      token
    )}`;
    console.log(`📡 [SSE] Opening connection for ${symbol}...`);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;
      isConnectedRef.current = true;

      // ✅ Connection opened successfully
      eventSource.onopen = () => {
        console.log(`✅ [SSE] Connection opened for ${symbol}`);

        // ✅ CRITICAL: Close immediately if reconnection should be blocked
        if (shouldStopReconnectRef.current) {
          console.log(`🛑 [SSE] Closing connection - reconnection blocked`);
          eventSource.close();
          eventSourceRef.current = null;
          isConnectedRef.current = false;
          return;
        }
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
                `ℹ️ [SSE] Status: ${data.status} - ${data.message || ""}`
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
                  `📈 [SSE] Progress: ${tested}/${total} (${percentage}%) | Best: ${bestROI}% | ETA: ${eta}`
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
                if (eventSourceRef.current) {
                  eventSourceRef.current.close();
                  eventSourceRef.current = null;
                  isConnectedRef.current = false;
                }
              }, 3000);
              break;

            case "error":
              console.error(`❌ [SSE] Backend error:`, data.message);

              // Clear progress and close connection
              setProgress(null);
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
                isConnectedRef.current = false;
              }
              break;

            default:
              console.warn(`⚠️ [SSE] Unknown event type: ${eventType}`, data);
          }
        } catch (err) {
          console.error(`❌ [SSE] Parse error:`, err, event.data);
        }
      };

      // ✅ Handle connection errors
      eventSource.onerror = (error) => {
        console.error(`❌ [SSE] Connection error for ${symbol}`);

        // ✅ CRITICAL: Close connection immediately to prevent auto-reconnect
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        isConnectedRef.current = false;

        // Check readyState
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error(
            `🔌 [SSE] Connection closed unexpectedly for ${symbol}`
          );

          // ✅ If connection closed while running, treat it as server restart
          setProgress((prev) => {
            if (prev?.status === "running" || prev?.status === "waiting") {
              console.log(
                `🛑 [SSE] Server disconnected during optimization - showing cancelled state`
              );
              shouldStopReconnectRef.current = true; // ✅ Block reconnection permanently
              return {
                ...prev,
                status: "cancelled",
                reason: "server_restart",
                message: "Server restarted. Please try again.",
              };
            }
            return null; // No progress to preserve
          });
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          console.log(`🔄 [SSE] Attempting reconnect - blocking it...`);

          // ✅ Also show cancelled state during reconnection attempts
          setProgress((prev) => {
            if (prev?.status === "running" || prev?.status === "waiting") {
              console.log(
                `🛑 [SSE] Blocking reconnect - showing cancelled state`
              );
              shouldStopReconnectRef.current = true; // ✅ Block reconnection permanently
              return {
                ...prev,
                status: "cancelled",
                reason: "server_restart",
                message: "Server restarted. Please try again.",
              };
            }
            return null;
          });
        }
      };
    } catch (err) {
      console.error(`❌ [SSE] Failed to create EventSource:`, err);
      isConnectedRef.current = false;
      eventSourceRef.current = null;
    }

    // ✅ Cleanup on unmount or symbol change
    return () => {
      console.log(`🔌 [SSE] Cleaning up connection for ${symbol}`);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      isConnectedRef.current = false;
      shouldStopReconnectRef.current = false; // ✅ Reset flag on cleanup
    };
  }, [symbol, enabled]); // ✅ Depend on both symbol AND enabled

  return progress;
};
