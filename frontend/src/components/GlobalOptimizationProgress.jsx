import { useOptimizationContext } from "../contexts/OptimizationContext";
import { OptimizationProgressCard } from "../components/comparison/OptimizationProgressCard";
import { useOptimizationEstimate } from "../hooks/useOptimization";
import { cancelOptimization } from "../services/api.service";
import { useState } from "react";

export function GlobalOptimizationProgress() {
  const {
    isOptimizationActive,
    optimizationSymbol,
    progressData,
    stopOptimization,
  } = useOptimizationContext();

  const [isCancelling, setIsCancelling] = useState(false);

  const { data: estimateData } = useOptimizationEstimate(
    optimizationSymbol || "BTC-USD",
    "1h",
    false
  );

  // ✅ Handle cancel optimization
  const handleCancel = async () => {
    if (!optimizationSymbol || isCancelling) return;

    try {
      setIsCancelling(true);
      console.log(`🛑 Cancelling optimization for ${optimizationSymbol}...`);

      await cancelOptimization(optimizationSymbol);

      console.log(`✅ Cancel request sent successfully`);

      // Don't stop immediately, let SSE handle the cancelled event
      // stopOptimization will be called when SSE receives "cancelled" event
    } catch (err) {
      console.error(`❌ Failed to cancel optimization:`, err);

      // Force stop on error
      stopOptimization();
    } finally {
      setIsCancelling(false);
    }
  };

  // Jangan render jika tidak ada optimization yang aktif
  if (!isOptimizationActive || !progressData) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full px-4">
      <OptimizationProgressCard
        showEstimateProgress={true}
        estimateData={estimateData}
        progressData={progressData}
        selectedSymbol={optimizationSymbol}
        onClose={stopOptimization}
        onCancel={handleCancel}
      />
    </div>
  );
}
