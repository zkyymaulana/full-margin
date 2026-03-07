import { useState, useEffect } from "react";
import { useComparison } from "../hooks/useComparison";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useQueryClient } from "@tanstack/react-query";

// Import modular components
import {
  ComparisonHeader,
  BacktestParametersForm,
  ErrorDisplay,
  LoadingState,
} from "../components/comparison";

// Import results components
import { ComparisonResults } from "../components/comparison/results";

function ComparisonPage() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const queryClient = useQueryClient();

  // ✅ FIXED: Get today's date for end date
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState(getTodayDate());
  const [threshold, setThreshold] = useState(0.4); // ✅ NEW: Default threshold 0.4 (Moderate)

  const {
    mutate: compare,
    data: comparisonData,
    isLoading,
    isPending,
    error,
  } = useComparison();

  // ...existing useEffect hooks...
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

  const handleCompare = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end date");
      return;
    }

    // ✅ MODIFIED: Include threshold in compare request
    compare({
      symbol: selectedSymbol,
      startDate,
      endDate,
      threshold, // ✅ Send threshold to backend
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <ComparisonHeader />

      <BacktestParametersForm
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        threshold={threshold}
        setThreshold={setThreshold}
        handleCompare={handleCompare}
        isLoading={isLoading}
        isPending={isPending}
      />

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
