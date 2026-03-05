import { useState, useEffect } from "react";
import { useComparison } from "../hooks/useComparison";
import {
  useOptimization,
  useOptimizationEstimate,
} from "../hooks/useOptimization";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { cancelOptimization } from "../services/api.service"; // ✅ NEW

// Import modular components
import {
  ComparisonHeader,
  BacktestParametersForm,
  OptimizationProgressCard,
  ErrorDisplay,
  LoadingState,
} from "../components/comparison";

// Import results components
import { ComparisonResults } from "../components/comparison/results";

function ComparisonPage() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const queryClient = useQueryClient();

  // 🆕 Use global optimization context
  const {
    startOptimization,
    stopOptimization,
    clearAllProgress, // ✅ NEW: Import clearAllProgress
    progressData,
    isOptimizationActive,
    optimizationSymbol,
  } = useOptimizationContext();

  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2025-10-18");
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [showOptimizationNotif, setShowOptimizationNotif] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // ✅ NEW: State untuk keep showing completed card
  const [showCompletedCard, setShowCompletedCard] = useState(false);

  const {
    mutate: compare,
    data: comparisonData,
    isLoading,
    isPending,
    error,
  } = useComparison();

  const {
    data: estimateData,
    isLoading: isEstimateLoading,
    refetch: refetchEstimate,
  } = useOptimizationEstimate(selectedSymbol, "1h", false);

  const { mutate: optimize, error: optimizationError } = useOptimization();

  const isOptimizationRunning =
    progressData?.status === "running" || progressData?.status === "waiting";
  const isOptimizationCompleted = progressData?.status === "completed";
  const isOptimizationCancelled = progressData?.status === "cancelled";

  useEffect(() => {
    if (progressData) {
      console.log("📊 Progress Data Updated:", {
        status: progressData.status,
        percentage: progressData.percentage,
        current: progressData.current,
        total: progressData.total,
      });
    }
  }, [progressData]);

  useEffect(() => {
    console.log("🔄 Loading State:", { isLoading, isPending });
  }, [isLoading, isPending]);

  const cachedData = queryClient.getQueryData(["comparison", selectedSymbol]);

  useEffect(() => {
    if (comparisonData?.success) {
      queryClient.setQueryData(["comparison", selectedSymbol], comparisonData, {
        cacheTime: 30 * 60 * 1000,
      });
    }
  }, [comparisonData, selectedSymbol, queryClient]);

  const displayData = comparisonData || cachedData;

  useEffect(() => {
    if (displayData?.comparison?.bestStrategy) {
      console.log("🏆 Best Strategy:", displayData.comparison.bestStrategy);
      console.log("📊 Comparison Data:", {
        single: displayData.analysis?.bestSingle,
        multi: displayData.comparison?.multi?.roi,
        voting: displayData.comparison?.voting?.roi,
      });
    }
  }, [displayData]);

  // ✅ NEW: Auto-show completed card when optimization finishes
  useEffect(() => {
    if (isOptimizationCompleted) {
      console.log("✅ Optimization completed - keeping card visible");
      setShowCompletedCard(true);
    }
  }, [isOptimizationCompleted]);

  const handleCompare = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end date");
      return;
    }

    compare({
      symbol: selectedSymbol,
      startDate,
      endDate,
    });
  };

  const handleOptimization = async () => {
    // Fetch estimate first
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

    // Show simple SweetAlert
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

  const confirmOptimization = async () => {
    setOptimizationResult(null);
    setShowOptimizationNotif(false);

    try {
      // ✅ Get token from localStorage (KEY: "authToken")
      const token = localStorage.getItem("authToken");

      if (!token) {
        throw new Error("Authentication required. Please login again.");
      }

      console.log("🔑 Starting optimization process...");
      console.log("🔍 Quick check: Does optimization already exist?...");

      // 🆕 STEP 1: Quick check dengan timeout pendek (500ms)
      // Jika response cepat = data sudah ada, jika timeout = perlu optimization baru
      const controller = new AbortController();
      const quickCheckTimeout = setTimeout(() => controller.abort(), 500); // 500ms quick check

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
          }
        );

        clearTimeout(quickCheckTimeout);

        const data = await response.json();
        console.log("✅ Quick check response:", data);

        if (!response.ok) {
          if (response.status === 403) {
            localStorage.removeItem("authToken");
            throw new Error("Session expired. Please login again.");
          }
          throw new Error(data.message || "Optimization failed");
        }

        // ✅ Response cepat < 500ms = Data SUDAH ADA di DB
        if (data.success && data.lastOptimized) {
          const lastOptimizedDate = new Date(data.lastOptimized);
          const formattedDate = lastOptimizedDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          console.log("📌 Optimization already exists in DB - NO SSE needed");

          setOptimizationResult(data);
          setShowOptimizationNotif(true);

          Swal.fire({
            title: "Already Optimized!",
            text: `${selectedSymbol} was last optimized on ${formattedDate}. ROI: ${data.performance?.roi?.toFixed(
              2
            )}%`,
            icon: "info",
          });

          // ❌ JANGAN buka SSE sama sekali
          shouldOpenSSE = false;
        } else {
          // Response cepat tapi tidak ada lastOptimized (unexpected case)
          console.log("⚠️ Quick response without lastOptimized - unusual case");
          shouldOpenSSE = false;
        }
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          // ⏱️ TIMEOUT 500ms - Backend sedang processing = perlu optimization baru
          console.log(
            "⏱️ Quick check timeout (500ms) - Backend is processing optimization"
          );
          shouldOpenSSE = true;
        } else {
          // Error lain (network, auth, dll)
          console.error("❌ Quick check error:", fetchError);
          throw fetchError;
        }
      }

      // 🆕 STEP 2: Buka SSE HANYA jika perlu (timeout terjadi)
      if (shouldOpenSSE) {
        console.log("📡 Opening SSE connection for real-time progress...");
        startOptimization(selectedSymbol);
      }

      setTimeout(() => {
        setShowOptimizationNotif(false);
      }, 10000);
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

  // ✅ NEW: Handle cancel optimization with confirmation
  const handleCancelOptimization = async () => {
    if (!optimizationSymbol || isCancelling) return;

    // ✅ Show SweetAlert2 confirmation dialog
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
      // ✅ Only proceed if user clicks "Yes"
      if (result.isConfirmed) {
        try {
          setIsCancelling(true);
          console.log(
            `🛑 Cancelling optimization for ${optimizationSymbol}...`
          );

          await cancelOptimization(optimizationSymbol);

          console.log(`✅ Cancel request sent successfully`);

          // ✅ NO success modal - just clean up silently
          // Progress card will disappear automatically when SSE receives "cancelled" event
        } catch (err) {
          console.error(`❌ Failed to cancel optimization:`, err);

          Swal.fire({
            icon: "error",
            title: "Cancel Failed",
            text: err.message || "Failed to cancel optimization",
          });

          // Force stop on error
          stopOptimization();
        } finally {
          setIsCancelling(false);
        }
      }
    });
  };

  // ✅ MODIFIED: Handle close with complete cleanup
  const handleCloseProgressCard = () => {
    console.log("❌ User closed progress card - clearing all data");
    setShowCompletedCard(false);
    clearAllProgress(); // ✅ Use clearAllProgress instead of stopOptimization
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <ComparisonHeader />

      <BacktestParametersForm
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        handleOptimization={handleOptimization}
        handleCompare={handleCompare}
        isOptimizationRunning={isOptimizationRunning}
        isLoading={isLoading}
        isPending={isPending}
      />

      {/* ✅ MODIFIED: Show card when running OR completed OR cancelled */}
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

      <ErrorDisplay error={error} isLoading={isLoading} isPending={isPending} />

      <LoadingState
        isLoading={isLoading}
        isPending={isPending}
        selectedSymbol={selectedSymbol}
        startDate={startDate}
        endDate={endDate}
      />

      {displayData?.success && !(isLoading || isPending) && (
        <ComparisonResults displayData={displayData} />
      )}
    </div>
  );
}

export default ComparisonPage;
