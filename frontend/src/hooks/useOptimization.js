import { useMutation, useQuery } from "@tanstack/react-query";
import api, {
  forceReoptimization,
  requestOptimization,
} from "../services/api.service";
import { useState, useEffect, useRef } from "react";

const MAX_SSE_RETRIES = 8;

// Hook untuk menjalankan optimasi bobot indikator.
export function useOptimization() {
  return useMutation({
    mutationFn: async ({ symbol, timeframe = "1h" }) => {
      // Panggil service optimasi dengan timeout panjang dari API layer.
      return await requestOptimization(symbol, timeframe);
    },
    onSuccess: (data) => {
      console.log("✅ Optimization completed:", data);
    },
    onError: (error) => {
      console.error("❌ Optimization failed:", error);
      // Log error detail untuk mempermudah debugging.
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

// Hook untuk memaksa re-optimasi full meskipun bobot lama sudah ada.
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

// Hook untuk mengambil estimasi durasi optimasi sebelum proses dijalankan.
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
    staleTime: 5 * 60 * 1000, // Data estimasi dianggap fresh 5 menit.
    cacheTime: 10 * 60 * 1000, // Simpan cache estimasi 10 menit.
    retry: 2,
  });
}

// Hook pemantauan progres optimasi berbasis Server-Sent Events (SSE).
// Koneksi SSE hanya aktif jika `enabled` bernilai true.
export const useOptimizationProgress = (symbol, enabled = false) => {
  const [progress, setProgress] = useState(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const eventSourceRef = useRef(null);
  const isConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  // Menandai koneksi ditutup manual agar state bisa dibersihkan dengan benar.
  const manualCloseRef = useRef(false);

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

    // Buka koneksi hanya jika fitur aktif dan simbol tersedia.
    if (!enabled || !symbol) {
      console.log(`⏹️ [SSE] Connection disabled or no symbol provided`);

      // Saat dinonaktifkan manual, progres dibersihkan agar UI kembali netral.
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

    // Cegah duplikasi koneksi SSE untuk simbol yang sama.
    if (isConnectedRef.current && eventSourceRef.current) {
      console.log(
        `⚠️ [SSE] Already connected for ${symbol}, skipping duplicate connection`,
      );
      return;
    }

    // Batalkan jadwal reconnect lama sebelum membuat koneksi baru.
    clearReconnectTimeout();

    // Ambil token auth untuk akses endpoint stream.
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.error(`❌ [SSE] No auth token found`);
      return;
    }

    // Bangun URL SSE lalu buka koneksi EventSource.
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

      // Event saat koneksi berhasil dibuka.
      eventSource.onopen = () => {
        console.log(`✅ [SSE] Connection opened for ${symbol}`);
        retryCountRef.current = 0;
      };

      // Tangani semua pesan SSE (termasuk pesan default tanpa nama event).
      eventSource.onmessage = (event) => {
        // Abaikan heartbeat agar tidak mengganggu logika progres.
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

          // Proses payload berdasarkan jenis event.
          switch (eventType) {
            case "status":
              // Event status bersifat informasi, set tampilan menunggu.
              console.log(
                `ℹ️ [SSE] Status: ${data.status} - ${data.message || ""}`,
              );

              // Jangan menimpa state terminal (completed/cancelled/error).
              if (["completed", "cancelled", "error"].includes(data.status)) {
                const mappedStatus = mapStatusToProgress({
                  success: true,
                  status: data.status,
                  error: data.message,
                });
                if (mappedStatus) {
                  setProgress(mappedStatus);
                }
                break;
              }

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

              // Inisialisasi state running + metadata dataset.
              setProgress({
                current: 0,
                total: data.totalCombinations || 390625,
                percentage: 0,
                bestROI: 0,
                etaFormatted: "Starting...",
                status: "running",
                dataPoints: data.dataPoints,
                datasetRange: data.datasetRange,
              });
              break;

            case "progress":
              // Update state progres dari payload terbaru.
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
                // Pertahankan metadata awal jika payload progress tidak mengirim ulang.
                dataPoints: dataPoints || prev?.dataPoints,
                datasetRange: datasetRange || prev?.datasetRange,
              }));

              // Log milestone setiap 10% untuk membantu monitoring.
              if (percentage % 10 === 0 || tested === total) {
                console.log(
                  `📈 [SSE] Progress: ${tested}/${total} (${percentage}%) | Best: ${bestROI}% | ETA: ${eta}`,
                );
              }
              break;

            case "cancelled":
              console.log(`🛑 [SSE] Optimization cancelled:`, data);

              // Tidak tampilkan modal; langsung bersihkan state progres.
              setProgress(null);

              // Tutup koneksi secepatnya agar tidak ada event lanjutan.
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
                isConnectedRef.current = false;
              }
              break;

            case "completed":
              console.log(`✅ [SSE] Optimization completed:`, data);

              // Set state final selesai.
              setProgress({
                current: data.performance?.totalCombinations || 390625,
                total: data.performance?.totalCombinations || 390625,
                percentage: 100,
                bestROI: data.performance?.roi || 0,
                etaFormatted: "Completed!",
                status: "completed",
              });

              // Bersihkan progres 3 detik setelah selesai.
              setTimeout(() => {
                console.log(`🧹 [SSE] Cleaning up after completion`);
                setProgress(null);
                closeEventSource();
              }, 3000);
              break;

            case "error":
              console.error(`❌ [SSE] Backend error:`, data.message);

              // Saat error backend, progres dihentikan lalu koneksi ditutup.
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

      // Tangani error koneksi SSE (termasuk strategi reconnect).
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

    // Cleanup saat komponen unmount atau simbol berubah.
    return () => {
      console.log(`🔌 [SSE] Cleaning up connection for ${symbol}`);
      isMountedRef.current = false;

      clearReconnectTimeout();
      closeEventSource();
      retryCountRef.current = 0;
    };
  }, [symbol, enabled, reconnectNonce]);

  return progress;
};
