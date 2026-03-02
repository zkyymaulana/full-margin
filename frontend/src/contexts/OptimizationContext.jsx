import { createContext, useContext, useState, useEffect } from "react";
import { useOptimizationProgress } from "../hooks/useOptimization";

const OptimizationContext = createContext();

export function OptimizationProvider({ children }) {
  const [isOptimizationActive, setIsOptimizationActive] = useState(false);
  const [optimizationSymbol, setOptimizationSymbol] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [forceCloseProgress, setForceCloseProgress] = useState(false); // ✅ NEW: Flag to force clear progress

  // SSE Progress hook - tetap running meskipun pindah halaman
  const progressData = useOptimizationProgress(
    optimizationSymbol,
    isOptimizationActive
  );

  // ✅ Force clear progress when forceCloseProgress is true
  const displayProgressData = forceCloseProgress ? null : progressData;

  // Auto-close optimization ketika completed
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
    setForceCloseProgress(false); // ✅ Reset flag
  };

  const stopOptimization = () => {
    console.log("🛑 Stopping global optimization");
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
    setForceCloseProgress(true); // ✅ Force clear progress display
  };

  const clearOptimizationResult = () => {
    setOptimizationResult(null);
  };

  return (
    <OptimizationContext.Provider
      value={{
        isOptimizationActive,
        optimizationSymbol,
        progressData: displayProgressData, // ✅ Use filtered progress data
        optimizationResult,
        startOptimization,
        stopOptimization,
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
