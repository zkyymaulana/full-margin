import { createContext, useContext, useState, useEffect } from "react";

const SymbolContext = createContext();

const STORAGE_KEY = "selectedSymbol";
const DEFAULT_SYMBOL = "BTC-USD";

// Validasi format simbol pair, contoh: BTC-USD.
const isValidSymbol = (symbol) => {
  if (!symbol || typeof symbol !== "string") return false;
  // Format umum: XXX-USD, ETH-USD, dan variasi pair lain.
  return /^[A-Z0-9]+-[A-Z]+$/.test(symbol);
};

export function SymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidSymbol(stored)) {
        return stored;
      }
    } catch (error) {
      console.error("❌ Error reading symbol from localStorage:", error);
    }
    return DEFAULT_SYMBOL;
  });
  const [isLoading] = useState(false);

  useEffect(() => {
    try {
      if (selectedSymbol && isValidSymbol(selectedSymbol)) {
        // Simpan simbol aktif agar konsisten antar halaman/reload.
        localStorage.setItem(STORAGE_KEY, selectedSymbol);
        console.log("💾 Saved symbol to localStorage:", selectedSymbol);
      }
    } catch (error) {
      console.error("❌ Error saving to localStorage:", error);
    }
  }, [selectedSymbol]);

  // Update simbol aktif dari UI.
  const updateSelectedSymbol = (newSymbol) => {
    if (isValidSymbol(newSymbol)) {
      setSelectedSymbol(newSymbol);
    } else {
      console.error("❌ Invalid symbol format:", newSymbol);
      // Perilaku lama dipertahankan: tetap set meskipun format tidak valid.
      setSelectedSymbol(newSymbol);
    }
  };

  // Reset simbol ke default dan bersihkan penyimpanan lokal.
  const resetSymbol = async () => {
    try {
      // Selalu reset ke simbol default.
      setSelectedSymbol(DEFAULT_SYMBOL);
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Symbol reset to default:", DEFAULT_SYMBOL);
    } catch (error) {
      console.error("❌ Error resetting symbol:", error);
      setSelectedSymbol(DEFAULT_SYMBOL);
    }
  };

  // Value context yang dikonsumsi komponen turunan.
  const value = {
    selectedSymbol,
    setSelectedSymbol: updateSelectedSymbol,
    resetSymbol,
    isLoading,
  };

  return (
    <SymbolContext.Provider value={value}>{children}</SymbolContext.Provider>
  );
}

export function useSymbol() {
  const context = useContext(SymbolContext);
  if (!context) {
    throw new Error("useSymbol must be used within a SymbolProvider");
  }
  return context;
}
