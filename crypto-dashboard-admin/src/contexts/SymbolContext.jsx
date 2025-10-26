import { createContext, useContext, useState, useEffect } from "react";

const SymbolContext = createContext();

const DEFAULT_SYMBOL = "BTC-USD";

const STORAGE_KEY = "selectedSymbol";

const isValidSymbol = (symbol) => {
  if (!symbol || typeof symbol !== "string") return false;
  // Format: XXX-USD (misal: BTC-USD, ETH-USD)
  return /^[A-Z0-9]+-USD$/.test(symbol);
};

export function SymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored && isValidSymbol(stored)) {
        return stored;
      }

      console.log("⚠️ No valid symbol found, using default:", DEFAULT_SYMBOL);
      return DEFAULT_SYMBOL;
    } catch (error) {
      console.error("❌ Error reading localStorage:", error);
      return DEFAULT_SYMBOL;
    }
  });

  useEffect(() => {
    try {
      if (isValidSymbol(selectedSymbol)) {
        localStorage.setItem(STORAGE_KEY, selectedSymbol);
        console.log("💾 Saved symbol to localStorage:", selectedSymbol);
      } else {
        console.warn("⚠️ Invalid symbol format, not saving:", selectedSymbol);
      }
    } catch (error) {
      console.error("❌ Error saving to localStorage:", error);
    }
  }, [selectedSymbol]);

  const updateSelectedSymbol = (newSymbol) => {
    if (isValidSymbol(newSymbol)) {
      setSelectedSymbol(newSymbol);
    } else {
      console.error("❌ Invalid symbol format:", newSymbol);
      // Tetap set, tapi log warning
      setSelectedSymbol(newSymbol);
    }
  };

  const resetSymbol = () => {
    setSelectedSymbol(DEFAULT_SYMBOL);
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Symbol reset to default");
    } catch (error) {
      console.error("❌ Error removing from localStorage:", error);
    }
  };

  const value = {
    selectedSymbol,
    setSelectedSymbol: updateSelectedSymbol,
    resetSymbol,
    defaultSymbol: DEFAULT_SYMBOL,
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
