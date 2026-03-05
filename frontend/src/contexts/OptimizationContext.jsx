import { createContext, useContext, useState, useEffect } from "react";
import { useOptimizationProgress } from "../hooks/useOptimization";

const OptimizationContext = createContext();

export function OptimizationProvider({ children }) {
  const [isOptimizationActive, setIsOptimizationActive] = useState(false);
  const [optimizationSymbol, setOptimizationSymbol] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [lastProgressData, setLastProgressData] = useState(null); // ✅ MODIFIED: Keep last progress data even after stopping

  // SSE Progress hook - tetap running meskipun pindah halaman
  const progressData = useOptimizationProgress(
    optimizationSymbol,
    isOptimizationActive
  );

  // ✅ Update lastProgressData whenever progressData changes
  useEffect(() => {
    if (progressData) {
      setLastProgressData(progressData);
    }
  }, [progressData]);

  // ✅ Display last known progress data if current is null
  const displayProgressData = progressData || lastProgressData;

  // Auto-store result when completed
  useEffect(() => {
    if (progressData?.status === "completed") {
      console.log("✅ Optimization completed, storing result");
      setOptimizationResult(progressData);
      // Jangan auto-close, biarkan user yang tutup manual
    }
  }, [progressData]);

  const startOptimization = (symbol) => {
    console.log(`🚀 Starting global optimization for ${symbol}`);
    setOptimizationSymbol(symbol);
    setIsOptimizationActive(true);
    setOptimizationResult(null);
    // ✅ Don't clear lastProgressData yet - will be updated by new progress
  };

  const stopOptimization = () => {
    console.log("🛑 Stopping global optimization");
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
    // ✅ CRITICAL FIX: Don't clear lastProgressData here!
    // It will remain visible until explicitly cleared
  };

  // ✅ NEW: Function to completely clear everything
  const clearAllProgress = () => {
    console.log("🧹 Clearing all progress data");
    setLastProgressData(null);
    setOptimizationResult(null);
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
  };

  const clearOptimizationResult = () => {
    setOptimizationResult(null);
  };

  return (
    <OptimizationContext.Provider
      value={{
        isOptimizationActive,
        optimizationSymbol,
        progressData: displayProgressData, // ✅ Now includes lastProgressData
        optimizationResult,
        startOptimization,
        stopOptimization,
        clearAllProgress, // ✅ NEW: Exposed for manual cleanup
        clearOptimizationResult,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  );
}

export function useOptimizationContext() {
  const context = useContext(OptimizationContext);
  if (!context) {
    throw new Error(
      "useOptimizationContext must be used within OptimizationProvider"
    );
  }
  return context;
}
