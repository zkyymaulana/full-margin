import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const SymbolContext = createContext();

const STORAGE_KEY = "selectedSymbol";

const isValidSymbol = (symbol) => {
  if (!symbol || typeof symbol !== "string") return false;
  // Format: XXX-USD atau XXX-EUR (misal: BTC-USD, ETH-USD)
  return /^[A-Z0-9]+-[A-Z]+$/.test(symbol);
};

export function SymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Fetch default symbol dari database (coin rank #1)
  useEffect(() => {
    async function fetchDefaultSymbol() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);

        // Jika ada di localStorage dan valid, gunakan itu
        if (stored && isValidSymbol(stored)) {
          setSelectedSymbol(stored);
          setIsLoading(false);
          return;
        }

        // ✅ Ambil coin rank #1 dari database
        const API_BASE_URL =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
        const response = await axios.get(`${API_BASE_URL}/api/marketcap/live`);

        if (response.data?.success && response.data?.data?.length > 0) {
          // Ambil coin rank #1 (biasanya Bitcoin)
          const topCoin = response.data.data[0];
          const defaultSymbol = topCoin.symbol;

          console.log("✅ Default symbol from database:", defaultSymbol);
          setSelectedSymbol(defaultSymbol);
        } else {
          console.warn("⚠️ No symbols found in database");
          setSelectedSymbol(null);
        }
      } catch (error) {
        console.error("❌ Error fetching default symbol:", error.message);
        setSelectedSymbol(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDefaultSymbol();
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
      // ✅ Reset ke coin rank #1 dari database
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await axios.get(`${API_BASE_URL}/api/marketcap/live`);

      if (response.data?.success && response.data?.data?.length > 0) {
        const topCoin = response.data.data[0];
        setSelectedSymbol(topCoin.symbol);
      }

      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Symbol reset to database default");
    } catch (error) {
      console.error("❌ Error resetting symbol:", error);
      setSelectedSymbol(null);
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
