import { createContext, useContext, useState, useEffect } from "react";
import { useOptimizationProgress } from "../hooks/useOptimization";

const OptimizationContext = createContext();

export function OptimizationProvider({ children }) {
  const [isOptimizationActive, setIsOptimizationActive] = useState(false);
  const [optimizationSymbol, setOptimizationSymbol] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  // Simpan progres terakhir agar UI tetap bisa menampilkan status terbaru.
  const [lastProgressData, setLastProgressData] = useState(null);

  // Hook SSE untuk membaca progres optimasi global.
  const progressData = useOptimizationProgress(
    optimizationSymbol,
    isOptimizationActive,
  );

  // Simpan snapshot progres setiap ada update baru.
  useEffect(() => {
    if (progressData) {
      setLastProgressData(progressData);
    }
  }, [progressData]);

  // Jika progres real-time null, pakai snapshot terakhir.
  const displayProgressData = progressData || lastProgressData;

  // Simpan hasil saat status selesai.
  useEffect(() => {
    if (progressData?.status === "completed") {
      console.log("✅ Optimization completed, storing result");
      setOptimizationResult(progressData);
      // Jangan auto-close, biarkan user menutup panel secara manual.
    }
  }, [progressData]);

  // Mulai optimasi untuk simbol tertentu.
  const startOptimization = (symbol) => {
    console.log(`🚀 Starting global optimization for ${symbol}`);
    setOptimizationSymbol(symbol);
    setIsOptimizationActive(true);
    setOptimizationResult(null);
    // Snapshot lama tidak langsung dihapus; akan diganti oleh progres baru.
  };

  // Hentikan optimasi global dan bersihkan state terkait.
  const stopOptimization = () => {
    console.log("🛑 Stopping global optimization");
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
    // Saat stop manual, progres lama langsung dibersihkan.
    setLastProgressData(null);
  };

  // Bersihkan seluruh state optimasi (progres + hasil + simbol).
  const clearAllProgress = () => {
    console.log("🧹 Clearing all progress data");
    setLastProgressData(null);
    setOptimizationResult(null);
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
  };

  // Hapus hasil optimasi tanpa mengubah state lain.
  const clearOptimizationResult = () => {
    setOptimizationResult(null);
  };

  return (
    <OptimizationContext.Provider
      value={{
        isOptimizationActive,
        optimizationSymbol,
        // Nilai ini bisa berasal dari stream aktif atau snapshot terakhir.
        progressData: displayProgressData,
        optimizationResult,
        startOptimization,
        stopOptimization,
        clearAllProgress,
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
      "useOptimizationContext must be used within OptimizationProvider",
    );
  }
  return context;
}
