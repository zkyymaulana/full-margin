import { useState, useEffect, useRef } from "react";
import { useComparison } from "../hooks/useComparison";
import { useSymbol } from "../contexts/SymbolContext";
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

const DATASET_START_DATE = "2020-01-01";

// Halaman comparison: mengatur alur input tanggal, eksekusi compare, dan render hasil.
function ComparisonPage() {
  const { selectedSymbol } = useSymbol();
  const queryClient = useQueryClient();

  // Track simbol yang sedang aktif saat comparison dijalankan
  const comparedSymbolRef = useRef(null);

  // Ubah objek Date menjadi format YYYY-MM-DD untuk input date.
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const [startDate, setStartDate] = useState(formatDate(oneYearAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [displayData, setDisplayData] = useState(null);

  const minHistoricalDate = DATASET_START_DATE;

  const maxSelectableDate = formatDate(today);

  const {
    mutate: compare,
    data: comparisonData,
    isLoading,
    isPending,
    error,
    reset: resetComparison,
  } = useComparison();

  // ✅ Reset semua hasil saat simbol berubah
  useEffect(() => {
    setDisplayData(null);
    resetComparison();
    queryClient.removeQueries({ queryKey: ["comparison"] });
    comparedSymbolRef.current = null;
  }, [selectedSymbol]);

  // ✅ Simpan hasil ke state lokal HANYA jika simbol hasil = simbol aktif saat ini
  useEffect(() => {
    if (!comparisonData?.success) return;

    if (comparedSymbolRef.current !== selectedSymbol) {
      console.warn(
        `[Comparison] Ignoring stale result — result is for "${comparedSymbolRef.current}", current symbol is "${selectedSymbol}"`,
      );
      return;
    }

    setDisplayData(comparisonData);
  }, [comparisonData]);

  useEffect(() => {
    if (!minHistoricalDate) return;

    if (startDate < minHistoricalDate) {
      setStartDate(minHistoricalDate);
    }

    if (endDate < minHistoricalDate) {
      setEndDate(minHistoricalDate);
    }
  }, [minHistoricalDate, startDate, endDate]);

  // Jalankan comparison berdasarkan simbol aktif dan rentang tanggal.
  const handleCompare = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end date");
      return;
    }

    // Catat simbol mana yang sedang di-compare
    comparedSymbolRef.current = selectedSymbol;

    // Reset hasil lama agar UI hanya menampilkan hasil terbaru.
    setDisplayData(null);
    compare({ symbol: selectedSymbol, startDate, endDate });
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <ComparisonHeader />

      <BacktestParametersForm
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        minDate={minHistoricalDate}
        maxDate={maxSelectableDate}
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

export { ComparisonPage };
export default ComparisonPage;
