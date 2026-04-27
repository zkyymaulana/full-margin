import { useIndicator } from "../hooks/useIndicators";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { useOptimizationEstimate } from "../hooks/useOptimization";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  cancelOptimization,
  getOptimizationStatus,
} from "../services/api.service";

// Import components
import {
  SignalsHeader,
  MultiIndicatorPanel,
  CategorySummaryCard,
  IndicatorTable,
  BacktestPanel,
} from "../components/signals";
import { OptimizationProgressCard } from "../components/comparison";

// Import utils
import {
  parseIndicators,
  parseIndicatorsDetailed,
  normalizeIndicatorName,
  countSignalsFromDB,
} from "../utils/indicatorParser";
import { FiActivity, FiTrendingUp, FiZap } from "react-icons/fi";

// Halaman sinyal: tampilkan hasil indikator terpadu + alur optimasi bobot.
function SignalsPage() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();

  // Context global untuk status optimasi SSE lintas halaman.
  const {
    startOptimization,
    stopOptimization,
    clearAllProgress,
    progressData,
    optimizationSymbol,
  } = useOptimizationContext();

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCompletedCard, setShowCompletedCard] = useState(false);

  // Ambil data indikator terbaru dari endpoint terpadu (mode latest).
  const {
    data: indicatorData,
    isLoading,
    error,
    // Refetch dipakai setelah optimasi selesai.
    refetch: refetchIndicatorData,
  } = useIndicator(selectedSymbol, "latest", "1h");
  console.log({ indicatorData });

  // Ambil estimasi durasi optimasi saat user akan menjalankan optimize.
  const { data: estimateData, refetch: refetchEstimate } =
    useOptimizationEstimate(selectedSymbol, "1h", false);

  const isOptimizationRunning =
    progressData?.status === "running" || progressData?.status === "waiting";
  const isOptimizationCompleted = progressData?.status === "completed";
  const isOptimizationCancelled = progressData?.status === "cancelled";

  // Refresh data indikator otomatis ketika optimasi selesai.
  useMemo(() => {
    if (isOptimizationCompleted && optimizationSymbol === selectedSymbol) {
      console.log("✅ Optimization completed - refreshing data...");
      setShowCompletedCard(true);

      // Beri jeda agar backend selesai menyimpan data terbaru.
      setTimeout(() => {
        refetchIndicatorData();
        console.log("🔄 Data refreshed after optimization");
      }, 1000);
    }
  }, [
    isOptimizationCompleted,
    optimizationSymbol,
    selectedSymbol,
    refetchIndicatorData,
  ]);

  // Pastikan kartu status selesai tetap ditampilkan setelah optimize complete.
  useMemo(() => {
    if (isOptimizationCompleted) {
      console.log("✅ Optimization completed - keeping card visible");
      setShowCompletedCard(true);
    }
  }, [isOptimizationCompleted]);

  // Parse payload latestSignal menjadi format UI yang mudah dirender.
  const {
    parsedIndicators,
    parsedIndicatorsDetailed,
    categoryScores,
    multiSignalData,
    latestPrice,
    latestTime,
    weights,
    performance,
    timeframe,
    signalCounts,
  } = useMemo(() => {
    const latestSignal = indicatorData?.latestSignal;
    console.log({ latestSignal });

    if (!latestSignal) {
      console.warn("⚠️ No latestSignal available");
      return {
        parsedIndicators: { trend: [], momentum: [], volatility: [] },
        parsedIndicatorsDetailed: { trend: [], momentum: [], volatility: [] },
        categoryScores: { trend: 0, momentum: 0, volatility: 0 },
        multiSignalData: {
          signal: "neutral",
          strength: 0,
          finalScore: 0,
          signalLabel: "NEUTRAL",
          signalEmoji: "⚪",
        },
        latestPrice: null,
        latestTime: null,
        weights: {},
        performance: null,
        timeframe: "1h",
        signalCounts: { buy: 0, sell: 0, neutral: 0 },
        isOptimized: false,
      };
    }

    const {
      indicators,
      categoryScores: scores,
      weights: weightsData,
      performance: performanceData,
      multiSignal: signalData,
      price,
      time,
    } = latestSignal;

    // Cek apakah bobot/performance sudah tersedia dari hasil optimasi.
    const hasOptimization = !!(
      performanceData &&
      weightsData &&
      Object.keys(weightsData).length > 0
    );

    // Hitung distribusi sinyal untuk statistik ringkas.
    const counts = countSignalsFromDB(indicators);

    console.log("✅ [SIGNALS PAGE] Multi Signal Data:", signalData);
    console.log("🔍 [DEBUG] Has Optimization:", hasOptimization);
    console.log("📊 Signal Counts:", counts);

    // Jika belum optimize, bobot dibuat null agar UI menampilkan status yang tepat.
    const finalWeights = hasOptimization ? weightsData : null;

    const parsed = parseIndicators(indicators, price, finalWeights);
    const detailedParsed = parseIndicatorsDetailed(
      indicators,
      price,
      finalWeights,
    );

    return {
      parsedIndicators: parsed,
      parsedIndicatorsDetailed: detailedParsed,
      categoryScores: scores || { trend: 0, momentum: 0, volatility: 0 },
      multiSignalData: signalData || {
        signal: "neutral",
        strength: 0,
        finalScore: 0,
        signalLabel: "NEUTRAL",
        signalEmoji: "⚪",
      },
      latestPrice: price,
      latestTime: time,
      weights: finalWeights || {},
      performance: performanceData,
      timeframe: indicatorData?.timeframe || "1h",
      signalCounts: counts,
      isOptimized: hasOptimization,
    };
  }, [indicatorData]);

  // Handle klik tombol optimize: ambil estimate lalu minta konfirmasi user.
  const handleOptimization = async () => {
    const { data: estimate } = await refetchEstimate();

    if (!estimate?.success) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Failed to calculate optimization estimate",
      });
      return;
    }

    const estimateInfo = estimate.estimate;

    Swal.fire({
      title: "Start Optimization?",
      text: `Estimated time: ${estimateInfo.formatted}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, start it!",
    }).then((result) => {
      if (result.isConfirmed) {
        confirmOptimization();
      }
    });
  };

  // Jalankan proses optimasi dan buka stream SSE jika job berjalan.
  const confirmOptimization = async () => {
    try {
      const token = localStorage.getItem("authToken");

      if (!token) {
        throw new Error("Authentication required. Please login again.");
      }

      console.log("🔑 Starting optimization process...");

      const controller = new AbortController();
      // Beri waktu backend untuk create job sebelum request di-abort.
      const quickCheckTimeout = setTimeout(() => controller.abort(), 5000);

      // Flag ini menentukan apakah UI perlu membuka koneksi SSE.
      let shouldOpenSSE = false;

      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/multiIndicator/${selectedSymbol}/optimize-weights?timeframe=1h`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        clearTimeout(quickCheckTimeout);

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 403) {
            localStorage.removeItem("authToken");
            throw new Error("Session expired. Please login again.");
          }
          throw new Error(data.message || "Optimization failed");
        }

        // Jika backend menerima job (running/waiting), langsung buka SSE.
        if (
          data?.running === true ||
          ["running", "waiting"].includes(data?.status)
        ) {
          shouldOpenSSE = true;
        }

        if (data.success && data.lastOptimized) {
          const lastOptimizedDate = new Date(data.lastOptimized);
          const formattedDate = lastOptimizedDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          Swal.fire({
            title: "Already Optimized!",
            text: `${selectedSymbol} was last optimized on ${formattedDate}. ROI: ${data.performance?.roi?.toFixed(
              2,
            )}%`,
            icon: "info",
          });

          shouldOpenSSE = false;
        } else if (data.success && !data.lastOptimized) {
          // Respons sukses non-final dianggap proses berjalan di background.
          shouldOpenSSE = true;
        }
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          // Verifikasi job optimize sudah terdaftar sebelum membuka SSE.
          try {
            const status = await getOptimizationStatus(selectedSymbol);
            shouldOpenSSE =
              status?.success &&
              ["running", "waiting", "completed"].includes(status.status);
          } catch {
            // Fallback aman: tetap buka SSE agar status awal bisa terbaca.
            shouldOpenSSE = true;
          }
        } else {
          throw fetchError;
        }
      }

      if (shouldOpenSSE) {
        console.log("📡 Opening SSE connection for real-time progress...");
        startOptimization(selectedSymbol);
      }
    } catch (error) {
      console.error("❌ Optimization error:", error);

      if (error.message?.includes("login again")) {
        Swal.fire({
          icon: "error",
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          confirmButtonColor: "#3085d6",
        }).then(() => {
          window.location.href = "/login";
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Optimization Failed",
          text: error.message || "Failed to start optimization",
        });
      }
    }
  };

  // Handle pembatalan optimasi aktif.
  const handleCancelOptimization = async () => {
    if (!optimizationSymbol || isCancelling) return;

    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to cancel this optimization?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, cancel it!",
      cancelButtonText: "No, continue",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setIsCancelling(true);
          console.log(
            `🛑 Cancelling optimization for ${optimizationSymbol}...`,
          );

          // Kirim request cancel ke backend.
          await cancelOptimization(optimizationSymbol);

          console.log(`✅ Cancel request sent successfully`);

          // Tutup stream SSE di frontend agar status berhenti segera.
          stopOptimization();

          // Sembunyikan kartu progres setelah cancel.
          setShowCompletedCard(false);

          // Notifikasi sukses cancel.
          Swal.fire({
            icon: "success",
            title: "Cancelled!",
            text: "Optimization has been cancelled successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        } catch (err) {
          console.error(`❌ Failed to cancel optimization:`, err);
          Swal.fire({
            icon: "error",
            title: "Cancel Failed",
            text: err.message || "Failed to cancel optimization",
          });

          // Meskipun gagal, hentikan stream lokal agar UI tidak menggantung.
          stopOptimization();
          setShowCompletedCard(false);
        } finally {
          setIsCancelling(false);
        }
      }
    });
  };

  // Handle tombol close pada kartu progress.
  const handleCloseProgressCard = () => {
    console.log("❌ User closed progress card - clearing all data");
    setShowCompletedCard(false);
    clearAllProgress();
  };

  // Tentukan kategori aktif berdasarkan bobot indikator.
  const activeCategories = useMemo(() => {
    const w = weights || {};
    return {
      trend: (w.SMA || 0) + (w.EMA || 0) + (w.PSAR || 0) > 0,
      momentum:
        (w.RSI || 0) +
          (w.MACD || 0) +
          (w.Stochastic || 0) +
          (w.StochasticRSI || 0) >
        0,
      volatility: (w.BollingerBands || 0) > 0,
    };
  }, [weights]);

  // Bangun label kombinasi strategi terbaik untuk header.
  const bestCombo = useMemo(() => {
    const activeCombos = [];
    if (activeCategories.trend) activeCombos.push("Trend");
    if (activeCategories.momentum) activeCombos.push("Momentum");
    if (activeCategories.volatility) activeCombos.push("Volatility");
    return activeCombos.length > 0
      ? activeCombos.join(" + ")
      : "No Active Strategy";
  }, [activeCategories]);

  // Format waktu update terakhir untuk ditampilkan di UI.
  const lastUpdate = latestTime
    ? new Date(latestTime).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A";

  // 🔄 Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
            Loading signals...
          </div>
        </div>
      </div>
    );
  }

  // ❌ Error State
  if (error) {
    return (
      <div
        className={`p-4 border rounded-lg ${
          isDarkMode
            ? "bg-red-900 border-red-600 text-red-300"
            : "bg-red-100 border-red-400 text-red-700"
        }`}
      >
        <p className="font-semibold">Error loading signals</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // All indicators for table (using detailed parse)
  const allIndicatorsRaw = [
    ...parsedIndicatorsDetailed.trend.map((ind) => ({
      ...ind,
      category: "Trend",
    })),
    ...parsedIndicatorsDetailed.momentum.map((ind) => ({
      ...ind,
      category: "Momentum",
    })),
    ...parsedIndicatorsDetailed.volatility.map((ind) => ({
      ...ind,
      category: "Volatility",
    })),
  ];

  // Normalize indicator names for cleaner display
  const allIndicators = normalizeIndicatorName(allIndicatorsRaw);

  return (
    <div className="space-y-6">
      {/* Header Section with Optimization Button */}
      <SignalsHeader
        selectedSymbol={selectedSymbol}
        methodology="Weighted Multi-Indicator Strategy"
        lastUpdate={lastUpdate}
        price={latestPrice}
        timeframe={timeframe}
        bestCombo={bestCombo}
        isDarkMode={isDarkMode}
        onOptimize={handleOptimization} // ✅ Pass handler
        isOptimizing={isOptimizationRunning} // ✅ Pass status
      />

      {/* ✅ NEW: Optimization Progress Card */}
      {(isOptimizationRunning ||
        isOptimizationCompleted ||
        isOptimizationCancelled ||
        showCompletedCard) &&
        progressData && (
          <OptimizationProgressCard
            showEstimateProgress={true}
            estimateData={estimateData}
            progressData={progressData}
            selectedSymbol={optimizationSymbol}
            onClose={handleCloseProgressCard}
            onCancel={handleCancelOptimization}
          />
        )}

      {/* Category Summary Cards - 3 Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CategorySummaryCard
          title="Trend Indicators"
          indicators={parsedIndicators.trend}
          color={
            isDarkMode
              ? "bg-blue-900 text-blue-300"
              : "bg-blue-100 text-blue-700"
          }
          isDarkMode={isDarkMode}
          icon={
            <FiTrendingUp
              className={`text-xl ${
                isDarkMode ? "text-blue-300" : "text-blue-700"
              }`}
            />
          }
        />
        <CategorySummaryCard
          title="Momentum Indicators"
          indicators={parsedIndicators.momentum}
          color={
            isDarkMode
              ? "bg-purple-900 text-purple-300"
              : "bg-purple-100 text-purple-700"
          }
          isDarkMode={isDarkMode}
          icon={
            <FiActivity
              className={`text-xl ${
                isDarkMode ? "text-purple-300" : "text-purple-700"
              }`}
            />
          }
        />
        <CategorySummaryCard
          title="Volatility Indicators"
          indicators={parsedIndicators.volatility}
          color={
            isDarkMode
              ? "bg-green-900 text-green-300"
              : "bg-green-100 text-green-700"
          }
          isDarkMode={isDarkMode}
          icon={
            <FiZap
              className={`text-xl ${
                isDarkMode ? "text-green-300" : "text-green-700"
              }`}
            />
          }
        />
      </div>

      {/* Backtest Performance Panel */}
      <BacktestPanel
        performance={performance}
        bestCombo={bestCombo}
        isDarkMode={isDarkMode}
      />

      {/* Bottom Section: Indicator Table & Multi Indicator Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IndicatorTable allIndicators={allIndicators} isDarkMode={isDarkMode} />
        <MultiIndicatorPanel
          multiSignalData={multiSignalData}
          categoryScores={categoryScores}
          activeCategories={activeCategories}
          parsedIndicators={parsedIndicators}
          signalCounts={signalCounts}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}

export { SignalsPage };
export default SignalsPage;
