import { createContext, useContext, useState, useEffect } from "react";

const SymbolContext = createContext();

const STORAGE_KEY = "selectedSymbol";
const DEFAULT_SYMBOL = "BTC-USD";

const isValidSymbol = (symbol) => {
  if (!symbol || typeof symbol !== "string") return false;
  // Format: XXX-USD atau XXX-EUR (misal: BTC-USD, ETH-USD)
  return /^[A-Z0-9]+-[A-Z]+$/.test(symbol);
};

export function SymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Default first login selalu BTC-USD agar konsisten
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      // Jika ada di localStorage dan valid, gunakan itu
      if (stored && isValidSymbol(stored)) {
        setSelectedSymbol(stored);
      } else {
        setSelectedSymbol(DEFAULT_SYMBOL);
      }
    } catch (error) {
      console.error("❌ Error reading symbol from localStorage:", error);
      setSelectedSymbol(DEFAULT_SYMBOL);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      if (selectedSymbol && isValidSymbol(selectedSymbol)) {
        localStorage.setItem(STORAGE_KEY, selectedSymbol);
        console.log("💾 Saved symbol to localStorage:", selectedSymbol);
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

  const resetSymbol = async () => {
    try {
      // ✅ Reset ke default tetap
      setSelectedSymbol(DEFAULT_SYMBOL);
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Symbol reset to default:", DEFAULT_SYMBOL);
    } catch (error) {
      console.error("❌ Error resetting symbol:", error);
      setSelectedSymbol(DEFAULT_SYMBOL);
    }
  };

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
