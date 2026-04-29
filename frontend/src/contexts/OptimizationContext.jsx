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
      setOptimizationResult(progressData);
      // Jangan auto-close, biarkan user menutup panel secara manual.
    }
  }, [progressData]);

  // Tutup mode optimasi otomatis saat status terminal agar UI tidak stuck "Optimizing...".
  useEffect(() => {
    const status = progressData?.status;
    if (!isOptimizationActive) return;
    if (!["completed", "cancelled", "error"].includes(status)) return;

    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
  }, [progressData, isOptimizationActive]);

  // Mulai optimasi untuk simbol tertentu.
  const startOptimization = (symbol) => {
    setOptimizationSymbol(symbol);
    setIsOptimizationActive(true);
    setOptimizationResult(null);
    // Snapshot lama tidak langsung dihapus; akan diganti oleh progres baru.
  };

  // Hentikan optimasi global dan bersihkan state terkait.
  const stopOptimization = () => {
    setIsOptimizationActive(false);
    setOptimizationSymbol(null);
    // Saat stop manual, progres lama langsung dibersihkan.
    setLastProgressData(null);
  };

  // Bersihkan seluruh state optimasi (progres + hasil + simbol).
  const clearAllProgress = () => {
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
